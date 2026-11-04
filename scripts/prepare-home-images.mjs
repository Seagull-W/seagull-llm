import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const root = new URL('../docs/public/images/home/', import.meta.url)
const images = [
  ['海鸥与知识轨迹-1.png', 'hero-light.webp', 1672],
  ['深蓝纸艺海鸥背景-3.png', 'hero-dark.webp', 1672],
  ['剪纸风海鸥向右上滑翔-4.png', 'gull-mobile.webp', 480],
  ['极简海鸥与淡淡纸浪-5.png', 'closing.webp', 1440],
]

for (const [source, output, width] of images) {
  const result = await sharp(fileURLToPath(new URL(source, root)))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(fileURLToPath(new URL(output, root)))
  console.log(`${output}: ${result.width} × ${result.height}, ${Math.round(result.size / 1024)} KB`)
}
