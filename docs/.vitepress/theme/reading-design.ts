import { isPublicContent, normalizeContentPath } from '../public-content'

const readingSections = new Set(['papers', 'rl-book', 'westlake-rl', 'rust-notes', 'linux-notes', 'research'])

// Use source paths so SSR, client navigation and subdirectory deployments agree.
export function usesAcademicReading(path: string, metadata: Record<string, any>): boolean {
  const section = normalizeContentPath(path).split('/')[1]
  return readingSections.has(section) && isPublicContent(path, metadata)
}
