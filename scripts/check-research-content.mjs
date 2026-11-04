import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import matter from 'gray-matter'
import { createHash } from 'node:crypto'

const result = await build({ entryPoints: ['docs/.vitepress/public-content.ts', 'docs/.vitepress/research-sidebar.ts'], bundle: true, write: false, outdir: 'unused', platform: 'node', format: 'esm' })
const modules = await Promise.all(result.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const { isPublicContent } = modules.find(module => module.isPublicContent)
const { researchSidebar, researchCards } = modules.find(module => module.researchSidebar)
const catalog = JSON.parse(await readFile('docs/research/catalog.json', 'utf8'))
const index = await readFile('docs/research/index.md', 'utf8')
const links = researchSidebar.flatMap(group => group.items)
assert.equal(links.length, catalog.length)
assert.equal(researchCards.length, catalog.length)
assert.equal(new Set(catalog.map(item => item.route)).size, catalog.length)
for (const row of catalog) {
  const raw = await readFile(`docs${row.route}.md`, 'utf8')
  const { data, content } = matter(raw)
  if (row.delivery) {
    assert.match(row.delivery.acceptance_sha256, /^[a-f0-9]{64}$/)
    assert.match(row.delivery.article_sha256, /^[a-f0-9]{64}$/)
    assert.equal(createHash('sha256').update(raw).digest('hex'), row.delivery.content_sha256,
      `Accepted research content changed: ${row.route}; render and accept it again`)
  }
  assert.equal(data.title, row.title)
  assert.equal(data.description, row.description)
  assert.ok(data.tags.includes('每日调研') || data.tags.includes('调研'))
  assert.equal(isPublicContent(row.route, data), true)
  const link = links.find(item => item.link === row.route)
  assert.equal(link?.text, row.sidebarTitle || row.title, row.route)
  assert.deepEqual(researchCards.find(card => card.link === row.route),
    { title: row.title, link: row.route, description: row.description, label: row.label || row.date })
  for (const child of row.children || []) {
    assert.ok(link.items?.some(item => item.link === child.link && item.text === child.text), child.link)
    const doc = matter(await readFile('docs' + child.link + '.md', 'utf8'))
    assert.ok(isPublicContent(child.link, doc.data), child.link)
  }
  assert.equal((content.match(/^# /gm) ?? []).length, 1)
  assert.ok(content.includes('## 来源与阅读范围'))
}
if (process.argv.includes('--built')) {
  const page = await readFile('docs/.vitepress/dist/research/index.html', 'utf8')
  const cards = [...page.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(([, attrs]) => /\bclass="[^"]*\bchapter-card\b[^"]*"/.test(attrs))
  assert.equal(cards.length, catalog.length, 'Built research cards')
  for (const [i, row] of catalog.entries()) {
    const [, attrs, body] = cards[i]
    const href = attrs.match(/\bhref="([^"]+)"/)?.[1]
    assert.ok(href?.endsWith(row.route), 'Missing or misplaced card: ' + row.route)
    const label = (row.label || row.date).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    assert.ok(body.includes('>' + label + '<'), 'Missing card label: ' + row.route)
  }
}
assert.equal(isPublicContent('/research/index', matter(index).data), false)
assert.equal(isPublicContent('/research/unlisted-draft', { status: 'draft', search: false }), false)
console.log(`Research content: ${catalog.length} articles have matching cards, navigation, metadata and public visibility.`)
