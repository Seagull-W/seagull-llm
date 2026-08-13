/**
 * Cloudflare Pages Function: HuggingFace 风格路径 → ModelScope 代理
 *
 * 与网站同域名部署（xxx.pages.dev），同源无 CORS 问题
 *
 * 路径格式：/api/hf/{modelId}/resolve/{revision}/{file}
 * 例如：/api/hf/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/model_quantized.onnx
 */

const MODEL_SCOPE_BASE = 'https://modelscope.cn/api/v1/models'

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const request = context.request
  const url = new URL(request.url)

  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // 解析 HF 风格路径：/api/hf/{modelId}/resolve/{revision}/{file}
  const m = url.pathname.match(/^\/api\/hf\/(.+?)\/resolve\/([^/]+)\/(.+)$/)
  if (!m) {
    return jsonResponse({ error: 'bad path: ' + url.pathname }, 400)
  }

  const modelId = m[1]
  const revision = m[2]
  const file = m[3]
  const msRevision = revision === 'main' ? 'master' : revision

  // 组装 ModelScope URL
  const targetUrl =
    `${MODEL_SCOPE_BASE}/${modelId}/repo` +
    `?Revision=${encodeURIComponent(msRevision)}&FilePath=${file}`

  // 转发关键请求头（User-Agent 必须，OSS 无 UA 会 403）
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' }
  const range = request.headers.get('Range')
  if (range) headers['Range'] = range

  // 手动跟随重定向（最多 5 跳）
  let resp: Response
  let currentUrl = targetUrl
  try {
    for (let hop = 0; hop < 5; hop++) {
      resp = await fetch(currentUrl, { headers, redirect: 'manual' })

      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get('location')
        if (loc) {
          currentUrl = new URL(loc, currentUrl).href
          continue
        }
      }
      break
    }
  } catch (err: any) {
    return jsonResponse({ error: err?.message || 'fetch error' }, 502)
  }

  // 构建响应头
  const respHeaders = new Headers()

  const ct = resp.headers.get('content-type')
  if (ct) respHeaders.set('Content-Type', ct)

  const cl = resp.headers.get('content-length')
  if (cl) respHeaders.set('Content-Length', cl)

  // transformers.js 依赖 Content-Range 解析大文件总大小（206 分段下载）
  const cr = resp.headers.get('content-range')
  if (cr) respHeaders.set('Content-Range', cr)

  const ar = resp.headers.get('accept-ranges')
  if (ar) respHeaders.set('Accept-Ranges', ar)

  const cd = resp.headers.get('content-disposition')
  if (cd) respHeaders.set('Content-Disposition', cd)

  respHeaders.set('Access-Control-Allow-Origin', '*')
  respHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
  respHeaders.set('Cache-Control', 'public, max-age=31536000, immutable')
  respHeaders.set('Vary', 'Range')

  // HEAD 请求只返回头
  if (request.method === 'HEAD') {
    return new Response(null, { status: resp.status, headers: respHeaders })
  }

  return new Response(resp.body, { status: resp.status, headers: respHeaders })
}

function jsonResponse(obj: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
