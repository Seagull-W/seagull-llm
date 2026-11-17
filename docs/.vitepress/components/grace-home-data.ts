import { sections, topicTags, type ContentEntry } from '../content-catalog'
import { normalizeContentPath } from '../public-content'
import catalog from '../../research/catalog.json'
import { getHomeTopics } from './home-discovery-data'

export interface GraceHomeColumn {
  id: string
  title: string
  url: string
  items: ContentEntry[]
}

export const graceIssues = [...catalog].sort((a, b) => b.date.localeCompare(a.date))
const issues = new Set(graceIssues.map(issue => normalizeContentPath(issue.route)))

export function graceColumns(pages: ContentEntry[]): GraceHomeColumn[] {
  return sections.map(({ id, title }) => ({
    id, title, url: '/' + id + '/',
    items: pages.filter(page => page.section === id &&
      (id !== 'research' || issues.has(normalizeContentPath(page.url)))),
  }))
}

// Prefer editorial connections. For the rest of the catalog require a shared
// public tag and offer the strongest matching columns, keeping each only once.
export function connectedColumns(story: ContentEntry, columns: GraceHomeColumn[], topics: ReturnType<typeof getHomeTopics>) {
  const topic = topics.find(t => t.readings.some(({ page }) => page.url === story.url))
  const peers = columns.filter(column => column.id !== story.section)
  if (topic) {
    return { label: topic.short, columns: peers.filter(column => topic.readings.some(r => r.page.section === column.id)) }
  }
  const tags = new Set(topicTags(story.tags))
  const ranked = peers.map(column => {
    const matches = column.items.map(item => topicTags(item.tags).filter(tag => tags.has(tag)))
    const strongest = matches.reduce<string[]>((best, match) => match.length > best.length ? match : best, [])
    return { column, strongest }
  }).filter(peer => peer.strongest.length).sort((a, b) => b.strongest.length - a.strongest.length)
  if (!ranked.length) return { label: '', columns: [] }
  const label = ranked[0].strongest[0]
  return { label, columns: ranked.filter(peer => peer.strongest.includes(label)).slice(0, 2).map(peer => peer.column) }
}
