import MarkdownIt from 'markdown-it'
import katex from 'katex'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const math = (source: string, displayMode: boolean) => {
  try {
    return katex.renderToString(source, { displayMode, throwOnError: true, trust: false, maxExpand: 500, maxSize: 20, strict: 'ignore', macros: {} })
  } catch {
    return `<code class="note-math-error" title="公式语法有误，已保留原文">${md.utils.escapeHtml(source)}</code>`
  }
}
md.inline.ruler.before('escape', 'note_math', (state, silent) => {
  const start = state.pos
  const slash = state.src.startsWith('\\(', start)
  if (!slash && state.src[start] !== '$') return false
  const delimiter = slash ? '\\)' : state.src.startsWith('$$', start) ? '$$' : '$'
  const width = slash ? 2 : delimiter.length
  if (!slash && /\s/.test(state.src[start + width] || ' ')) return false
  let end = state.src.indexOf(delimiter, start + width)
  while (end >= 0 && state.src[end - 1] === '\\' && !slash) end = state.src.indexOf(delimiter, end + width)
  if (end < 0 || end === start + width) return false
  if (!slash && delimiter === '$' && /\d/.test(state.src[end + 1] || '')) return false
  if (!silent) {
    const token = state.push('note_math', '', 0)
    token.content = state.src.slice(start + width, end)
    token.block = delimiter === '$$'
  }
  state.pos = end + delimiter.length
  return true
})
md.block.ruler.before('fence', 'note_math_block', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start])
  const opener = line.startsWith('$$') ? '$$' : line.startsWith('\\[') ? '\\[' : ''
  if (!opener) return false
  const closer = opener === '$$' ? '$$' : '\\]'
  let source = line.slice(2), current = start
  while (!source.includes(closer) && current + 1 < end) {
    current++
    source += '\n' + state.src.slice(state.bMarks[current] + state.tShift[current], state.eMarks[current])
  }
  const closeAt = source.indexOf(closer)
  if (closeAt < 0 || source.slice(closeAt + 2).trim()) return false
  if (silent) return true
  const token = state.push('note_math', '', 0)
  token.content = source.slice(0, closeAt).trim()
  token.block = true
  token.map = [start, current + 1]
  state.line = current + 1
  return true
})
md.renderer.rules.note_math = (tokens, index) => math(tokens[index].content, tokens[index].block)
const linkOpen = md.renderer.rules.link_open || ((tokens, i, options, _env, self) => self.renderToken(tokens, i, options))
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  tokens[i].attrSet('target', '_blank')
  tokens[i].attrSet('rel', 'noopener noreferrer')
  return linkOpen(tokens, i, options, env, self)
}
// Imported notes never trigger unsolicited remote image requests.
md.renderer.rules.image = (tokens, i) => {
  const token = tokens[i], url = token.attrGet('src') || ''
  return `<a href="${md.utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">图片：${md.utils.escapeHtml(token.content || '查看图片')}</a>`
}
export function renderNoteMarkdown(source: string): string {
  return md.render(source.slice(0, 100000))
}
