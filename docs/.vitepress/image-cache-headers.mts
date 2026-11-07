import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

// Public article figures can be replaced under the same URL. Give those a short
// freshness window; hashed theme artwork is covered by the existing /assets rule.
export async function writeImageCacheHeaders(publicDir: string, outDir: string, base: string) {
  const prefix = base.replace(/\/$/, '')
  const patterns = new Set<string>()

  async function visit(directory: string, section = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'assets' && !section) continue
        await visit(join(directory, entry.name), section || entry.name)
      } else if (entry.isFile() && /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(entry.name)) {
        patterns.add(section ? `/${section}/*${extname(entry.name)}` : '/' + entry.name)
      }
    }
  }

  await visit(publicDir)
  const headers = await readFile(join(publicDir, '_headers'), 'utf8')
  const configured = headers.replace(/^\/(?!\/)/gm, prefix + '/').trimEnd()
  const rules = [...patterns].sort().map(pattern => prefix + pattern + '\n  Cache-Control: public, max-age=3600, must-revalidate')
  await writeFile(join(outDir, '_headers'), [configured, ...rules].join('\n\n') + '\n')
}
