import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { runInNewContext } from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { closingImageFor, gracePortraitMedia, heroImageFor, heroMediaFor, pageArtPreload, visualStyles, resolveVisualStyle, visualStyleBoot } from '../docs/.vitepress/theme/visual-styles.ts'
import { pixelArtPalettes, pixelDaylightMatrix } from '../docs/.vitepress/theme/pixel-daylight.ts'
import { pixelSectionArtwork } from '../docs/.vitepress/components/section-artwork.ts'
import { graceParties, graceCharacterFor, graceReadingPortraits, readingPortraitFor, portraitPath } from '../docs/.vitepress/components/grace-characters.ts'
import { huntSheetPath, sheets } from '../docs/.vitepress/components/pixel-hunt/choreography.ts'
import { createThemeImageBuild } from '../docs/.vitepress/versioned-theme-images.mts'
import { writeImageCacheHeaders } from '../docs/.vitepress/image-cache-headers.mts'

test('Pages cache rules give public figures a short lifetime and leave reader pages alone', async t => {
  const publicDir = fileURLToPath(new URL('../docs/public/', import.meta.url))
  const outDir = await mkdtemp(join(tmpdir(), 'seagull-header-test-'))
  t.after(() => rm(outDir, { recursive: true, force: true }))
  for (const base of ['/', '/seagull-llm/']) {
    await writeImageCacheHeaders(publicDir, outDir, base)
    const blocks = (await readFile(join(outDir, '_headers'), 'utf8')).trim().split(/\r?\n\s*\r?\n/)
    const rules = new Map(blocks.map(block => block.split(/\r?\n\s+/)))
    assert.equal(rules.get(base + 'assets/*'), 'Cache-Control: public, max-age=31536000, immutable')
    assert.equal(rules.get(base + 'research/*.png'), 'Cache-Control: public, max-age=3600, must-revalidate')
    for (const path of rules.keys()) {
      assert.ok(path.startsWith(base))
      if (path !== base + 'assets/*') assert.match(path, /\.(png|jpe?g|webp|svg|gif|avif)$/i)
    }
  }
})

test('production image URLs match their emitted content, including portraits, sprites and early preloads', async t => {
  const publicDir = new URL('../docs/public/', import.meta.url)
  const build = createThemeImageBuild(publicDir)
  const outDir = await mkdtemp(join(tmpdir(), 'seagull-theme-output-'))
  t.after(() => rm(outDir, { recursive: true, force: true }))
  await build.write(outDir)
  const paths = [
    ...Object.values(visualStyles).flatMap(style => [
      ...Object.values(style.assets), ...Object.values(style.icons || {}), ...Object.values(style.sectionArt || {}),
      ...Object.values(style.sectionPhotos || {}).flatMap(Object.values)
    ]),
    ...graceParties.flat().map(portraitPath), ...Object.values(graceReadingPortraits).flat(),
    ...Object.values(sheets).map(huntSheetPath)
  ]
  for (const path of new Set(paths)) {
    const source = await readFile(new URL(path.slice(1), publicDir))
    const digest = createHash('sha256').update(source).digest('hex').slice(0, 16)
    const url = build.pathFor(path)
    assert.ok(url.startsWith('/assets/theme/') && url.includes('.' + digest + '.'), path)
    assert.deepEqual(await readFile(join(outDir, url.slice(1))), source)
  }
  const mobile = visualStyles['grace-archive'].assets.mobileDark
  for (const base of ['/', '/seagull-llm/']) {
    const links = []
    runInNewContext(pageArtPreload(base, build.pathFor), {
      document: { createElement: () => ({}), head: { appendChild: link => links.push(link) } },
      localStorage: { getItem: key => key === 'seagull-visual-style' ? 'grace-archive' : 'dark' },
      matchMedia: query => ({ matches: query === gracePortraitMedia })
    })
    assert.equal(links[0].href, base + build.pathFor(mobile).slice(1))
  }
})

test('only the changed image acquires a new cache URL at the next build', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'seagull-theme-input-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const paths = new Set(['/scene.webp', '/portrait.webp'])
  const publicDir = pathToFileURL(dir + sep)
  await writeFile(join(dir, 'scene.webp'), 'scene one')
  await writeFile(join(dir, 'portrait.webp'), 'portrait')
  const first = createThemeImageBuild(publicDir, paths)
  const originalScene = first.pathFor('/scene.webp')
  await writeFile(join(dir, 'scene.webp'), 'scene two')
  const second = createThemeImageBuild(publicDir, paths)
  assert.notEqual(second.pathFor('/scene.webp'), originalScene)
  assert.equal(second.pathFor('/portrait.webp'), first.pathFor('/portrait.webp'))
})

test('every style has deployable assets, including all category illustrations and icons', () => {
  for (const style of Object.values(visualStyles)) {
    for (const asset of [...Object.values(style.assets), ...Object.values(style.icons || {}), ...Object.values(style.sectionArt || {}), ...Object.values(style.sectionPhotos || {}).flatMap(Object.values)]) {
      assert.ok(existsSync(new URL('../docs/public' + asset, import.meta.url)), asset)
    }
  }
  for (const section of ['cs336', 'rl-book', 'westlake-rl', 'papers', 'research', 'rust-notes', 'linux-notes', 'tags']) {
    assert.ok(visualStyles['pixel-voyage'].sectionArt[section], section)
    assert.ok(visualStyles['pixel-voyage'].icons[section], section)
  }
})

test('every grace portrait belongs to a pair and has a deployable transparent image', async () => {
  for (const party of graceParties) {
    assert.equal(party.length, 2)
    for (const character of party) {
      assert.equal(graceCharacterFor(character.section), character)
      const path = new URL('../docs/public' + portraitPath(character), import.meta.url)
      const metadata = await sharp(fileURLToPath(path)).metadata()
      assert.equal(metadata.hasAlpha, true, character.name)
    }
  }
  assert.equal(graceCharacterFor('future-section'), graceParties[0][0])
})

test('first paint restores only valid styles and tolerates unavailable storage', () => {
  for (const value of [...Object.keys(visualStyles), 'old-theme', '__proto__', 'toString', null]) {
    const document = { documentElement: { dataset: {} } }
    runInNewContext(visualStyleBoot, { document, localStorage: { getItem: () => value } })
    assert.equal(document.documentElement.dataset.visualStyle, resolveVisualStyle(value))
  }
  const document = { documentElement: { dataset: {} } }
  runInNewContext(visualStyleBoot, { document, localStorage: { getItem() { throw new Error('blocked') } } })
  assert.equal(document.documentElement.dataset.visualStyle, 'paper-coast')
})

test('the home head preloads exactly the picture selected for the saved style, screen and appearance', () => {
  for (const base of ['/', '/seagull-llm/']) {
    for (const style of Object.values(visualStyles)) {
      for (const mobile of [false, true]) for (const dark of [false, true]) {
        const links = []
        const document = { createElement: name => ({ name }), head: { appendChild: link => links.push(link) } }
        const localStorage = { getItem: key => key === 'seagull-visual-style' ? style.id : dark ? 'dark' : 'light' }
        runInNewContext(pageArtPreload(base), { document, localStorage, matchMedia: query => ({ matches: query === heroMediaFor(style) && mobile }) })
        assert.equal(links.length, 1)
        assert.equal(links[0].rel, 'preload')
        assert.equal(links[0].as, 'image')
        const asset = mobile ? (dark && style.assets.mobileDark || style.assets.mobile) : (dark ? style.assets.heroDark : style.assets.heroLight)
        assert.equal(heroImageFor(style, dark, mobile), asset)
        assert.equal(links[0].href, base + asset.slice(1))
      }
    }
  }
})

test('first visit preloads the system appearance even if storage is unavailable', () => {
  for (const getItem of [() => null, () => { throw new Error('blocked') }, key => key === 'seagull-visual-style' ? '__proto__' : 'auto']) {
    const links = []
    const document = { createElement: () => ({}), head: { appendChild: link => links.push(link) } }
    runInNewContext(pageArtPreload('/'), {
      document, localStorage: { getItem }, matchMedia: query => ({ matches: query === '(prefers-color-scheme: dark)' }),
    })
    assert.deepEqual(links.map(link => link.href), [visualStyles['paper-coast'].assets.heroDark])
  }
})

test('only the Elden Ring edition fetches a landscape on a direct visit to an article', () => {
  const preload = pageArtPreload('/', path => path, false)
  for (const style of Object.values(visualStyles)) {
    const links = []
    runInNewContext(preload, {
      document: { createElement: () => ({}), head: { appendChild: link => links.push(link.href) } },
      localStorage: { getItem: key => key === 'seagull-visual-style' ? style.id : 'light' },
      matchMedia: query => ({ matches: query === gracePortraitMedia }),
    })
    assert.deepEqual(links, style.iconSet === 'grace' ? [style.assets.mobile] : [])
  }
})

test('both reading appearances cycle through all five distinct cutouts on the same article', async () => {
  const all = new Set(Object.values(graceReadingPortraits).flat())
  assert.equal(all.size, 5)
  for (const dark of [false, true]) {
    const group = dark ? graceReadingPortraits.night : graceReadingPortraits.day
    const sequence = group.map((_, round) => readingPortraitFor('cs336/lecture-01.md', dark, round))
    assert.deepEqual(new Set(sequence), new Set(group))
    assert.equal(readingPortraitFor('cs336/lecture-01.md', dark, group.length), sequence[0])
  }
  for (const asset of all) {
    const image = sharp(fileURLToPath(new URL('../docs/public' + asset, import.meta.url)))
    const { width, height, hasAlpha } = await image.metadata()
    assert.ok(hasAlpha && height > width, asset)
    const { min, max } = (await image.stats()).channels[3]
    assert.deepEqual([min, max], [0, 255], asset)
  }
})

test('the pixel homepage uses its landscape and portrait mountain crops in both appearances', async () => {
  const style = visualStyles['pixel-voyage']
  assert.notEqual(style.assets.heroLight, style.assets.mobile)
  for (const mobile of [false, true]) {
    const crop = heroImageFor(style, false, mobile)
    assert.equal(heroImageFor(style, true, mobile), crop)
    const image = await sharp(fileURLToPath(new URL('../docs/public' + crop, import.meta.url))).metadata()
    assert.deepEqual([image.width, image.height], mobile ? [1086, 1448] : [1838, 856])
  }
})

test('each public section and the tag index has a distinct visible pixel silhouette', async () => {
  const sections = JSON.parse(await readFile(new URL('../docs/.vitepress/sections.json', import.meta.url), 'utf8'))
  const silhouettes = new Set()
  for (const id of [...sections.map(section => section.id), 'tags']) {
    const layers = pixelSectionArtwork[id]
    assert.ok(layers?.length, id)
    const paths = layers.filter(layer => layer.tone !== 'ground').map(layer => `<path d="${layer.d}"/>`).join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="44" shape-rendering="crispEdges">${paths}</svg>`
    const mask = await sharp(Buffer.from(svg)).ensureAlpha().extractChannel('alpha').raw().toBuffer()
    assert.ok(mask.includes(255) && mask.includes(0), id)
    const shape = mask.toString('base64')
    assert.ok(!silhouettes.has(shape), `Duplicate section silhouette: ${id}`)
    silhouettes.add(shape)
  }
})

test('fallback pixel icons retain their native 32px grid and binary transparency', async () => {
  for (const asset of Object.values(visualStyles['pixel-voyage'].icons)) {
    const image = sharp(fileURLToPath(new URL('../docs/public' + asset, import.meta.url)))
    const metadata = await image.metadata()
    assert.equal(metadata.width, 32, asset)
    assert.equal(metadata.height, 32, asset)
    const pixels = await image.ensureAlpha().raw().toBuffer()
    for (let i = 3; i < pixels.length; i += 4) assert.ok(pixels[i] === 0 || pixels[i] === 255, asset)
  }
})

test('pixel bitmap filters map all four pigments to day and night colors and preserve alpha', () => {
  const matrix = pixelDaylightMatrix.split(' ').map(Number)
  const rgb = hex => hex.match(/../g).map(v => parseInt(v, 16) / 255)
  const pigments = [
    ['26364a', 'ece9df', 'eaf1f9', '1b304a'],
    ['79a99b', '698f82', '6388ad', '729bc8'],
    ['f2c690', 'b57c3b', 'a97036', 'e0af77'],
    ['f6f1e7', '26364a', '213f69', 'e6f1ff'],
  ]
  for (const [source, calibrated, day, night] of pigments) {
    for (const alpha of [0, 0.5, 1]) {
      const input = [...rgb(source), alpha, 1]
      const output = [0, 1, 2, 3].map(row =>
        input.reduce((sum, value, col) => sum + value * matrix[row * 5 + col], 0))
      for (const [row, channel] of [...rgb(calibrated), alpha].entries()) {
        assert.ok(Math.abs(output[row] - channel) < 0.00001, `${source}, row ${row}`)
      }
      for (const [filter, target] of [['pixel-daylight', day], ['pixel-night', night]]) {
        const mapped = pixelArtPalettes[filter].map((table, channel) => {
          const values = table.split(' ').map(Number)
          return values[Math.floor(output[channel] * values.length)]
        })
        assert.deepEqual(mapped, rgb(target), `${filter}: ${source}`)
      }
    }
  }
})

test('each closing scene has a distinct day and night artwork on both screen sizes', () => {
  for (const style of Object.values(visualStyles)) {
    for (const mobile of [false, true]) {
      const day = closingImageFor(style, false, mobile)
      const night = closingImageFor(style, true, mobile)
      assert.notEqual(day, night, style.name)
      assert.ok(existsSync(new URL('../docs/public' + day, import.meta.url)), day)
      assert.ok(existsSync(new URL('../docs/public' + night, import.meta.url)), night)
    }
  }
})

test('all pixel fallback bitmaps use the four supported source pigments', async () => {
  const style = visualStyles['pixel-voyage']
  const assets = new Set([...Object.values(style.icons), ...Object.values(style.sectionArt)])
  const palette = new Set(['26364a', '79a99b', 'f2c690', 'f6f1e7'])
  for (const asset of assets) {
    const pixels = await sharp(fileURLToPath(new URL('../docs/public' + asset, import.meta.url))).ensureAlpha().raw().toBuffer()
    const colors = new Set()
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]) colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2])
    }
    for (const color of colors) assert.ok(palette.has(color.toString(16).padStart(6, '0')), asset)
  }
})
