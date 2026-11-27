import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { build } from 'esbuild'
import matter from 'gray-matter'

// Exercise the real catalog transform against repository content without
// starting Vite. Only the framework's loader registration is replaced.
const result = await build({
  stdin: {
    contents: [
      "export * from './docs/.vitepress/data/catalog-source.ts'",
      "export { default as graphLoader } from './docs/.vitepress/data/knowledge-graph.data.mts'",
      "export * from './docs/.vitepress/content-catalog.ts'",
      "export * from './docs/.vitepress/components/home-discovery-data.ts'",
      "export * from './docs/.vitepress/components/grace-home-data.ts'"
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts'
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'loader-registration', setup(build) {
    build.onResolve({ filter: /^vitepress$/ }, () => ({ path: 'vitepress', namespace: 'loader' }))
    build.onLoad({ filter: /.*/, namespace: 'loader' }, () => ({ contents: 'export function createContentLoader(patterns, options) { return { patterns, ...options } }' }))
  } }]
})
const { catalogLoader, graphLoader, searchContent, topicTags, readingSeries, sections, maturities, maturityLabels, isMaturity, getHomeTopics, discoveryGroups, graceColumns, graceIssues, connectedColumns } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
const inputs = readdirSync('docs', { recursive: true }).map(f => f.replaceAll('\\', '/')).filter(f => f.endsWith('.md') && !/^(?:\.vitepress|public)\//.test(f)).map(f => {
  const src = readFileSync('docs/' + f, 'utf8')
  return { src, frontmatter: matter(src).data, url: '/' + f.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '') }
})
const pages = catalogLoader().transform(inputs), documents = catalogLoader(true).transform(inputs)
test('grace day and night offer every direct column, whole research issues and video deep links', () => {
  const columns = graceColumns(pages)
  assert.deepEqual(columns.map(c => c.url), sections.map(s => '/' + s.id + '/'))
  assert.deepEqual(columns.find(c => c.id === 'research').items.map(p => p.url).sort(), graceIssues.map(issue => issue.route).sort())
  assert.ok(columns.find(c => c.id === 'videos').items.every(item => item.url.includes('#BV')))
  const story = pages.find(p => p.url === '/cs336/lecture-05')
  const related = connectedColumns(story, columns, getHomeTopics(pages))
  assert.deepEqual(related.columns.map(c => c.id), ['cuda-notes'])
  assert.ok(graceColumns([]).every(c => !c.items.length))
  assert.deepEqual(connectedColumns({ ...story, tags: [] }, columns, []).columns, [])
})
test('home directory covers each column once and topic readings resolve to public articles', () => {
  assert.deepEqual(discoveryGroups.flatMap(group => group.sectionIds).sort(), sections.map(s => s.id).sort())
  const topics = getHomeTopics(pages)
  assert.deepEqual(topics.map(t => t.key).sort(), ['gpu', 'reward', 'sandbox'])
  for (const topic of topics) {
    assert.equal(topic.readings.length, 3, topic.name)
    assert.ok(new Set(topic.readings.map(r => r.page.section)).size >= 2, topic.name)
  }
  const only = pages.find(p => p.url === '/linux-notes/linux-isolation')
  const sparse = getHomeTopics([only])
  assert.deepEqual(sparse.map(t => t.readings.map(r => r.page)), [[only]])
  assert.equal(sparse[0].deck, '')
  assert.deepEqual(getHomeTopics([]), [])
})
test('one public catalog includes articles and individually addressable videos', () => {
  assert.equal(pages.length, documents.length + 2)
  assert.equal(new Set(pages.map(p => p.url)).size, pages.length)
  assert.ok(pages.length >= 55)
  assert.ok(!pages.some(p => /llm-book|adr|unlisted/.test(p.url)))
  assert.ok(pages.every(p => p.title && p.section && p.description))
  assert.ok(pages.every(p => isMaturity(p.maturity)))
  assert.ok(pages.filter(p => p.kind === '视频').every(p => p.maturity === 'budding'))
  assert.equal(searchContent(pages, documents, '尺度变换')[0].page.url, '/videos/#BV1Meap6cEfd')
})
test('knowledge graph preserves the public catalog and one undirected link per article membership', () => {
  const graph = graphLoader.transform(inputs)
  const nodes = new Map(graph.nodes.map(node => [node.id, node]))
  assert.equal(nodes.size, graph.nodes.length)
  assert.deepEqual(graph.nodes.filter(node => node.kind === 'article').map(node => node.value).sort(),
    pages.map(page => page.url).sort())
  assert.ok(graph.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)))
  const expected = new Map(pages.map(page => [page.url, new Set([
    'section:' + page.section, ...page.tags.map(tag => 'tag:' + tag)
  ])]))
  for (const { source, target } of graph.links) {
    const article = nodes.get(source), related = nodes.get(target)
    assert.equal(article?.kind, 'article')
    assert.ok(related && ['section', 'tag'].includes(related.kind))
    assert.ok(expected.get(article.value).delete(target), source + ' → ' + target)
  }
  assert.ok([...expected.values()].every(targets => targets.size === 0))
  assert.equal(graph.nodes.filter(node => node.kind === 'tag').length, new Set(pages.flatMap(p => p.tags)).size)
  assert.equal(graph.nodes.filter(node => node.kind === 'section').length, new Set(pages.map(p => p.section)).size)
})
test('graph coordinates are deterministic across input order, repeated tags and colliding labels', () => {
  const input = (url, tags) => ({ url, src: '', frontmatter: { title: 'research', tags } })
  const a = input('/cs336/lecture-01', ['research', 'a', 'a'])
  const b = input('/research/2026-11-27-slm-pretraining-2026', ['a'])
  const graph = graphLoader.transform([a, b])
  assert.deepEqual(graphLoader.transform([b, a]), graph)
  assert.ok(graph.nodes.some(node => node.id === 'tag:research' && node.label === 'research'))
  assert.ok(graph.nodes.some(node => node.id === 'section:research' && node.label === '每日调研'))
  assert.equal(graph.links.filter(link => link.source === 'article:' + a.url && link.target === 'tag:a').length, 1)
})
test('explicit maturity takes precedence over research, lecture and study-note defaults', () => {
  assert.deepEqual(maturities.map(maturity => maturityLabels[maturity]), ['幼苗', '成长', '常青'])
  for (const value of [null, {}, 'unknown', '__proto__']) assert.equal(isMaturity(value), false)
  const entries = [
    ['/research/2026-11-27-slm-pretraining-2026', {}, '', 'seedling'],
    ['/cs336/lecture-01', { contentFormat: 'html' }, '', 'evergreen'],
    ['/cs336/lecture-02', {}, '<!--@include: ./lecture-02.html-->', 'evergreen'],
    ['/cs336/lecture-03', { maturity: 'seedling', contentFormat: 'html' }, '', 'seedling'],
    ['/cs336/lecture-04', {}, '# Markdown', 'budding'],
    ['/linux-notes/linux-isolation', { maturity: 'unknown', contentFormat: 'html' }, '', 'budding'],
    ['/cs336/lecture-05', { maturity: 'budding', contentFormat: 'html' }, '', 'budding'],
    ['/cs336/lecture-06', { status: 'draft', maturity: 'evergreen' }, '', undefined]
  ]
  const fixtures = entries.map(([url, fields, src]) => ({ url, src, frontmatter: { title: url, ...fields } }))
  const byUrl = new Map(catalogLoader().transform(fixtures).map(p => [p.url, p.maturity]))
  for (const [url, , , expected] of entries) assert.equal(byUrl.get(url), expected, url)
  const explicitResearch = catalogLoader().transform([{
    url: '/research/2026-11-27-slm-pretraining-2026', src: '',
    frontmatter: { title: 'research', maturity: 'evergreen' }
  }])
  assert.equal(explicitResearch[0].maturity, 'evergreen')
})
test('full text finds commands and groups matches by article with useful context', () => {
  const commands = searchContent(pages, documents, 'unshare --user')
  assert.ok(commands.some(r => r.page.url === '/linux-notes/linux-isolation'))
  const approximation = searchContent(pages, documents, '随机近似')
  assert.ok(approximation.some(r => r.page.kind === '课程讲义'))
  assert.ok(approximation.some(r => r.page.url === '/westlake-rl/随机近似/课程讲义'))
  assert.ok(!pages.some(p => ['/westlake-rl/随机近似/', '/westlake-rl/策略梯度/', '/westlake-rl/价值函数/', '/westlake-rl/TD算法/TD'].includes(p.url)))
  assert.equal(new Set(approximation.map(r => r.page.url)).size, approximation.length)
  assert.ok(approximation.every(r => r.matches.length <= 2))
})
test('research stays newest first by publication date after older reports are edited', () => {
  const research = pages.filter(p => p.section === 'research')
  assert.ok(research.length > 0)
  assert.ok(research.every((p, i) => !i || research[i - 1].updated >= p.updated))
  assert.ok(research.every(p => p.updated === p.url.match(/^\/research\/(\d{4}-\d{2}-\d{2})-/)[1]))
  const oldReport = inputs.find(p => p.url === '/research/2026-11-27-slm-pretraining-2026')
  const edited = catalogLoader().transform([{ ...oldReport, frontmatter: { ...oldReport.frontmatter, updated: '2099-01-01' } }])
  assert.equal(edited.find(p => p.section === 'research').updated, '2026-11-27')
})
test('topic aliases and explicit course order do not create arbitrary sequences', () => {
  assert.deepEqual(topicTags(['Agent', '智能体', '论文精读']), ['智能体'])
  assert.ok(topicTags(['GUI Agent']).includes('智能体'))
  const course = readingSeries.find(s => s.title.includes('课程讲义'))
  assert.equal(course.paths.length, 8)
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
