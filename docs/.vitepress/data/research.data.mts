import { createContentLoader } from 'vitepress'
import { isPublicContent } from '../public-content'

export interface ResearchIssue {
  title: string
  url: string
  date: string
  description: string
}

declare const data: ResearchIssue[]
export { data }

export default createContentLoader('research/*.md', {
  transform(pages): ResearchIssue[] {
    return pages.filter(page => page.frontmatter.date && isPublicContent(page.url, page.frontmatter))
      .map(({ url, frontmatter }) => ({
        url,
        title: String(frontmatter.title).replace(/^\d{4}-\d{2}-\d{2}\s*/, ''),
        date: String(frontmatter.date).slice(0, 10),
        description: String(frontmatter.description || '')
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url))
  }
})
