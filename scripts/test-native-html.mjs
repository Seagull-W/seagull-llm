import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import { readContent } from './content-source.mjs'
import nativeHtml, { inspectHtml } from '../docs/.vitepress/markdown/native-html.mjs'
import { readPdfLocation } from '../docs/.vitepress/pdf-links.mjs'

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
test('PDF reading links retain source, initial page and deployment base in HTML and Markdown', () => {
  const sources = [
    '---\ncontentFormat: html\n---\n<a href="https://arxiv.org/pdf/2504.07912v2#page=17">论文</a>',
    '[论文](https://arxiv.org/pdf/2504.07912v2#page=17)'
  ]
  for (const source of sources) {
    const html = md.render(source, { path: resolve('docs/research/sample.md') })
    const href = html.match(/href="(\/subpath\/pdf\/#[^"]+)"/)?.[1]
    assert.ok(href, html)
    const entry = readPdfLocation(href.slice(href.indexOf('#')).replaceAll('&amp;', '&'))
    assert.equal(entry.src, 'https://arxiv.org/pdf/2504.07912v2')
    assert.equal(entry.from, '/research/sample')
    assert.equal(entry.page, 17)
  }
  const html = md.render('---\ncontentFormat: html\n---\n<a href="./a.pdf">读</a> <a download href="./a.pdf">存</a> <a href="./article">正文</a>', { path: resolve('docs/papers/sample/index.md') })
  assert.match(html, /href="\/subpath\/pdf\/#file=%2Fpapers%2Fsample%2Fa.pdf&amp;from=%2Fpapers%2Fsample%2F"/)
  assert.match(html, /<a download href="\.\/a.pdf"/)
  assert.match(html, /href="\.\/article"/)
  const mirror = readPdfLocation('#' + new URLSearchParams({ file:'https://github.com/stanford-cs336/lectures/blob/main/lecture_03.pdf', from:'//example.org/' }))
  assert.equal(mirror.src, '/cs336/sources/lectures/lecture_03.pdf')
  assert.equal(mirror.from, '/papers/')
  for (const file of ['javascript:example.pdf', '//example.org/a.pdf', '/a.html', '']) {
    assert.equal(readPdfLocation('#' + new URLSearchParams({ file })), undefined)
  }
})
test('native figures reserve their size and bare table rows hydrate consistently', () => {
  const html = md.render('---\ncontentFormat: html\n---\n<h1>Example</h1><img src="./figures/RLInfra.png"><table><tr><th>列</th></tr><tr><td>数据</td></tr></table>', { path: resolve('docs/papers/deepseek-r1/index.md') })
  assert.match(html, /loading="lazy" decoding="async" width="1800" height="902"/)
  assert.match(html, /<table><tbody><tr><th>列<\/th><\/tr><tr><td>数据<\/td><\/tr><\/tbody><\/table>/)
})
test('editable HTML formulas compile to accessible static math', () => {
  const env = {}
  const html = md.render('---\ncontentFormat: html\n---\n<h1>Math</h1><span class="math-inline" data-tex="x &lt; y"></span><div class="math-block" data-tex="\\frac{a}{b}"></div>', env)
  assert.equal((html.match(/<mjx-container/g) ?? []).length, 2)
  assert.doesNotMatch(html, /data-mjx-error|data-tex=/)
  assert.match(html, /<mjx-assistive-mml/)
  const subscript = md.render('---\ncontentFormat: html\n---\n<span class="math-inline" data-tex="p_i"></span>', {})
  assert.match(subscript, /--math-baseline:-[\d.]+ex/)
  assert.match(md.render('Inline $p_i$ in an ordinary Markdown article.', {}), /--math-baseline:-[\d.]+ex/)
})

test('visible notebooks have editorial structure, usable anchors and clean summaries', () => {
  let diagrams = 0
  let disclosures = 0
  for (const file of files.filter(file => /[/\\](?:papers|rl-book|westlake-rl|rust-notes|linux-notes)[/\\]/.test(file))) {
    const { data, content } = readContent(file)
    if (data.pdf) {
      assert.equal(data.layout, false, file)
      assert.match(content, /<PdfViewer\b/, file)
      assert.doesNotMatch(content, /note-hero|<ClientOnly>/, file)
      continue
    }
    if (content.includes('format-system')) continue // bespoke Linux reference
    assert.match(content, /data-design="linux-notebook"/, file)
    if (String(data.pageClass || '').split(/\s+/).includes('chapter-index')) {
      assert.match(content, /<DirectoryIntro\b[^>]*class="note-hero"/, file)
    } else {
      assert.match(content, /class="document-intro note-hero(?:\s+[^"]*)?"/, file)
    }
    assert.match(content, /class="document-section note-panel"/, file)
    assert.doesNotMatch(data.description, /ZeroWidthSpace/, file)
    const ids = [...content.matchAll(/<h[1-6]\b[^>]*id="([^"]+)"/g)].map(match => match[1])
    assert.equal(ids.length, new Set(ids).size, file)
    for (const match of content.matchAll(/<section class="document-section note-panel" aria-labelledby="([^"]+)"/g)) {
      assert.ok(ids.includes(match[1]), `${file}: ${match[1]}`)
    }
    // Equations and figures can also be valid fragment targets.
    const anchorIds = [...content.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    assert.equal(anchorIds.length, new Set(anchorIds).size, `${file}: duplicate anchor`)
    for (const match of content.matchAll(/href="#([^"]+)"/g)) assert.ok(anchorIds.includes(match[1]), `${file}: ${match[1]}`)
    diagrams += (content.match(/<figure class="note-diagram/g) ?? []).length
    disclosures += (content.match(/<details class="note-details"/g) ?? []).length
  }
  assert.ok(diagrams >= 29, 'article-specific concept maps')
  assert.ok(disclosures >= 14, 'long implementations remain available through native details')
})
