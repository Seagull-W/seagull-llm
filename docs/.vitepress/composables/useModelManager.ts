import { ref, computed } from 'vue'

export interface Candidate {
  text: string
  prob: number
}

// ============================================================
//  常量定义
// ============================================================
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct'

// Transformers.js CDN 源（仅当本地 npm 包不可用时回退使用）
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0',
  'https://esm.sh/@huggingface/transformers@4.2.0',
  'https://fastly.jsdelivr.net/npm/@huggingface/transformers@4.2.0',
  'https://unpkg.com/@huggingface/transformers@4.2.0',
]

// 模型权重下载源
// dev: Vite 中间件代理；生产: Cloudflare Pages Functions 代理（同源 /api/hf/）
function getMirrorEndpoint(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/hf/`
  }
  return 'http://localhost:5173/api/hf/'
}
const HF_ENDPOINTS = {
  mirror: getMirrorEndpoint(),
  official: 'https://huggingface.co/',
}

// ============================================================
//  模块级状态 —— 跨组件挂载/卸载持久化
//  当用户切换文档时，NextTokenViz 组件卸载，但这些变量不会被销毁。
//  重新导航回 ch01 时，组件重新挂载，直接读取已有状态。
// ============================================================

// 响应式状态（UI 绑定用）
const modelState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const modelProgress = ref<{ file: string; progress: number } | null>(null)
const modelError = ref<string | null>(null)
const modelErrorDetail = ref<string | null>(null)
const useMirror = ref(true) // 默认使用国内镜像
const lastInferenceOk = ref(false)

// 非响应式存储（避免 Vue 追踪大对象）
let modelInstance: any = null
let tokenizerInstance: any = null
let transformersLib: any = null

// 防止重复加载
let isLoading = false

const useRealModel = computed(() => modelState.value === 'ready')

// ============================================================
//  辅助函数
// ============================================================

async function checkWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false
  try {
    const adapter = await (navigator as any).gpu.requestAdapter()
    return !!adapter
  } catch {
    return false
  }
}

/** 测试端点连通性：尝试 HEAD 请求模型的 config.json */
async function testEndpointConnectivity(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const testUrl = `${url}${MODEL_ID}/resolve/main/config.json`
    const resp = await fetch(testUrl, { method: 'HEAD', mode: 'cors' })
    if (resp.ok || resp.status === 302 || resp.status === 301) {
      return { ok: true, detail: '连接正常' }
    }
    return { ok: false, detail: `HTTP ${resp.status}` }
  } catch (err: any) {
    return { ok: false, detail: err?.message || String(err) }
  }
}

/**
 * 加载 Transformers.js 库
 * 优先使用本地 npm 包（Vite 正确处理 WASM 文件路径），CDN 作为回退
 */
async function loadTransformersLib(): Promise<any> {
  try {
    const lib = await import('@huggingface/transformers')
    return lib
  } catch (localErr: any) {
    let lastErr: any = localErr
    for (const url of CDN_URLS) {
      try {
        const lib = await import(/* @vite-ignore */ url)
        const wasmBase = url.replace(/\/[^/]*$/, '/dist/')
        if (lib.env?.backends?.onnx?.wasm) {
          lib.env.backends.onnx.wasm.wasmPaths = wasmBase
        }
        return lib
      } catch (err: any) {
        lastErr = err
      }
    }
    throw new Error(`本地包和 CDN 均不可用。本地错误：${localErr?.message || localErr}；CDN 错误：${lastErr?.message || lastErr}`)
  }
}

/** 判断是否为 WebGPU 初始化错误（可回退到 WASM） */
function isWebGPUInitError(err: any): boolean {
  const msg = (err?.message || String(err) || '').toLowerCase()
  return msg.includes('subgroupminsize') ||
    msg.includes('adapterinfo') ||
    msg.includes('requestadapter') ||
    msg.includes('gpu adapter')
}

/**
 * Polyfill GPUDevice.prototype.adapterInfo
 */
function polyfillGPUAdapterInfo() {
  if (typeof GPUDevice === 'undefined' || !GPUDevice.prototype) return

  const originalDesc = Object.getOwnPropertyDescriptor(GPUDevice.prototype, 'adapterInfo')
  const defaultInfo = {
    subgroupMinSize: 32,
    subgroupMaxSize: 32,
    vendor: '',
    architecture: '',
    device: '',
    description: '',
  }

  Object.defineProperty(GPUDevice.prototype, 'adapterInfo', {
    get() {
      let info: any = originalDesc?.get?.call(this)
      if (!info) {
        info = { ...defaultInfo }
      } else {
        if (info.subgroupMinSize === undefined) info.subgroupMinSize = 32
        if (info.subgroupMaxSize === undefined) info.subgroupMaxSize = 32
      }
      return info
    },
    configurable: true,
  })
}

/**
 * 临时禁用 WebGPU（用于 WASM 回退时阻止 ONNX Runtime JSEP 访问 WebGPU）
 */
function disableWebGPU(): () => void {
  const nav = navigator as any
  if (!nav.gpu) return () => {}

  const savedGPU = nav.gpu
  try {
    Object.defineProperty(nav, 'gpu', { value: undefined, configurable: true })
  } catch {
    nav.gpu = undefined
  }
  return () => {
    try {
      Object.defineProperty(nav, 'gpu', { value: savedGPU, configurable: true })
    } catch {
      nav.gpu = savedGPU
    }
  }
}

/** 尝试用指定设备加载模型 */
async function tryLoadModel(device: 'webgpu' | 'wasm') {
  const dtype = device === 'webgpu' ? 'q4' : 'q8'
  return transformersLib.AutoModelForCausalLM.from_pretrained(MODEL_ID, {
    dtype,
    device,
    progress_callback: (data: any) => {
      if (data.status === 'progress') {
        modelProgress.value = {
          file: data.file?.split('/').pop() || '模型文件',
          progress: Math.round(data.progress || 0)
        }
      } else if (data.status === 'done') {
        modelProgress.value = { file: '模型加载完成', progress: 100 }
      }
    }
  })
}

// ============================================================
//  模型生命周期管理
// ============================================================

async function loadRealModel() {
  // 如果已经在加载中，不重复触发
  if (isLoading || modelState.value === 'loading') return
  // 如果已经加载成功，不重复加载
  if (modelState.value === 'ready' && modelInstance) return

  isLoading = true
  modelState.value = 'loading'
  modelError.value = null
  modelErrorDetail.value = null
  modelProgress.value = { file: '正在加载推理引擎...', progress: 5 }

  try {
    // === Step 1: 加载 Transformers.js 库 ===
    try {
      transformersLib = await loadTransformersLib()
      transformersLib.env.allowLocalModels = false
    } catch (libErr: any) {
      throw new Error(`[引擎加载失败] ${libErr?.message || libErr}`)
    }

    // === Step 2: 设置下载源并测试连通性 ===
    const endpoint = useMirror.value ? HF_ENDPOINTS.mirror : HF_ENDPOINTS.official
    transformersLib.env.remoteHost = endpoint

    const sourceLabel = useMirror.value ? 'ModelScope 代理' : 'HuggingFace 官方'
    modelProgress.value = { file: `正在测试 ${sourceLabel} 连通性...`, progress: 10 }

    const connTest = await testEndpointConnectivity(endpoint)
    if (!connTest.ok) {
      throw new Error(`[下载源不可达] 无法连接 ${sourceLabel}（${connTest.detail}）。` +
        `请检查网络，或确认代理服务能访问 ModelScope（modelscope.cn）。`)
    }

    // === Step 3: 检查 WebGPU ===
    polyfillGPUAdapterInfo()
    const gpu = await checkWebGPU()
    let useDevice: 'webgpu' | 'wasm' = gpu ? 'webgpu' : 'wasm'
    let deviceLabel = gpu ? 'WebGPU' : 'WASM (CPU)'

    // === Step 4: 下载并加载模型（含 WebGPU → WASM 自动回退） ===
    modelProgress.value = { file: `正在下载模型（约 512MB，${sourceLabel} / ${deviceLabel}）...`, progress: 15 }

    try {
      modelInstance = await tryLoadModel(useDevice)
    } catch (modelErr: any) {
      if (useDevice === 'webgpu' && isWebGPUInitError(modelErr)) {
        modelErrorDetail.value = `WebGPU 初始化失败（${modelErr?.message || modelErr}），已自动回退到 WASM CPU 模式`
        useDevice = 'wasm'
        deviceLabel = 'WASM (CPU)'
        modelProgress.value = { file: `WebGPU 不可用，切换到 WASM 模式重新加载...`, progress: 15 }
        const restoreGPU = disableWebGPU()
        try {
          modelInstance = await tryLoadModel(useDevice)
        } catch (wasmErr: any) {
          throw new Error(`[WASM回退失败] WebGPU 错误：${modelErr?.message || modelErr} | WASM 错误：${wasmErr?.message || wasmErr}`)
        } finally {
          restoreGPU()
        }
      } else {
        throw modelErr
      }
    }

    modelProgress.value = { file: '正在加载分词器...', progress: 100 }
    try {
      tokenizerInstance = await transformersLib.AutoTokenizer.from_pretrained(MODEL_ID)
    } catch (tokErr: any) {
      const tokMsg = (tokErr?.message || String(tokErr) || '')
      // tokenizer_config.json 下载失败时，库会抛 "Cannot read properties of undefined (reading 'tokenizer_class')"
      // 这里捕获并转成清晰的下载失败提示
      throw new Error(`[分词器加载失败] 无法获取 tokenizer_config.json（${tokMsg}）。` +
        `请确认代理服务能访问 ModelScope（modelscope.cn），或检查网络。`)
    }

    modelState.value = 'ready'
    modelProgress.value = null
    // 注意：不在此处调用 updateCandidates，由组件监听 modelState 变化来刷新
  } catch (err: any) {
    modelState.value = 'error'
    const msg = err?.message || String(err) || ''
    modelErrorDetail.value = msg

    if (msg.includes('[引擎加载失败]')) {
      modelError.value = '推理引擎加载失败。请检查网络或使用代理/VPN 后重试。'
    } else if (msg.includes('[下载源不可达]')) {
      modelError.value = '模型下载源不可达。请检查网络，或确认代理服务能访问 ModelScope（modelscope.cn）后重试。'
    } else if (msg.includes('[分词器加载失败]')) {
      modelError.value = '模型文件下载失败：无法获取 tokenizer_config.json。请确认能访问 ModelScope（modelscope.cn）（检查网络或代理服务）后重试。'
    } else if (msg.includes('[WASM回退失败]')) {
      modelError.value = 'WebGPU 和 WASM 均不可用。请使用 Chrome/Edge 最新版浏览器，或检查网络连接后重试。'
    } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
      const suggestion = useMirror.value
        ? '代理连接失败。请确保 dev server 正在运行，或尝试取消勾选使用直连。'
        : 'HuggingFace 连接失败。请尝试：1) 勾选本地代理 2) 使用代理/VPN'
      modelError.value = `模型下载失败。${suggestion}`
    } else if (msg.includes('404') || msg.includes('Not Found')) {
      modelError.value = '模型文件未找到，可能版本已更新，请刷新页面后重试。'
    } else if (msg.includes('CORS') || msg.includes('cors')) {
      modelError.value = '跨域请求被拒绝。请尝试切换下载源或使用代理。'
    } else {
      modelError.value = msg || '模型加载失败'
    }
    modelProgress.value = null
  } finally {
    isLoading = false
  }
}

function unloadRealModel() {
  modelInstance = null
  tokenizerInstance = null
  modelState.value = 'idle'
  // 注意：不在此处调用 updateCandidates，由组件监听 modelState 变化来刷新
}

/** 使用真实模型预测下一个 token，失败时调用 fallback */
async function predictWithModel(
  text: string,
  fallback: () => Candidate[]
): Promise<Candidate[]> {
  if (!modelInstance || !tokenizerInstance) return fallback()
  lastInferenceOk.value = false

  try {
    const inputs = await tokenizerInstance(text)

    const inferencePromise = modelInstance(inputs)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('模型推理超时（15s）')), 15000)
    )
    const output: any = await Promise.race([inferencePromise, timeoutPromise])

    const logits = output.logits
    if (!logits) {
      console.error('[NextTokenViz] 模型输出无 logits 字段:', Object.keys(output))
      return fallback()
    }

    const dims = logits.dims as number[]
    const seqLen = dims[dims.length - 2]
    const vocabSize = dims[dims.length - 1]

    const data = logits.data as Float32Array
    const offset = (seqLen - 1) * vocabSize
    const lastLogits = data.subarray(offset, offset + vocabSize)

    // Softmax
    const probs = new Float32Array(vocabSize)
    let maxLogit = -Infinity
    for (let i = 0; i < vocabSize; i++) {
      if (lastLogits[i] > maxLogit) maxLogit = lastLogits[i]
    }
    let sum = 0
    for (let i = 0; i < vocabSize; i++) {
      probs[i] = Math.exp(lastLogits[i] - maxLogit)
      sum += probs[i]
    }
    for (let i = 0; i < vocabSize; i++) probs[i] /= sum

    // Top 30 → 过滤 → Top 6
    const indices = Array.from({ length: vocabSize }, (_, i) => i)
      .sort((a, b) => probs[b] - probs[a])
      .slice(0, 30)

    const candidates: Candidate[] = []
    for (const idx of indices) {
      if (candidates.length >= 6) break
      const decoded = tokenizerInstance.decode([idx], { skip_special_tokens: true })
      if (!decoded || decoded.trim() === '') continue
      if (/^<.*>$/.test(decoded.trim())) continue
      candidates.push({ text: decoded, prob: probs[idx] })
    }

    if (candidates.length === 0) {
      console.warn('[NextTokenViz] 模型未返回有效候选词，回退到 n-gram')
      return fallback()
    }

    const total = candidates.reduce((s, c) => s + c.prob, 0)
    if (total > 0) candidates.forEach(c => c.prob /= total)
    lastInferenceOk.value = true
    return candidates
  } catch (err: any) {
    console.error('[NextTokenViz] 模型推理失败:', err?.message || err)
    return fallback()
  }
}

// ============================================================
//  导出 composable
// ============================================================

export function useModelManager() {
  return {
    // 响应式状态
    modelState,
    modelProgress,
    modelError,
    modelErrorDetail,
    useMirror,
    useRealModel,
    lastInferenceOk,
    // 方法
    loadRealModel,
    unloadRealModel,
    predictWithModel,
  }
}
