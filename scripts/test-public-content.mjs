import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import matter from 'gray-matter'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['docs/.vitepress/public-content.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm'
})
const { isPublicContent, normalizeContentPath } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
)

test('published articles and PDF lectures remain discoverable', () => {
  for (const path of ['/papers/deepseek-r1/',
    '/rl-book/cha4对话模板与监督微调', '/rl-book/cha6-experiment',
    '/westlake-rl/随机近似/课程讲义', '/rust-notes/多线程并发编程',
    '/papers/projects/mimo-v2-6/', '/papers/projects/miles-glm-5-2/',
    '/papers/projects/intellect-3/', '/papers/projects/deepswe-preview/',
    '/papers/projects/codemidas/', '/papers/engineering/failure-handbook',
    '/papers/evidence/gaps', '/linux-notes/linux-isolation']) {
    assert.equal(isPublicContent(path, {}), true, path)
  }
})

test('internal documents and unlisted experiments never enter the index', () => {
  for (const path of ['/adr/0001-keep-vitepress', '/rl-book/unlisted-experiment',
    '/llm-book/ch03-embedding', '/private/new-note', '/papers/unlisted-project']) {
    assert.equal(isPublicContent(path, {}), false, path)
  }
})

test('visibility flags take precedence over navigation entries', () => {
  for (const metadata of [{ status: 'draft' }, { hidden: true }, { published: false },
    { search: false }, { pageClass: 'chapter-index extra-class' },
    { head: [['meta', { name: 'robots', content: 'noindex, nofollow' }]] }]) {
    assert.equal(isPublicContent('/papers/deepseek-r1/', metadata), false)
  }
  assert.equal(isPublicContent('/llm-book/rebuild/how-generation-works', { status: 'draft' }), false)
})

test('encoded routes and Markdown index paths resolve to the same public page', () => {
  assert.equal(normalizeContentPath('/papers/deepseek-r1/index.md'), '/papers/deepseek-r1')
  assert.equal(isPublicContent('/westlake-rl/' + encodeURIComponent('随机近似') + '/index.md', {}), true)
  assert.equal(isPublicContent('/papers/deepseek-r1/index.html#overview', {}), true)
})

test('the entire LLM book is withdrawn from every public entry point', () => {
  for (const file of readdirSync('docs/llm-book', { recursive: true }).filter(file => file.endsWith('.md'))) {
    const path = '/llm-book/' + file.replaceAll('\\', '/')
    const { data } = matter(readFileSync('docs/llm-book/' + file, 'utf8'))
    assert.equal(isPublicContent(path, {}), false, path)
    assert.equal(data.hidden, true, path)
    assert.equal(data.search, false, path)
    assert.ok(data.head.some(entry => entry[0] === 'meta' && entry[1]?.name === 'robots' && entry[1].content.includes('noindex')))
  }
  assert.doesNotMatch(readFileSync('docs/.vitepress/sidebar.ts', 'utf8'), /llm-book|llmBookSidebar/)
  assert.doesNotMatch(readFileSync('docs/index.md', 'utf8'), /llm-book|科普及实践书/)
  assert.match(readFileSync('docs/.vitepress/config.mts', 'utf8'), /srcExclude: \['llm-book\/\*\*'\]/)
  assert.doesNotMatch(readFileSync('docs/.vitepress/theme/Layout.vue', 'utf8'), /withBase\('\/llm-book/)
})
