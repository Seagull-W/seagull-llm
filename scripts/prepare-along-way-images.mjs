import sharp from 'sharp'
import { mkdir, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// The source folders are passed explicitly; originals are never overwritten.
const [stillsFolder, generatedFolder] = process.argv.slice(2)
if (!stillsFolder || !generatedFolder) throw new Error('Pass the film-stills folder and generated-images folder.')
const output = resolve('docs/public/images/along-way')
const sources = resolve('design/along-way/sources')
await mkdir(output, { recursive: true })
await mkdir(sources, { recursive: true })
const originals = {
  'train-rest': '屏幕截图 2025-06-06 220817.png',
  'fjord': '屏幕截图 2025-06-06 223952.png',
  'night-window': '屏幕截图 2025-06-12 135623.png',
  'country-road': '屏幕截图 2025-06-12 172715.png',
}
const generated = {
  'study': 'exec-bef7b3f7-56bc-443e-b492-0bd17c71c3d7.png',
  'room-day': 'exec-0cde19e4-b942-4ba4-88e7-b9eff99777ee.png',
  'room-night': 'exec-ba73812d-1603-4638-b1ee-c402a55b9dde.png',
  'train-detail': 'exec-0ef5175d-12dc-42dc-b76c-e1d164806de9.png',
}
for (const [kind, folder, files] of [['film', stillsFolder, originals], ['generated', generatedFolder, generated]]) {
  for (const [name, file] of Object.entries(files)) {
    const input = resolve(folder, file)
    await copyFile(input, resolve(sources, `${kind}-${name}.png`))
    // Encoding and downsampling only: keep the film's colors and full framing.
    await sharp(input).resize({ width: 1680, withoutEnlargement: true }).webp({ quality: 86 }).toFile(resolve(output, `${name}.webp`))
    await sharp(input).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 82 }).toFile(resolve(output, `${name}-small.webp`))
    console.log(`${kind}: ${name}`)
  }
}
