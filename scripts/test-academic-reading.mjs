import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { readContent } from './content-source.mjs'
import { readingPages, supportsHtmlNotebook, usesAcademicReading, usesPaperNotebook } from './reading-pages.mjs'

test('all public text collections receive academic reading typography', () => {
  const pages = readingPages()
  assert.ok(pages.length >= 50)
  const sections = JSON.parse(readFileSync('docs/.vitepress/sections.json', 'utf8'))
  const textSections = sections.filter(s => s.kind !== 'gallery')
  assert.deepEqual([...new Set(pages.map(p => p.path.split('/')[1]))].sort(), textSections.map(s => s.id).sort())
  for (const path of ['/westlake-rl/随机近似/课程讲义', '/rl-book/cha6强化学习',
    '/papers/projects/intellect-3/', '/rust-notes/多线程并发编程',
    '/linux-notes/linux-isolation', '/research/2026-11-27-slm-pretraining-2026']) {
    assert.equal(usesAcademicReading(path, {}), true, path)
  }
})

test('directories, non-article pages and private content keep their own presentation', () => {
  for (const [path, data] of [
    ['/', { layout: 'home' }], ['/tags', {}], ['/videos/', {}],
    ['/papers/', { pageClass: 'chapter-index' }], ['/rl-book/', { pageClass: 'chapter-index' }],
    ['/llm-book/ch01-what-is-lm', {}], ['/adr/0001-keep-vitepress', {}],
    ['/papers/unlisted', {}], ['/papers/deepseek-r1/', { hidden: true }],
    ['/papers/deepseek-r1/', { status: 'draft' }], ['/papers/deepseek-r1/', { search: false }]
  ]) assert.equal(usesAcademicReading(path, data), false, path)
})

test('HTML annotations follow the page type even when an article is named index.md', () => {
  for (const [file, expected] of [
    ['datawhale-agentic-rl/index.md', false], ['datawhale-agentic-rl/task-01.md', true],
    ['research/index.md', false], ['tags.md', false], ['videos/index.md', false],
    ['papers/deepseek-r1/index.md', true], ['papers/agentic-rl-survey/index.md', false],
  ]) {
    assert.equal(supportsHtmlNotebook(readContent('docs/' + file).data), expected, file)
  }
  const directory = { pageClass: 'native-html-page chapter-index', readingNotes: true }
  assert.equal(supportsHtmlNotebook(directory), false)
  assert.equal(usesPaperNotebook('/papers/agentic-rl-survey/web/index.md', directory), false)
})

test('survey web chapters use docked annotations and keep a single catalog entry', () => {
  const route = '/papers/agentic-rl-survey/web'
  const directory = 'docs' + route
  const chapters = readdirSync(directory).filter(file => file.endsWith('.md'))
  assert.ok(chapters.length > 1)
  for (const file of chapters) {
    const { data } = readContent(directory + '/' + file)
    assert.equal(data.readingNotes, true, file)
    assert.equal(data.search, false, file)
    assert.equal(data.pdf, undefined, file)
    assert.equal(usesPaperNotebook(route + '/' + file, data), true, file)
  }
})

test('docked notebooks follow the paper close-reading group', () => {
  assert.equal(usesPaperNotebook('/papers/deepseek-r1/index.md', {}), true)
  assert.equal(usesPaperNotebook('/papers/agentic-rl-survey/', { pdf: true }), false)
  assert.equal(usesPaperNotebook('/papers/projects/coverage', {}), false)
})
