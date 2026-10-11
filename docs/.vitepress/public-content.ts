import { sidebar } from './sidebar'

interface NavigationItem { link?: string; items?: NavigationItem[] }

export function normalizeContentPath(path: string): string {
  return decodeURIComponent(path.split(/[?#]/)[0])
    .replace(/\.(?:html|md)$/, '').replace(/\/index$/, '').replace(/\/$/, '')
}

const publicPaths = new Set<string>(['/videos'])
function collect(items: NavigationItem[]) {
  for (const item of items) {
    if (item.link) publicPaths.add(normalizeContentPath(item.link))
    if (item.items) collect(item.items)
  }
}
collect(Object.values(sidebar).flat())

// The navigation is the publication boundary; merely having a Markdown file
// must never publish internal notes or unfinished experiments in an index.
export function isPublicContent(path: string, frontmatter: Record<string, any>): boolean {
  const noindex = frontmatter.head?.some((entry: any[]) =>
    entry[0] === 'meta' && entry[1]?.name === 'robots' && /noindex/i.test(entry[1]?.content ?? '')
  )
  return publicPaths.has(normalizeContentPath(path)) &&
    frontmatter.status !== 'draft' && frontmatter.hidden !== true &&
    frontmatter.published !== false && frontmatter.search !== false &&
    !String(frontmatter.pageClass ?? '').split(/\s+/).includes('chapter-index') &&
    frontmatter.layout !== 'home' && !noindex
}
