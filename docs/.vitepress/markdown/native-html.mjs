import matter from 'gray-matter'
import { parse } from '@vue/compiler-dom'

// HTML is compiled into the page's Vue template, including SSR. No iframe,
// runtime fetch, v-html, or second scrolling document is involved.
export function inspectHtml(source) {
  const tree = parse(source, { comments: true })
  const headers = []
  const links = []
  const stack = []
  let title = ''
  const text = node => node.type === 2 ? node.content :
    (node.children ?? []).filter(child => !child.props?.some(prop =>
      prop.name === 'class' && prop.value?.content.includes('header-anchor')
    )).map(text).join('')
  function visit(node) {
    if (node.type === 1) {
      const attr = name => node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
      if (node.tag === 'a' && attr('href')) links.push(attr('href'))
      if (/^h[1-6]$/.test(node.tag)) {
        const level = Number(node.tag[1])
        const label = text(node).trim()
        if (level === 1 && !title) title = label
        const slug = attr('id')
        if (level > 1 && slug) {
          const header = { level, title: label, slug, link: `#${slug}`, children: [] }
          while (stack.length && stack.at(-1).level >= level) stack.pop()
          ;(stack.at(-1)?.children ?? headers).push(header)
          stack.push(header)
        }
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  return { title, headers, links }
}

export default function nativeHtml(md, base = '/') {
  const render = md.render.bind(md)
  md.render = (source, env = {}) => {
    const { data, content } = matter(source)
    if (data.contentFormat !== 'html') return render(source, env)
    if (/<!--\s*@include:/.test(content)) {
      throw new Error('HTML source must be expanded with VitePress processIncludes before rendering.')
    }
    const scripts = []
    const styles = []
    let html = content.replace(/^<(script|style)\b[^>]*>[\s\S]*?<\/\1>\s*$/gm, block => {
      const type = block.startsWith('<script') ? 'script' : 'style'
      ;(type === 'script' ? scripts : styles).push({ type, content: block })
      return ''
    })
    // Keep formula sources editable in HTML; MathJax produces static,
    // accessible SVG during compilation, with no browser-side dependency.
    html = html.replace(/<(span|div) class="math-(inline|block)" data-tex="([^"]*)"><\/\1>/g,
      (markup, tag, mode) => {
        const node = parse(markup).children[0]
        const tex = node.props.find(prop => prop.name === 'data-tex').value.content
        const rendered = render(mode === 'block' ? `$$\n${tex}\n$$` : `$${tex}$`, {})
        return mode === 'block' ? rendered : rendered.trim().replace(/^<p>|<\/p>$/g, '')
      })
    const info = inspectHtml(html)
    // Root-relative links and public assets must also work under GitHub Pages.
    // Keep relative assets static so Vite can hash and bundle them as usual.
    html = html.replace(/\b(href|src)="\/(?!\/)([^"\n]*)"/g, (_, attr, path) => {
      const url = `${base}${path}`
      // A static src with a base prefix would be treated by Vite as a source
      // import. Public assets need a constant binding so their URL is retained.
      return attr === 'src' ? `:src="${JSON.stringify(url).replaceAll('"', '&quot;')}"` : `href="${url}"`
    })
    env.frontmatter = data
    env.content = content
    env.title = info.title
    env.headers = info.headers
    env.links = info.links.filter(link => !/^(?:[a-z]+:|#|\/\/)/i.test(link))
    env.sfcBlocks = { scripts, styles, customBlocks: [] }
    return html
  }
}
