import { isPublicContent } from '../public-content'
import { sectionFor } from '../content-catalog'

// Use source paths so SSR, client navigation and subdirectory deployments agree.
export function usesAcademicReading(path: string, metadata: Record<string, any>): boolean {
  const section = sectionFor(path)
  return !!section && section.kind !== 'gallery' && isPublicContent(path, metadata)
}
