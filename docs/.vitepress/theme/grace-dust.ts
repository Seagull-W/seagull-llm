import { graceSweepFront, type GraceSweepKind } from './grace-sweep'

function dustRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

const palettes = {
  moonlight: ['#586d91', '#8caed3', '#c0d8ef', '#edf7ff'],
  blessing: ['#99723e', '#d9ab5f', '#f3d28a', '#fff1bd'],
}
const textures = new Map<GraceSweepKind, HTMLCanvasElement[]>()

// Paint the grains once. Several off-centre concentrations give the dust a
// porous outline even as the same cloud opens out. Each grain is a point.
function dustTextures(kind: GraceSweepKind) {
  const cached = textures.get(kind)
  if (cached) return cached
  const random = dustRandom(kind === 'moonlight' ? 431 : 1057)
  const palette = palettes[kind]
  const centred = () => random() + random() + random() - 1.5
  const sheets = Array.from({ length: 8 }, () => {
    const tile = document.createElement('canvas')
    tile.width = tile.height = 160
    const ctx = tile.getContext('2d')!
    for (let lobe = 0; lobe < 7; lobe++) {
      const x = 80 + centred() * 32
      const y = 80 + centred() * 28
      const spread = 10 + random() * 16
      const haze = ctx.createRadialGradient(x, y, 0, x, y, spread * 1.6)
      haze.addColorStop(0, palette[1] + '13')
      haze.addColorStop(1, palette[1] + '00')
      ctx.fillStyle = haze
      ctx.fillRect(0, 0, 160, 160)
      for (let i = 0; i < 170; i++) {
        const px = x + centred() * spread * 1.5
        const py = y + centred() * spread
        const radius = 0.22 + random() ** 3 * 1.08
        ctx.fillStyle = palette[Math.floor(random() * palette.length)]
        ctx.globalAlpha = 0.35 + 0.65 * random()
        ctx.beginPath()
        ctx.arc(px, py, radius, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    return tile
  })
  textures.set(kind, sheets)
  return sheets
}

export function createGraceDust(canvas: HTMLCanvasElement, kind: GraceSweepKind) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_400_000 / Math.max(1, width * height)))
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx || !width || !height) return () => {}
  const sheets = dustTextures(kind)
  const random = dustRandom(kind === 'moonlight' ? 213 : 1753)
  const moon = kind === 'moonlight'
  const scale = Math.max(1, Math.sqrt(width * height / 1_400_000))
  const columns = Math.ceil(width / (57 * scale))
  const rows = Math.ceil(height / (57 * scale))
  const clouds = []
  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= columns; col++) {
      const x = (col + random()) / columns
      const y = (row + random()) / rows
      // Solve the mask's position for this point on the screen. A pinch of
      // powder opens here as the boundary arrives, then disperses in place.
      const offset = graceSweepFront(kind, x) - y * 720
      const crossing = moon ? 1 - offset / 1080 : offset / 1080
      const lifetime = 0.20 + 0.16 * random()
      clouds.push({
        x: x * width, y: y * height, birth: crossing - lifetime * (0.38 + random() * 0.22),
        lifetime, size: (82 + 98 * random()) * scale, angle: (random() - 0.5) * 2.4,
        twist: (random() - 0.5) * 0.6, wind: (moon ? -12 : 4) + (random() - 0.5) * 30,
        lift: (moon ? 1 : -1) * (9 + 24 * random()), density: 0.24 + 0.50 * random(),
        sheet: sheets[Math.floor(random() * sheets.length)],
      })
    }
  }
  return (progress: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (progress <= 0 || progress >= 1) return
    for (const cloud of clouds) {
      const age = (progress - cloud.birth) / cloud.lifetime
      if (age <= 0 || age >= 1) continue
      const size = cloud.size * (0.36 + 1.27 * age)
      ctx.save()
      ctx.translate(cloud.x + cloud.wind * age, cloud.y + cloud.lift * age)
      ctx.rotate(cloud.angle + cloud.twist * age)
      ctx.globalAlpha = cloud.density * Math.sin(Math.PI * age) ** 1.2
      ctx.drawImage(cloud.sheet, -size / 2, -size / 2, size, size)
      ctx.restore()
    }
  }
}

// Prepare the next appearance during idle time; the first sweep can then use
// the same cached grains as subsequent clicks.
export function warmGraceDust(kind: GraceSweepKind) {
  if (document.createElement('canvas').getContext('2d')) dustTextures(kind)
}
