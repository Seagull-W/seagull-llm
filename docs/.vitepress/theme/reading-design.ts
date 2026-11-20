import { isPublicContent, normalizeContentPath } from '../public-content'
import { sectionFor } from '../content-catalog'
import { papersSidebar } from '../sidebar'

const paperReading = new Set(papersSidebar.find(group => group.text === '论文精读')?.items
  .map(item => normalizeContentPath(item.link)))

// Use source paths so SSR, client navigation and subdirectory deployments agree.
export function usesAcademicReading(path: string, metadata: Record<string, any>): boolean {
  const section = sectionFor(path)
  return !!section && section.kind !== 'gallery' && isPublicContent(path, metadata)
}

export function usesPaperNotebook(path: string, metadata: Record<string, any>): boolean {
  if (metadata.pdf) return false
  const article = normalizeContentPath(path)
  if (paperReading.has(article)) return isPublicContent(path, metadata)
  return metadata.readingNotes === true &&
    Array.from(paperReading).some(paper => article === paper + '/web' || article.startsWith(paper + '/web/'))
}
