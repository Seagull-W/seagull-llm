import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['docs/.vitepress/public-content.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm'
})
const { isPublicContent, normalizeContentPath } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
)

test('published articles and PDF lectures remain discoverable', () => {
  for (const path of ['/llm-book/ch00-overview', '/papers/deepseek-r1/',
    '/rl-book/cha4对话模板与监督微调', '/rl-book/cha6-experiment',
    '/westlake-rl/随机近似/课程讲义', '/rust-notes/多线程并发编程',
    '/papers/projects/mimo-v2-6/', '/papers/projects/miles-glm-5-2/',
    '/papers/projects/intellect-3/', '/papers/projects/deepswe-preview/',
    '/papers/projects/codemidas/', '/papers/engineering/failure-handbook',
    '/papers/evidence/gaps']) {
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
    assert.equal(isPublicContent('/llm-book/ch00-overview', metadata), false)
  }
  assert.equal(isPublicContent('/llm-book/rebuild/how-generation-works', { status: 'draft' }), false)
})

test('encoded routes and Markdown index paths resolve to the same public page', () => {
  assert.equal(normalizeContentPath('/papers/deepseek-r1/index.md'), '/papers/deepseek-r1')
  assert.equal(isPublicContent('/westlake-rl/' + encodeURIComponent('随机近似') + '/index.md', {}), true)
  assert.equal(isPublicContent('/llm-book/ch00-overview.html#overview', {}), true)
})
