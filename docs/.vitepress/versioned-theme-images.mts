import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { Plugin } from 'vite'
import { graceCharacters, portraitPath } from './components/grace-characters.ts'
import { huntSheetPath, sheets } from './components/pixel-hunt/choreography.ts'
import { styleImageGroups, visualStyles } from './theme/visual-styles.ts'

function registeredImages() {
  const paths = new Set<string>()
  for (const style of Object.values(visualStyles)) {
    for (const group of styleImageGroups(style)) {
      for (const path of Object.values(group)) if (path) paths.add(path)
    }
  }
  for (const character of graceCharacters) paths.add(portraitPath(character))
  for (const sheet of Object.values(sheets)) paths.add(huntSheetPath(sheet))
  return paths
}

export function createThemeImageBuild(publicDir: URL, paths = registeredImages()) {
  let files: Map<string, Buffer> | undefined
  const urls: Record<string, string> = {}

  function collect() {
    if (files) return files
    const assets = new Map<string, Buffer>()
    for (const path of paths) {
      const bytes = readFileSync(new URL(path.slice(1), publicDir))
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
      const ext = extname(path)
      const name = `${basename(path, ext)}.${hash}${ext}`
      urls[path] = '/assets/theme/' + name
      assets.set(name, bytes)
    }
    files = assets
    return files
  }

  return {
    plugin: {
      name: 'seagull-theme-images',
      apply: 'build',
      config() {
        collect()
        return { define: { __SEAGULL_THEME_IMAGES__: JSON.stringify(urls) } }
      }
    } satisfies Plugin,
    pathFor(path: string) {
      collect()
      return urls[path] ?? path
    },
    async write(outDir: string) {
      const assets = collect()
      const target = join(outDir, 'assets', 'theme')
      await mkdir(target, { recursive: true })
      await Promise.all(Array.from(assets, ([name, bytes]) => writeFile(join(target, name), bytes)))
    }
  }
}
