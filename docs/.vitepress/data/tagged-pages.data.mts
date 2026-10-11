import { createContentLoader } from 'vitepress'
import { isPublicContent } from '../public-content'

export interface TaggedPage {
  title: string
  url: string
  description: string
  tags: string[]
}
declare const data: TaggedPage[]
export { data }

export default createContentLoader('**/*.md', {
  includeSrc: true,
  transform(pages): TaggedPage[] {
    return pages.filter(page =>
      Array.isArray(page.frontmatter.tags) && isPublicContent(page.url, page.frontmatter)
    ).map(page => {
      const source = (page.src ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
      const fallbackTitle = decodeURIComponent(page.url.split('/').filter(Boolean).pop() ?? '').replace(/\.html$/, '')
      const title = page.frontmatter.title || source.match(/^#{1,6}\s+(.+)$/m)?.[1] || fallbackTitle
      const paragraph = source.replace(/<script\b[\s\S]*?<\/script>/g, '')
        .replace(/```[\s\S]*?```/g, '').split(/\r?\n\s*\r?\n/)
        .find(block => /^[\p{L}\p{N}*]/u.test(block.trim()) && !block.trim().startsWith('tags:')) ?? ''
      const description = String(page.frontmatter.description || paragraph)
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`#]/g, '')
        .replace(/\s+/g, ' ').trim().slice(0, 120)
      return { title: String(title), url: page.url, description, tags: page.frontmatter.tags.filter((tag: unknown) => typeof tag === 'string') }
    }).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }
})
