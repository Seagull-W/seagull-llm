import { normalizeContentPath } from './public-content'
import sections from './sections.json'

export { sections }
export const textSections = sections.filter(section => section.kind !== 'gallery')
export interface ContentEntry { title: string; url: string; description: string; tags: string[]; section: string; kind: string; updated: string }
export interface SearchSection { title: string; anchor: string; text: string }
export interface SearchDocument { url: string; sections: SearchSection[] }

// Only explicitly ordered learning sequences get previous/next links.
export const readingSeries = [
  { title: 'RL BOOK · 阅读章节', paths: ['/rl-book/cha4对话模板与监督微调', '/rl-book/cha5奖励建模', '/rl-book/cha6强化学习'] },
  { title: '西湖强化学习 · 课程讲义', paths: [
    '/westlake-rl/强化学习基本概念与贝尔曼方程', '/westlake-rl/最优状态价值与贝尔曼最优方程',
    '/westlake-rl/值迭代与策略迭代', '/westlake-rl/蒙特卡洛方法', '/westlake-rl/随机近似/课程讲义'
  ] },
  { title: 'CS336 · 课程讲义', paths: [
    '/cs336/lecture-01', '/cs336/lecture-02', '/cs336/lecture-03',
    '/cs336/lecture-04', '/cs336/lecture-05', '/cs336/lecture-06'
  ] },
  { title: 'CS336 · 作业与实现', paths: [
    '/cs336/a1-bpe', '/cs336/a1-transformer', '/cs336/a2-benchmark'
  ] }
]
const aliases: Record<string, string> = { agent: '智能体', agents: '智能体', Agent: '智能体', LLM: '大语言模型', '大模型': '大语言模型', SFT: '监督微调' }
const categoryTags = new Set(['每日调研', '论文与项目随谈', '论文精读', '科普视频', 'Rust 学习笔记', 'linux学习笔记', 'Linux 学习笔记', 'RL 学习笔记', '西湖大学强化学习笔记'])
export function normalizeTag(tag: string) { return aliases[tag] || tag }
export function topicTags(tags: string[]) {
  const topics = tags.filter(tag => !categoryTags.has(tag)).map(normalizeTag)
  if (topics.some(tag => /智能体|\bagent(?:ic)?\b/i.test(tag))) topics.push('智能体')
  return [...new Set(topics)]
}
export function sectionFor(url: string) { const path = normalizeContentPath(url); return sections.find(s => path === '/' + s.id || path.startsWith('/' + s.id + '/')) }
export function contextFor(page: ContentEntry) {
  const title = sectionFor(page.url)?.title || ''
  return ['research', 'videos'].includes(page.section) || (title.endsWith('笔记') && page.kind === '学习笔记') ? title : title + ' · ' + page.kind
}
export function kindFor(url: string) {
  const path = normalizeContentPath(url)
  if (path === '/videos') return '视频'
  if (path.startsWith('/cs336/lecture-')) return '课程讲义'
  if (path.startsWith('/cs336/a2-')) return '实验'
  if (readingSeries[1].paths.includes(path)) return '课程讲义'
  if (path.startsWith('/research/')) return '调研'
  if (/^\/papers\/(deepseek-r1|gigpo|graph-gpo|mai-gym)$/.test(path)) return '论文精读'
  if (path.startsWith('/papers/')) return '项目笔记'
  if (/实验|experiment/.test(path)) return '实验'
  return '学习笔记'
}
export function newestFirst(a: ContentEntry, b: ContentEntry) { return b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title, 'zh-CN') }
export function fold(text: string) { return text.toLocaleLowerCase().replace(/\bagents?\b/g, '智能体').replace(/\s+/g, ' ').trim() }
export function queryTerms(query: string) { return fold(query).split(/\s+/).filter(Boolean) }
export function metadataScore(page: ContentEntry, terms: string[]) {
  const title = fold(page.title), description = fold(page.description), tags = fold(page.tags.join(' '))
  return terms.reduce((score, term) => score + (title.includes(term) ? 60 : 0) + (description.includes(term) ? 12 : 0) + (tags.includes(term) ? 20 : 0), 0)
}
export function searchContent(pages: ContentEntry[], documents: SearchDocument[], query: string) {
  const terms = queryTerms(query)
  if (!terms.length) return []
  const bodies = new Map(documents.map(doc => [doc.url, doc.sections]))
  return pages.flatMap(page => {
    const parts = bodies.get(page.url) || []
    const all = fold([page.title, page.description, ...page.tags, ...parts.map(p => p.title + ' ' + p.text)].join(' '))
    if (!terms.every(term => all.includes(term))) return []
    const matches = parts.map(part => ({ ...part, score: terms.reduce((n, term) => n + (fold(part.title).includes(term) ? 15 : 0) + (fold(part.text).includes(term) ? 1 : 0), 0) }))
      .filter(part => part.score > 0).sort((a, b) => b.score - a.score)
    return [{ page, matches: matches.slice(0, 2), score: metadataScore(page, terms) + (matches[0]?.score || 0) }]
  }).sort((a, b) => b.score - a.score || newestFirst(a.page, b.page))
}
export function excerpt(text: string, query: string) {
  const pos = queryTerms(query).map(term => fold(text).indexOf(term)).filter(p => p >= 0).sort((a, b) => a - b)[0] || 0
  const start = Math.max(0, pos - 30)
  return (start ? '…' : '') + text.slice(start, start + 130) + (text.length > start + 130 ? '…' : '')
}
