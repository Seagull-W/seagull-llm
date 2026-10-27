import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readingPages, usesAcademicReading } from './reading-pages.mjs'

test('all public text collections receive academic reading typography', () => {
  const pages = readingPages()
  assert.ok(pages.length >= 71)
  assert.deepEqual([...new Set(pages.map(p => p.path.split('/')[1]))].sort(),
    ['linux-notes', 'papers', 'research', 'rl-book', 'rust-notes', 'westlake-rl'])
  for (const path of ['/westlake-rl/随机近似/课程讲义', '/rl-book/cha6强化学习',
    '/papers/projects/intellect-3/', '/rust-notes/多线程并发编程',
    '/linux-notes/linux-isolation', '/research/2026-10-26-agent-code-review-layers']) {
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
