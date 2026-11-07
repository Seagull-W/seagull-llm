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
import { closingImageFor, heroImageFor, heroMobileMedia, homeHeroPreload, visualStyles, resolveVisualStyle, visualStyleBoot } from '../docs/.vitepress/theme/visual-styles.ts'
import { pixelDaylightMatrix } from '../docs/.vitepress/theme/pixel-daylight.ts'
import { graceParties, graceCharacterFor, portraitPath } from '../docs/.vitepress/components/grace-characters.ts'
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
    ...graceParties.flat().map(portraitPath), ...Object.values(sheets).map(huntSheetPath)
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
    runInNewContext(homeHeroPreload(base, build.pathFor), {
      document: { createElement: () => ({}), head: { appendChild: link => links.push(link) } },
      localStorage: { getItem: key => key === 'seagull-visual-style' ? 'grace-archive' : 'dark' },
      matchMedia: query => ({ matches: query === heroMobileMedia })
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
        runInNewContext(homeHeroPreload(base), { document, localStorage, matchMedia: query => ({ matches: query === heroMobileMedia && mobile }) })
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
    runInNewContext(homeHeroPreload('/'), {
      document, localStorage: { getItem }, matchMedia: query => ({ matches: query === '(prefers-color-scheme: dark)' }),
    })
    assert.deepEqual(links.map(link => link.href), [visualStyles['paper-coast'].assets.heroDark])
  }
})

test('pixel icons retain their native 32px grid and binary transparency', async () => {
  for (const asset of Object.values(visualStyles['pixel-voyage'].icons)) {
    const image = sharp(fileURLToPath(new URL('../docs/public' + asset, import.meta.url)))
    const metadata = await image.metadata()
    assert.equal(metadata.width, 32, asset)
    assert.equal(metadata.height, 32, asset)
    const pixels = await image.ensureAlpha().raw().toBuffer()
    for (let i = 3; i < pixels.length; i += 4) assert.ok(pixels[i] === 0 || pixels[i] === 255, asset)
  }
})

test('daylight rendering maps every source pigment precisely and preserves alpha', () => {
  const matrix = pixelDaylightMatrix.split(' ').map(Number)
  const rgb = hex => hex.match(/../g).map(v => parseInt(v, 16) / 255)
  for (const [source, target] of [['26364a', 'ece9df'], ['79a99b', '698f82'], ['f2c690', 'b57c3b'], ['f6f1e7', '26364a']]) {
    for (const alpha of [0, 1]) {
      const input = [...rgb(source), alpha, 1]
      const expected = [...rgb(target), alpha]
      expected.forEach((channel, row) => {
        const actual = input.reduce((sum, value, col) => sum + value * matrix[row * 5 + col], 0)
        assert.ok(Math.abs(actual - channel) < 0.00001, `${source}, row ${row}`)
      })
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

test('pixel artwork rendered with the daylight filter uses its four supported pigments', async () => {
  const style = visualStyles['pixel-voyage']
  const { heroLight, heroDark, mobile, logo, coverLight, coverDark } = style.assets
  const assets = new Set([heroLight, heroDark, mobile, logo, coverLight, coverDark, ...Object.values(style.icons), ...Object.values(style.sectionArt)])
  const palette = new Set(['26364a', '79a99b', 'f2c690', 'f6f1e7'])
  for (const asset of assets) {
    if (!asset.endsWith('.png')) continue
    const pixels = await sharp(fileURLToPath(new URL('../docs/public' + asset, import.meta.url))).ensureAlpha().raw().toBuffer()
    const colors = new Set()
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]) colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2])
    }
    for (const color of colors) assert.ok(palette.has(color.toString(16).padStart(6, '0')), asset)
  }
})
