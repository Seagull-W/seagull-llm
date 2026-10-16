import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import matter from 'gray-matter'
import { createHash } from 'node:crypto'

const result = await build({ entryPoints: ['docs/.vitepress/public-content.ts', 'docs/.vitepress/research-sidebar.ts'], bundle: true, write: false, outdir: 'unused', platform: 'node', format: 'esm' })
const modules = await Promise.all(result.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const { isPublicContent } = modules.find(module => module.isPublicContent)
const { researchSidebar } = modules.find(module => module.researchSidebar)
const catalog = JSON.parse(await readFile('docs/research/catalog.json', 'utf8'))
const index = await readFile('docs/research/index.md', 'utf8')
const links = researchSidebar.flatMap(group => group.items)
assert.equal(links.length, catalog.length)
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
  assert.ok(links.some(link => link.link === row.route && link.text === row.title))
  assert.ok(index.includes(row.route))
  assert.ok(index.includes(row.title.replaceAll('&', '&amp;').replaceAll('"', '&quot;')))
  assert.equal((content.match(/^# /gm) ?? []).length, 1)
  assert.ok(content.includes('## 来源与阅读范围'))
}
assert.equal(isPublicContent('/research/index', matter(index).data), false)
assert.equal(isPublicContent('/research/unlisted-draft', { status: 'draft', search: false }), false)
console.log(`Research content: ${catalog.length} articles have matching cards, navigation, metadata and public visibility.`)
