import { ref } from 'vue'

// ============================================================
//  常量
// ============================================================
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct'

// ============================================================
//  模块级状态 —— 跨组件挂载/卸载持久化
// ============================================================
const tokenizerState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const tokenizerProgress = ref<string | null>(null)
const tokenizerError = ref<string | null>(null)

let tokenizerInstance: any = null
let transformersLib: any = null
let isLoading = false

// ============================================================
//  加载分词器（仅 tokenizer，不加载模型权重）
// ============================================================
async function loadTokenizer() {
  if (isLoading || tokenizerState.value === 'loading') return
  if (tokenizerState.value === 'ready' && tokenizerInstance) return

  isLoading = true
  tokenizerState.value = 'loading'
  tokenizerError.value = null
  tokenizerProgress.value = '正在加载推理引擎...'

  try {
    // Step 1: 加载 transformers.js 库
    try {
      transformersLib = await import('@huggingface/transformers')
      transformersLib.env.allowLocalModels = false
    } catch {
      // 尝试 CDN 回退
      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0',
        'https://esm.sh/@huggingface/transformers@4.2.0',
      ]
      let loaded = false
      for (const url of cdnUrls) {
        try {
          transformersLib = await import(/* @vite-ignore */ url)
          loaded = true
          break
        } catch { /* try next */ }
      }
      if (!loaded) throw new Error('无法加载 transformers.js 库')
    }

    // Step 2: 设置代理端点
    const endpoint = typeof window !== 'undefined'
      ? `${window.location.origin}/api/hf/`
      : 'http://localhost:5173/api/hf/'
    transformersLib.env.remoteHost = endpoint

    // Step 3: 加载分词器（仅需下载 tokenizer.json 等小文件，约 8MB）
    tokenizerProgress.value = '正在下载分词器文件（约 8MB）...'
    tokenizerInstance = await transformersLib.AutoTokenizer.from_pretrained(MODEL_ID)

    tokenizerState.value = 'ready'
    tokenizerProgress.value = null
  } catch (err: any) {
    tokenizerState.value = 'error'
    const msg = err?.message || String(err) || ''
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
      tokenizerError.value = '分词器下载失败：无法连接到 ModelScope 代理。请确保 dev server 正在运行，或检查网络连接。'
    } else if (msg.includes('404') || msg.includes('Not Found')) {
      tokenizerError.value = '分词器文件未找到，模型仓库可能已更新。'
    } else {
      tokenizerError.value = msg || '分词器加载失败'
    }
  } finally {
    isLoading = false
  }
}

// ============================================================
//  真实分词（同步调用，tokenizer 加载后即可使用）
// ============================================================
export interface RealToken {
  text: string
  index: number
  tokenId: number
  isSpecial?: boolean
}

function tokenizeWithReal(text: string): RealToken[] {
  if (!tokenizerInstance || !text) return []

  try {
    const result = tokenizerInstance(text, { add_special_tokens: false })
    const ids = Array.from(result.input_ids.data as Int32Array)

    return ids.map((id: number, index: number) => {
      let tokenText: string
      try {
        tokenText = tokenizerInstance.decode([id], { skip_special_tokens: false })
      } catch {
        tokenText = `<ID:${id}>`
      }

      // 判断是否为特殊 token
      const isSpecial = /^<\|.*\|>$/.test(tokenText) || tokenText === '' || tokenText.startsWith('<') && tokenText.endsWith('>')

      // 将空格显示为 · 以便观察
      if (tokenText === ' ') tokenText = '·(空格)'
      else tokenText = tokenText.replace(/ /g, '·')

      // 空字符串显示为不可见 token
      if (!tokenText) tokenText = '(空)'

      return { text: tokenText, index, tokenId: id, isSpecial }
    })
  } catch {
    return []
  }
}

// ============================================================
//  导出
// ============================================================
export function useTokenizer() {
  return {
    tokenizerState,
    tokenizerProgress,
    tokenizerError,
    loadTokenizer,
    tokenizeWithReal,
  }
}
