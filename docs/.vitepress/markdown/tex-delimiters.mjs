// Reuse VitePress's MathJax renderer for standard LaTeX delimiters.
// Parser rules keep code fences, inline code and escaped backslashes intact.
function closingDelimiter(source, delimiter, start) {
  let position = start
  while ((position = source.indexOf(delimiter, position)) !== -1) {
    let backslashes = 0
    for (let i = position - 1; i >= 0 && source[i] === '\\'; i--) backslashes++
    if (backslashes % 2 === 0) return position
    position += delimiter.length
  }
  return -1
}

export default function texDelimiters(md) {
  md.inline.ruler.before('escape', 'tex_inline', (state, silent) => {
    if (!state.src.startsWith('\\(', state.pos)) return false
    const start = state.pos + 2
    const end = closingDelimiter(state.src, '\\)', start)
    if (end < 0 || end >= state.posMax || end === start) return false
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.content = state.src.slice(start, end)
      token.markup = '\\('
    }
    state.pos = end + 2
    return true
  })

  md.block.ruler.before('fence', 'tex_block', (state, start, end, silent) => {
    const first = state.bMarks[start] + state.tShift[start]
    if (state.sCount[start] - state.blkIndent >= 4 ||
        !state.src.startsWith('\\[', first)) return false
    const lines = []
    for (let line = start; line < end; line++) {
      const position = state.bMarks[line] + state.tShift[line]
      if (line > start && position < state.eMarks[line] &&
          state.sCount[line] < state.blkIndent) return false
      const content = state.src.slice(line === start ? first + 2 : position, state.eMarks[line])
      const close = closingDelimiter(content, '\\]', 0)
      if (close !== -1 && !content.slice(close + 2).trim()) {
        if (silent) return true
        lines.push(content.slice(0, close))
        const token = state.push('math_block', 'math', 0)
        token.block = true
        token.content = lines.join('\n').trim()
        token.markup = '\\['
        token.map = [start, line + 1]
        state.line = line + 1
        return true
      }
      lines.push(content)
    }
    return false
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
}
