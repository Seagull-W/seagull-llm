import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { build } from 'esbuild'
import matter from 'gray-matter'

// Exercise the real catalog transform against repository content without
// starting Vite. Only the framework's loader registration is replaced.
const result = await build({
  stdin: { contents: "export * from './docs/.vitepress/data/catalog-source.ts'; export * from './docs/.vitepress/content-catalog.ts'", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'loader-registration', setup(build) {
    build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'loader' }))
    build.onLoad({ filter: /.*/, namespace: 'loader' }, () => ({ contents: 'export function createContentLoader(patterns, options) { return { patterns, ...options } }' }))
  } }]
})
const { catalogLoader, searchContent, topicTags, readingSeries } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
const inputs = readdirSync('docs', { recursive: true }).map(f => f.replaceAll('\\', '/')).filter(f => f.endsWith('.md') && !/^(?:\.vitepress|public)\//.test(f)).map(f => {
  const src = readFileSync('docs/' + f, 'utf8')
  return { src, frontmatter: matter(src).data, url: '/' + f.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '') }
})
const pages = catalogLoader().transform(inputs), documents = catalogLoader(true).transform(inputs)
test('one public catalog includes articles and individually addressable videos', () => {
  assert.equal(pages.length, documents.length + 2)
  assert.equal(new Set(pages.map(p => p.url)).size, pages.length)
  assert.ok(pages.length >= 79)
  assert.ok(!pages.some(p => /llm-book|adr|unlisted/.test(p.url)))
  assert.ok(pages.every(p => p.title && p.section && p.description))
  assert.equal(searchContent(pages, documents, '尺度变换')[0].page.url, '/videos/#BV1Meap6cEfd')
})
test('full text finds commands and groups matches by article with useful context', () => {
  const commands = searchContent(pages, documents, 'unshare --user')
  assert.ok(commands.some(r => r.page.url === '/linux-notes/linux-isolation'))
  const approximation = searchContent(pages, documents, '随机近似')
  assert.ok(approximation.some(r => r.page.kind === '课程讲义'))
  assert.ok(approximation.some(r => r.page.kind === '学习笔记'))
  assert.equal(new Set(approximation.map(r => r.page.url)).size, approximation.length)
  assert.ok(approximation.every(r => r.matches.length <= 2))
})
test('topic aliases and explicit course order do not create arbitrary sequences', () => {
  assert.deepEqual(topicTags(['Agent', '智能体', '论文精读']), ['智能体'])
  assert.ok(topicTags(['GUI Agent']).includes('智能体'))
  const course = readingSeries.find(s => s.title.includes('课程讲义'))
  assert.equal(course.paths.length, 5)
  assert.ok(!course.paths.includes('/westlake-rl/策略梯度'))
  assert.ok(!readingSeries.some(s => s.paths.some(p => p.startsWith('/papers/'))))
})
if (process.argv.includes('--built')) test('every search passage points to an actual built heading', () => {
  for (const doc of documents) {
    const file = 'docs/.vitepress/dist' + doc.url + (doc.url.endsWith('/') ? 'index.html' : '.html')
    assert.ok(existsSync(file), file)
    const html = readFileSync(file, 'utf8')
    for (const part of doc.sections.filter(p => p.anchor)) assert.ok(html.includes('id="' + part.anchor.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '"'), doc.url + '#' + part.anchor)
  }
})
