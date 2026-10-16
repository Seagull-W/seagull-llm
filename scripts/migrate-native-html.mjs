import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative, basename } from 'node:path'
import matter from 'gray-matter'
import { createMarkdownRenderer } from 'vitepress'
import { MermaidMarkdown } from 'vitepress-plugin-mermaid'
import texDelimiters from '../docs/.vitepress/markdown/tex-delimiters.mjs'

// One-time, idempotent migration. HTML becomes the maintained body; this
// command never regenerates or overwrites an already migrated HTML source.
const root = resolve('docs')
const formats = {
  'llm-book': 'book', papers: 'paper', 'rl-book': 'lab',
  'westlake-rl': 'course', 'rust-notes': 'code', 'linux-notes': 'system', videos: 'gallery'
}
const md = await createMarkdownRenderer(root, {
  math: true, lineNumbers: true, headers: true,
  config(md) { md.use(MermaidMarkdown); md.use(texDelimiters) }
})
const formula = mode => (tokens, index) => {
  const tag = mode === 'inline' ? 'span' : 'div'
  const tex = tokens[index].content.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  return `<${tag} class="math-${mode}" data-tex="${tex}"></${tag}>${mode === 'block' ? '\n' : ''}`
}
md.renderer.rules.math_inline = formula('inline')
md.renderer.rules.math_block = formula('block')
async function* pages(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['research', 'public', 'adr'].includes(entry.name)) continue
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) yield* pages(file)
    else if (entry.name.endsWith('.md')) yield file
  }
}
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
let count = 0
for await (const file of pages(root)) {
  const source = await readFile(file, 'utf8')
  const parsed = matter(source)
  if (parsed.data.contentFormat === 'html') continue
  const name = relative(root, file).replaceAll('\\', '/')
  let format = formats[name.split('/')[0]] ?? 'directory'
  if (parsed.data.pageClass?.includes('chapter-index')) format = 'directory'
  if (parsed.data.layout === 'home') format = 'home'
  const env = { path: file, relativePath: name, cleanUrls: true }
  let html = md.render(source, env)
  const data = { ...parsed.data }
  data.title ||= env.title || (format === 'home' ? 'seagull学习主页' :
    basename(file) === 'index.md' ? basename(resolve(file, '..')) : basename(file, '.md'))
  if (!data.description) {
    data.description = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110) || data.title
  }
  let blocks = [...env.sfcBlocks.scripts, ...env.sfcBlocks.styles].map(block => block.content).join('\n\n')
  if (!/<h1\b/.test(html) && !['home', 'gallery'].includes(format) && !data.pdf) {
    html = `<h1 id="article-title" tabindex="-1">${escape(data.title)} <a class="header-anchor" href="#article-title" aria-label="文章链接">&#8203;</a></h1>\n${html}`
  }
  if (name === 'linux-notes/linux-isolation.md') {
    const original = await readFile(resolve(root, 'public/linux-notes/linux_isolation_notes.html'), 'utf8')
    html = original.match(/<body>([\s\S]*?)<\/body>/i)[1]
      .replace('<main class="page">', '<div class="linux-note-content">').replace('</main>', '</div>')
      .replace(/<nav class="toc">[\s\S]*?<\/nav>/, '')
      .replace(/<section id="([^"]+)"><h2>/g, '<section><h2 id="$1" tabindex="-1">')
      .replace('两个隔离环境仍共享同一个 Linux 内核；上图只表示可能的隔离配置。</div></div>',
        '两个隔离环境仍共享同一个 Linux 内核；上图只表示可能的隔离配置。</div></div></div>')
      .replace(/<div class="footer">[\s\S]*?<\/div>/, '')
    // Existing headings without IDs get stable IDs for the shared outline.
    let heading = 0
    html = html.replace(/<h([3-6])>/g, (_, level) => `<h${level} id="linux-detail-${++heading}" tabindex="-1">`)
      .replace('<h1>', '<h1 id="linux-isolation" tabindex="-1">')
      .replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g, (all, level, attrs, body) => {
        const id = attrs.match(/id="([^"]+)"/)?.[1]
        return id ? `<h${level}${attrs}>${body} <a class="header-anchor" href="#${id}" aria-label="章节链接">&#8203;</a></h${level}>` : all
      })
    const css = original.match(/<style>([\s\S]*?)<\/style>/i)[1]
      .replace(':root{', '.linux-note-content{')
      .replace('html{scroll-behavior:smooth}', '')
      .replace(/\bbody\{/g, '.linux-note-content{')
      .replaceAll('.page', '.linux-note-content')
    blocks = `<style scoped>\n${css}\n</style>`
    delete data.aside
    data.pageClass = 'native-html-page'
  }
  // Preserve rendered equations, highlighted code, diagrams, Vue components
  // and relative assets. Only add semantic reading structure around the body.
  if (!['home', 'gallery'].includes(format) && !data.pdf && name !== 'linux-notes/linux-isolation.md') {
    const sections = html.split(/(?=^<h2\b)/m)
    html = `<header class="document-intro">\n${sections.shift()}</header>\n` +
      sections.map(section => `<section class="document-section">\n${section}</section>`).join('\n')
  }
  const tag = ['home', 'gallery', 'directory'].includes(format) ? 'div' : 'article'
  html = `${blocks ? blocks + '\n\n' : ''}<${tag} class="native-document format-${format}" data-format="${format}" aria-label="${escape(data.title)}">\n${html.trim()}\n</${tag}>\n`
  data.contentFormat = 'html'
  const htmlFile = file.replace(/\.md$/, '.html')
  await writeFile(htmlFile, html)
  await writeFile(file, matter.stringify(`\n<!--@include: ./${basename(htmlFile)}-->\n`, data))
  count++
}
console.log(`Migrated ${count} pages to native HTML sources; daily research and maintenance notes unchanged.`)
