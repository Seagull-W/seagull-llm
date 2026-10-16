import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import { readContent } from './content-source.mjs'
import nativeHtml, { inspectHtml } from '../docs/.vitepress/markdown/native-html.mjs'

const files = readdirSync('docs', { recursive: true }).filter(file => file.endsWith('.md') &&
  !/^(?:research|public|adr|\.vitepress)[\\/]/.test(file)).map(file => resolve('docs', file))
const md = await createMarkdownRenderer(resolve('docs'), {
  math: true,
  config(md) { md.use(nativeHtml, '/subpath/') }
})
test('all reader pages outside daily research have authoritative HTML bodies', () => {
  assert.ok(files.length >= 72)
  for (const file of files) {
    const page = readContent(file)
    assert.equal(page.data.contentFormat, 'html', file)
    assert.ok(page.htmlFile, file)
    assert.ok(page.data.title && page.data.description, file)
    const info = inspectHtml(page.content.replace(/^<(script|style)\b[^>]*>[\s\S]*?<\/\1>\s*$/gm, ''))
    if (!['home', 'page'].includes(page.data.layout) && !page.data.pdf) assert.ok(info.title, file)
    assert.doesNotMatch(page.content, /<iframe\b/, file)
  }
})
test('HTML renderer preserves scripts, scoped styles, headers and base URLs', () => {
  const env = {}
  const html = md.render(`---\ncontentFormat: html\ntitle: Test\n---\n
<script setup>\nconst count = 1\n</script>

<style scoped>h2 { color: red; }</style>

<article><h1>Title</h1><h2 id="method">Method <a class="header-anchor" href="#method">#</a></h2><h3 id="detail">Detail</h3><a href="/tags">Tags</a><img src="/logo.svg"><img src="./figure.svg"><ClientOnly><TokenDemo /></ClientOnly></article>`, env)
  assert.equal(env.sfcBlocks.scripts.length, 1)
  assert.equal(env.sfcBlocks.styles.length, 1)
  assert.equal(env.headers[0].title, 'Method')
  assert.equal(env.headers[0].children[0].link, '#detail')
  assert.match(html, /href="\/subpath\/tags"/)
  assert.match(html, /:src="&quot;\/subpath\/logo.svg&quot;"/)
  assert.match(html, /src="\.\/figure.svg"/)
  assert.match(html, /<ClientOnly><TokenDemo/)
  assert.doesNotMatch(html, /<script|<style/)
  assert.equal(env.title, 'Title')
})
test('Linux headings and actual content participate in the shared document', () => {
  const { source, content } = readContent('docs/linux-notes/linux-isolation.md')
  const env = {}
  const html = md.render(source.replace(/<!--@include:[\s\S]*?-->/, content), env)
  assert.equal(env.headers.length, 7)
  assert.equal(env.headers[0].link, '#overview')
  assert.ok(env.headers.some(header => header.link === '#commands'))
  assert.match(html, /unshare --user --map-root-user --uts bash/)
  assert.match(html, /<svg/)
})
test('ordinary Markdown retains its existing renderer', () => {
  const env = {}
  assert.match(md.render('# Daily research\n\n## Update\n\nA paragraph.', env), /<h2/)
  assert.notEqual(env.frontmatter.contentFormat, 'html')
})
test('editable HTML formulas compile to accessible static math', () => {
  const env = {}
  const html = md.render('---\ncontentFormat: html\n---\n<h1>Math</h1><span class="math-inline" data-tex="x &lt; y"></span><div class="math-block" data-tex="\\frac{a}{b}"></div>', env)
  assert.equal((html.match(/<mjx-container/g) ?? []).length, 2)
  assert.doesNotMatch(html, /data-mjx-error|data-tex=/)
  assert.match(html, /<mjx-assistive-mml/)
})
