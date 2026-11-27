import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import matter from 'gray-matter'
import { ssrInterpolate } from 'vue/server-renderer'
import { createHash } from 'node:crypto'
import { readContent } from './content-source.mjs'

const result = await build({ entryPoints: ['docs/.vitepress/public-content.ts', 'docs/.vitepress/research-sidebar.ts'], bundle: true, write: false, outdir: 'unused', platform: 'node', format: 'esm' })
const modules = await Promise.all(result.outputFiles.map(file => import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`)))
const { isPublicContent } = modules.find(module => module.isPublicContent)
const { researchSidebar, researchCards, featuredResearchCards } = modules.find(module => module.researchSidebar)
const catalog = JSON.parse(await readFile('docs/research/catalog.json', 'utf8'))
const newestFirst = [...catalog].sort((a, b) => b.date.localeCompare(a.date))
const expectedRoutes = newestFirst.map(row => row.route)
const index = await readFile('docs/research/index.md', 'utf8')
for (const row of catalog) {
  if ('featured' in row) assert.equal(typeof row.featured, 'boolean', `${row.route}: featured must be a boolean`)
  if ('featuredNote' in row) assert.ok(typeof row.featuredNote === 'string' && row.featuredNote.trim(),
    `${row.route}: featuredNote must be a non-empty string`)
}
const featuredRows = newestFirst.filter(row => row.featured === true)
const featuredRoutes = featuredRows.map(row => row.route)
assert.deepEqual(researchSidebar.map(group => group.text), featuredRows.length ? ['精选调研', '全部调研'] : ['每日调研'])
const links = researchSidebar.at(-1).items
assert.deepEqual(links.map(item => item.link), expectedRoutes)
if (featuredRows.length) {
  assert.deepEqual(researchSidebar[0].items, links.filter(item => featuredRoutes.includes(item.link)))
}
assert.deepEqual(researchCards.map(card => card.link), expectedRoutes)
assert.deepEqual(featuredResearchCards.map(card => card.link), featuredRoutes)
assert.deepEqual(featuredResearchCards, researchCards.filter(card => card.featured === true))
assert.equal(new Set(catalog.map(item => item.route)).size, catalog.length)
for (const row of catalog) {
  const filePath = `docs${row.route}.md`
  const raw = await readFile(filePath, 'utf8')
  const { data, content } = readContent(filePath)
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
    { title: row.title, link: row.route, description: row.description, label: row.label || row.date,
      date: row.date, featured: row.featured ?? false, featuredNote: row.featuredNote })
  for (const child of row.children || []) {
    assert.ok(link.items?.some(item => item.link === child.link && item.text === child.text), child.link)
    const doc = matter(await readFile('docs' + child.link + '.md', 'utf8'))
    assert.ok(isPublicContent(child.link, doc.data), child.link)
  }
  if (data.contentFormat === 'html') {
    assert.equal((content.match(/<h1\b/gi) ?? []).length, 1, row.route)
    assert.ok(content.includes('来源与阅读范围'), row.route)
  } else {
    assert.equal((content.match(/^# /gm) ?? []).length, 1, row.route)
    assert.ok(content.includes('## 来源与阅读范围'), row.route)
  }
}
if (process.argv.includes('--built')) {
  const page = await readFile('docs/.vitepress/dist/research/index.html', 'utf8')
  const anchors = [...page.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
  for (const [className, rows] of [['chapter-card', newestFirst], ['featured-card', featuredRows]]) {
    const cards = anchors.filter(([, attrs]) => attrs.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/).includes(className))
    assert.equal(cards.length, rows.length, 'Built ' + className + ' count')
    for (const [i, row] of rows.entries()) {
      const [, attrs, body] = cards[i]
      const href = attrs.match(/\bhref="([^"]+)"/)?.[1]
      assert.ok(href?.endsWith(row.route), 'Missing or misplaced card: ' + row.route)
      if (className === 'chapter-card') {
        assert.ok(body.includes('>' + ssrInterpolate(row.label || row.date) + '<'), 'Missing card label: ' + row.route)
        assert.equal(body.includes('class="chapter-card-featured"'), row.featured === true, 'Featured badge: ' + row.route)
      } else {
        assert.ok(body.includes('>' + ssrInterpolate(row.featuredNote || row.description) + '<'), 'Featured note: ' + row.route)
        assert.ok(body.includes('datetime="' + row.date + '"'), 'Featured date: ' + row.route)
      }
    }
  }
  assert.equal(page.includes('class="research-filter"'), featuredRows.length > 0, 'Featured filter visibility')
}
assert.equal(isPublicContent('/research/index', matter(index).data), false)
assert.equal(isPublicContent('/research/unlisted-draft', { status: 'draft', search: false }), false)
console.log(`Research content: ${catalog.length} articles have matching cards, navigation, metadata and public visibility.`)
