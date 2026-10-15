import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import { build } from 'esbuild'
import matter from 'gray-matter'
import { createHash } from 'node:crypto'

const bundled = await build({ entryPoints: ['docs/.vitepress/sidebar.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm' })
const { papersSidebar } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const index = readFileSync('docs/papers/index.md', 'utf8')
const cards = [...index.matchAll(/<ChapterCards :items='([\s\S]*?)'\s*\/>/g)]
  .flatMap(match => JSON.parse(match[1].replaceAll('&#39;', "'")))
const fileFor = route => `docs${route.endsWith('/') ? route + 'index' : route}.md`
const navItems = papersSidebar.flatMap(group => group.items)

test('every paper and project has matching navigation, card and metadata', () => {
  assert.equal(navItems.length, 24)
  assert.equal(cards.length, navItems.length)
  assert.equal(new Set(cards.map(card => card.link)).size, cards.length)
  for (const item of navItems) {
    const card = cards.find(card => card.link === item.link)
    assert.ok(card, item.link)
    const { data, content } = matter(readFileSync(fileFor(item.link), 'utf8'))
    assert.equal(card.title, data.title, item.link)
    assert.equal(card.description, data.description, item.link)
    assert.equal(item.text, data.title, item.link)
    assert.ok(data.tags.includes('论文与项目随谈'), item.link)
    assert.equal((content.match(/^# /gm) ?? []).length, 1, item.link)
    for (const flag of ['hidden', 'search', 'published', 'status']) assert.equal(data[flag], undefined, item.link)
  }
})

test('imported links and images resolve inside the site', () => {
  for (const item of navItems.filter(item => !/^\/papers\/(deepseek-r1|gigpo|graph-gpo)\//.test(item.link))) {
    const source = readFileSync(fileFor(item.link), 'utf8')
    assert.doesNotMatch(source, /D:[/\\]|\.\.\/tmp\//, item.link)
    for (const match of source.matchAll(/!?\[[^\]]*\]\((\/[^)]*)\)/g)) {
      const route = decodeURIComponent(match[1].split('#')[0])
      assert.ok(existsSync(fileFor(route)) || existsSync(`docs/public${route}`), `${item.link}: ${route}`)
    }
  }
})

test('archived dashboard files retain their recorded SHA-256 hashes', () => {
  const directory = 'docs/public/papers/projects/mimo-v2-6/evidence/'
  const manifest = JSON.parse(readFileSync(directory + 'manifest.json', 'utf8'))
  for (const entry of manifest) {
    const bytes = readFileSync(directory + entry.file)
    assert.equal(bytes.length, entry.bytes, entry.file)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file)
  }
})
