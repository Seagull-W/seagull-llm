import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { visualStyles, resolveVisualStyle, visualStyleBoot } from '../docs/.vitepress/theme/visual-styles.ts'
import { pixelDaylightMatrix } from '../docs/.vitepress/theme/pixel-daylight.ts'

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

test('all pixel decoration uses the four pigments supported by the daylight mapping', async () => {
  const style = visualStyles['pixel-voyage']
  const assets = new Set([...Object.values(style.assets), ...Object.values(style.icons), ...Object.values(style.sectionArt)])
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
