// Keep source paths independent of Vite's asset hashes and the deployment base.
const site = 'https://reader.invalid'
const survey = '/papers/agentic-rl-survey/'
const surveyFile = survey + 'arxiv-2509.02547v5-zh.pdf'

export function isSitePath(path) {
  if (!path?.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) return false
  return new URL(path, site).origin === site
}

function pdfUrl(value, from) {
  if (!value || /^(?:#|\/\/)/.test(value) || /[\\\u0000-\u001f]/.test(value)) return
  try {
    const url = new URL(value, new URL(from, site))
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
    if (/\.pdf$/i.test(url.pathname) ||
        (url.hostname === 'arxiv.org' && /^\/pdf\/[^/]+/.test(url.pathname)) ||
        (url.hostname === 'openreview.net' && url.pathname === '/pdf' && url.searchParams.has('id'))) return url
  } catch { /* Non-URL article content is left alone. */ }
}

export function pdfReaderHref(value, from = '/', base = '/') {
  const url = pdfUrl(value, from)
  if (!url) return
  let file = url.href
  if (url.origin === site) {
    let path = url.pathname
    if (base !== '/' && path.startsWith(base)) path = '/' + path.slice(base.length)
    if (path === surveyFile) return survey + url.hash
    file = path + url.search + url.hash
  }
  return '/pdf/#' + new URLSearchParams({ file, from })
}

export function readPdfLocation(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const file = params.get('file')
  if (!(isSitePath(file) || /^https?:\/\//i.test(file ?? ''))) return
  const url = pdfUrl(file, '/')
  if (!url) return
  const page = Number(new URLSearchParams(url.hash.slice(1)).get('page'))
  let src = url.origin === site ? url.pathname + url.search : url.origin + url.pathname + url.search
  const original = src + url.hash
  if (url.hostname === 'github.com') {
    // Three of the upstream lectures are also archived with their course notes.
    const mirror = url.pathname.match(/^\/stanford-cs336\/lectures\/blob\/main\/(lecture_0[345]\.pdf)$/)
    if (mirror) src = '/cs336/sources/lectures/' + mirror[1]
    else if (/^\/[^/]+\/[^/]+\/blob\//.test(url.pathname)) {
      src = 'https://raw.githubusercontent.com' + url.pathname.replace('/blob/', '/')
    }
  } else if (url.hostname === 'huggingface.co') {
    src = src.replace('/blob/', '/resolve/')
  }
  const from = params.get('from')
  let filename = url.pathname.split('/').pop()
  try { filename = decodeURIComponent(filename) } catch { /* Keep an invalid escape printable. */ }
  const title = url.hostname === 'openreview.net' ? 'OpenReview · ' + url.searchParams.get('id') :
    url.hostname === 'arxiv.org' ? 'arXiv · ' + filename : filename.replace(/\.pdf$/i, '')
  return { src, original, title, from: isSitePath(from) ? from : '/papers/', page: Number.isInteger(page) && page > 0 ? page : 1 }
}
