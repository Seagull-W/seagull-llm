import matter from 'gray-matter'
import { parse } from '@vue/compiler-dom'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const imageDimensions = new Map()
function prepareImages(html, env) {
  return html.replace(/<img\b[^>]*>/g, markup => {
    let attributes = ''
    if (!/\bloading=/.test(markup)) attributes += ' loading="lazy"'
    if (!/\bdecoding=/.test(markup)) attributes += ' decoding="async"'
    const src = markup.match(/\ssrc="([^"]+)"/)?.[1]
    if (src && env.path && !/^(?:https?:|data:|\/\/)/.test(src) && !/\b(?:width|height)=/.test(markup)) {
      const file = src.startsWith('/') ? resolve('docs/public', src.slice(1)) : resolve(dirname(env.path), src)
      if (!imageDimensions.has(file)) {
        let size
        if (existsSync(file)) {
          const bytes = readFileSync(file)
          if (bytes.length > 24 && bytes.subarray(1, 4).toString() === 'PNG') size = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
          else if (file.endsWith('.svg')) {
            const box = bytes.toString().match(/viewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/)
            if (box) size = [box[1], box[2]]
          }
        }
        imageDimensions.set(file, size)
      }
      const size = imageDimensions.get(file)
      if (size) attributes += ` width="${size[0]}" height="${size[1]}"`
    }
    return markup.replace(/\s*\/?>$/, attributes + '>')
  })
}

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

function mathBaselines(html) {
  return html.replace(/<mjx-container\b([^>]*)>([\s\S]*?)<\/mjx-container>/g, (markup, attributes, content) => {
    if (/\bdisplay="true"/.test(attributes)) return markup
    const baseline = content.match(/<svg\b[^>]*style="[^"]*vertical-align:\s*([^;" ]+)/)?.[1] ?? '0ex'
    const style = `--math-baseline:${baseline};`
    const merged = /\bstyle="/.test(attributes)
      ? attributes.replace(/\bstyle="/, `style="${style}`)
      : `${attributes} style="${style}"`
    return `<mjx-container${merged}>${content}</mjx-container>`
  })
}

export default function nativeHtml(md, base = '/') {
  const render = md.render.bind(md)
  md.render = (source, env = {}) => {
    const { data, content } = matter(source)
    if (data.contentFormat !== 'html') return prepareImages(mathBaselines(render(source, env)), env)
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
        if (mode === 'block') return rendered
        // Scrollable inline math needs the SVG's TeX depth on its outer box;
        // otherwise overflow changes the baseline to the box's bottom edge.
        return mathBaselines(rendered.trim().replace(/^<p>|<\/p>$/g, ''))
      })
    // Browsers insert tbody around bare rows; compile the same structure so
    // hydration and the shared table controls see one consistent DOM.
    html = html.replace(/(<table\b[^>]*>)(\s*(?:<tr\b[\s\S]*?<\/tr>\s*)+)(<\/table>)/g, '$1<tbody>$2</tbody>$3')
    html = prepareImages(html, env)
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
