export type GraceSweepKind = 'moonlight' | 'blessing'

// On this 1800-unit sheet, y=900 reaches the centre of the 720-unit viewport
// halfway through the sweep. Both the particles and the mask use this line.
export function graceSweepFront(kind: GraceSweepKind, x: number): number {
  const turn = 2 * Math.PI * x
  if (kind === 'moonlight') {
    return 900 + 245 * (x - 0.5) + 15 * Math.sin(turn - 0.7) + 7 * Math.sin(2.1 * turn)
  }
  return 900 - 47 * Math.cos(1.62 * turn - 0.76) + 16 * Math.sin(0.95 * turn - 0.8)
}

function noiseField(seed: number) {
  const values = new Float32Array(64 * 64)
  for (let i = 0; i < values.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    values[i] = seed / 2147483648 - 1
  }
  return (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y)
    const row = (iy & 63) * 64, nextRow = ((iy + 1) & 63) * 64
    const column = ix & 63, nextColumn = (ix + 1) & 63
    const dx = x - ix, dy = y - iy
    const top = values[row + column] * (1 - dx) + values[row + nextColumn] * dx
    const bottom = values[nextRow + column] * (1 - dx) + values[nextRow + nextColumn] * dx
    return top * (1 - dy) + bottom * dy
  }
}

const masks: Partial<Record<GraceSweepKind, string>> = {}

export function graceSweepMask(kind: GraceSweepKind): string {
  const cached = masks[kind]
  if (cached) return cached

  const moon = kind === 'moonlight'
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
  const context = canvas?.getContext('2d')
  // A texture only across the front keeps the rest of the page completely
  // clear or solid. Rasterise once, away from the animation's frame loop.
  const top = 704, bottom = 1088
  let band: string
  if (canvas && context) {
    canvas.width = 600
    canvas.height = (bottom - top) / 2
    const pixels = context.createImageData(canvas.width, canvas.height)
    const noise = noiseField(moon ? 13793 : 7507)
    for (let x = 0; x < canvas.width; x++) {
      const u = (x + 0.5) / canvas.width
      const centre = graceSweepFront(kind, u)
      const phase = moon ? 0.4 : 2.1
      const spread = 37 + 6.5 * Math.sin(16 * u + phase) + 3.5 * Math.cos(37 * u - phase)
      for (let y = 0; y < canvas.height; y++) {
        const distance = (top + 2 * y + 1 - centre) * (moon ? -1 : 1)
        let alpha = distance > 0 ? 1 : 0
        if (Math.abs(distance) < spread + 27) {
          // Larger pockets vary how far the dust has diffused. The finer
          // density variations stay in the same cloud on desktop and mobile.
          const cloud = 13 * noise(x / 13, y / 11) + 8 * noise(x / 3.8 + 19, y / 3.3)
          const grain = 5 * noise(x + 37, y + 11)
          const t = Math.max(0, Math.min(1, 0.5 + (distance + cloud + grain) / (2 * spread)))
          alpha = t * t * (3 - 2 * t)
        }
        const offset = (y * canvas.width + x) * 4
        pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = 255
        pixels.data[offset + 3] = Math.round(alpha * 255)
      }
    }
    context.putImageData(pixels, 0, 0)
    band = `<image x="0" y="${top}" width="1200" height="${bottom - top}" preserveAspectRatio="none" href="${canvas.toDataURL('image/png')}"/>`
  } else {
    // Canvas can be unavailable in restricted browsers or during SSR.
    const line = Array.from({ length: 65 }, (_, i) =>
      `${i * 18.75},${graceSweepFront(kind, i / 64).toFixed(1)}`,
    ).join(' ')
    const edge = moon ? 0 : 1800
    band = `<path fill="white" d="M0,${edge} L${line} L1200,${edge} Z"/>`
  }
  // The overlap avoids a translucent seam at fractional viewport sizes.
  const solid = moon ? `<rect width="1200" height="${top + 4}" fill="white"/>` :
    `<rect y="${bottom - 4}" width="1200" height="${1804 - bottom}" fill="white"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" preserveAspectRatio="none">${solid}${band}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  masks[kind] = url
  return url
}
