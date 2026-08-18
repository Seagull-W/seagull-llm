import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { sidebar } from './sidebar'

// ===== Vite 插件：模型下载代理（仅 dev/preview 模式生效）=====
// 浏览器 → /api/hf/* → Vite dev server → ModelScope（modelscope.cn，服务端跟随重定向到 OSS）→ 浏览器
// 解决：1) CORS 2) HF CDN 被墙 3) hf-mirror 国内节点直连不通
// 上游回调 ModelScope：解析 HF 风格路径 /{modelId}/resolve/{revision}/{file}，
//   revision 的 main 映射为 ModelScope 的 master，FileRef 保持斜杠不编码；
//   转发 Range 与 User-Agent（OSS 无 UA 会 403），手动跟随 OSS 重定向。

const MODEL_SCOPE_BASE = 'https://modelscope.cn/api/v1/models'

// 代理处理函数（dev server 和 preview server 共用）
async function handleHfProxy(req: any, res: any) {
  const url = req.url || '' // 形如 /onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/model_quantized.onnx（Connect 中间件已剥离 /api/hf 前缀）

  // 1) 解析 HF 风格路径
  const m = url.match(/^\/(.+?)\/resolve\/([^/]+)\/(.+)$/)
  if (!m) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify({ error: 'bad path: ' + url }))
    return
  }
  const modelId = m[1] // onnx-community/Qwen2.5-0.5B-Instruct
  const revision = m[2] // main
  const file = m[3] // onnx/model_quantized.onnx
  const msRevision = revision === 'main' ? 'master' : revision

  // 2) 转发关键请求头（User-Agent + Range）
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' }
  const range = req.headers['range']
  if (range) headers['Range'] = range

  // 3) 组装 ModelScope URL 并手动跟随重定向（最多 5 跳）
  let targetUrl =
    `${MODEL_SCOPE_BASE}/${modelId}/repo` +
    `?Revision=${encodeURIComponent(msRevision)}&FilePath=${file}`

  try {
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetch(targetUrl, { headers, redirect: 'manual' })

      // 302 → OSS，继续跟随；保留 Range/User-Agent
      if (response.status >= 300 && response.status < 400) {
        const loc = response.headers.get('location')
        if (loc) {
          targetUrl = new URL(loc, targetUrl).href
          continue
        }
      }

      // 4) 回传状态与关键响应头
      res.statusCode = response.status
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('Vary', 'Range')

      // 只有当上游返回了 content-length 时才设置（避免 chunked 编码冲突）
      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        res.setHeader('Content-Length', contentLength)
      }

      // transformers.js 依赖 Content-Range 解析大文件总大小（206 分段下载）
      const contentRange = response.headers.get('content-range')
      if (contentRange) {
        res.setHeader('Content-Range', contentRange)
      }
      const acceptRanges = response.headers.get('accept-ranges')
      if (acceptRanges) {
        res.setHeader('Accept-Ranges', acceptRanges)
      }

      // 转发 Content-Disposition（下载文件名）
      const contentDisposition = response.headers.get('content-disposition')
      if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition)
      }

      // HEAD 请求只返回头，不传输 body
      if (req.method === 'HEAD') {
        res.end()
        return
      }

      // 5) 流式传输响应体（支持大文件）
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      }
      res.end()
      return
    }

    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify({ error: 'too many redirects' }))
  } catch (err: any) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify({ error: err?.message || 'Proxy error' }))
  }
}

function hfProxyPlugin() {
  return {
    name: 'hf-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/hf', handleHfProxy)
    },
    configurePreviewServer(server: any) {
      server.middlewares.use('/api/hf', handleHfProxy)
    }
  }
}

export default withMermaid({
  // ===== 站点元数据 =====
  lang: 'zh-CN',
  title: '大语言模型入门',
  description: '面向零基础读者的大语言模型工作原理与实践指南',
  // GitHub Pages 子路径部署时设置 BASE 环境变量（如 /seagull-llm/），本地 dev 默认 '/'
  base: (typeof process !== 'undefined' && process.env.BASE) || '/',
  cleanUrls: true,

  // ===== 主题外观 =====
  appearance: true, // 亮色/暗色双模式，跟随系统 + 手动切换

  // ===== Markdown 配置 =====
  markdown: {
    math: true, // 启用 MathJax3 数学公式渲染
    theme: {
      // 代码块统一深色主题（对应内页设计稿深色代码块）
      light: 'github-dark',
      dark: 'github-dark'
    },
    lineNumbers: true, // 代码块显示行号
    config(md) {
      // 如需额外 markdown-it 插件在此注册
    }
  },

  // ===== 主题配置 =====
  themeConfig: {
    // --- 站点 Logo（海鸥） ---
    logo: '/logo.svg',

    // --- 导航栏 ---
    nav: [
      { text: '首页', link: '/' },
      { text: 'LLM 指南', link: '/ch00-overview' }
    ],

    // --- 侧边栏（扁平结构，数组形式）---
    sidebar,

    // --- 右侧大纲 ---
    outline: {
      level: [2, 3], // 显示 h2 和 h3
      label: '本页目录'
    },

    // --- 搜索 ---
    search: {
      provider: 'local', // 本地搜索，无需外部服务
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换'
            }
          }
        }
      }
    },

    // --- 底部翻页 ---
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    // --- 主题切换标签 ---
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',

    // --- 社交链接 ---
    socialLinks: [
      { icon: 'github', link: 'https://github.com/<username>/seagull-llm' }
    ],

    // --- 页脚 ---
    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2026'
    },

    // --- 外部链接图标 ---
    externalLinkIcon: true
  },

  // ===== Mermaid 配置 =====
  mermaid: {
    // 亮色模式使用 default 主题
    // 插件自动检测暗色模式（html.dark 类），自动切换为 dark 主题
    theme: 'default'
  },

  // ===== Vite 配置：模型下载代理 =====
  // dev/preview 模式：通过 Vite 中间件代理 ModelScope（仅本地生效）
  // 生产模式：通过 Cloudflare Worker 代理（见 worker/hf-proxy.js），不依赖此中间件
  vite: {
    plugins: [hfProxyPlugin()]
  }
})
