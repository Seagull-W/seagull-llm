import { readdirSync } from 'node:fs'
import { build } from 'esbuild'
import { readContent } from './content-source.mjs'

const compiled = await build({
  entryPoints: ['docs/.vitepress/theme/reading-design.ts'], bundle: true,
  write: false, platform: 'node', format: 'esm'
})
export const { usesAcademicReading } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)

export function readingPages() {
  return readdirSync('docs', { recursive: true })
    .filter(file => file.endsWith('.md') && !/^(?:\.vitepress|public|llm-book|adr)[/\\]/.test(file))
    .map(file => {
      const path = '/' + file.replaceAll('\\', '/')
      return { path, file: 'docs/' + file, ...readContent('docs/' + file) }
    })
    .filter(page => usesAcademicReading(page.path, page.data))
}
