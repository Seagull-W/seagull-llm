import type { GraphNode } from '../../data/knowledge-graph.data.mts'

type Link = { source: string; target: string }
type Point = { x: number; y: number }
type Camera = Point & { k: number }
type LabelMode = 'quiet' | 'auto' | 'all'
type RGB = [number, number, number]
type Star = {
  node: GraphNode; seed: number; z: number; phase: number; period: number; magnitude: number
  x: number; y: number; alpha: number; reveal: number; degree: number; pulse: number
}
type Thread = { source: Star; target: Star; bend: number; rank: number }
type Palette = { base: string; mist: RGB[]; stars: RGB[]; ink: RGB; light: boolean }
type Flight = { from: Camera; to: Camera; start: number; duration: number }
type Pulse = { edge: Thread; start: number; duration: number }

export interface AtlasEngine {
  setGraph(nodes: GraphNode[], links: Link[]): void
  setPalette(style: string, cosmic: boolean, themeDark: boolean): void
  setActive(id: string): void
  setMatches(ids: Set<string>): void
  setLabels(mode: LabelMode): void
  focus(id: string, cluster?: boolean): void
  fit(immediate?: boolean): void
  zoom(factor: number): void
  getNodePosition(id: string): Point | undefined
  dispose(): void
}

interface AtlasOptions {
  canvas: HTMLCanvasElement
  nebula: HTMLCanvasElement
  nodes: GraphNode[]
  links: Link[]
  onHover: (id: string) => void
  onSelect: (id: string, repeat: boolean) => void
  onCameraChange?: () => void
}

const TAU = Math.PI * 2
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)
const rgba = (rgb: RGB, alpha: number) => `rgba(${rgb.join(',')},${alpha})`

// All spatial variation derives from content IDs, so reopening never reshuffles the sky.
function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
}
function random(seed: number) {
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function paletteFor(style: string, cosmic: boolean, dark: boolean): Palette {
  const variants: Record<string, { mist: RGB[]; stars: RGB[]; base: string; paper: string }> = {
    default: { base: '#040b12', paper: '#eff1eb', mist: [[57, 102, 119], [113, 112, 140], [59, 100, 92]], stars: [[195, 216, 215], [168, 195, 211], [231, 219, 187]] },
    'pixel-voyage': { base: '#050913', paper: '#eaf0f6', mist: [[66, 89, 137], [102, 117, 149], [68, 116, 135]], stars: [[197, 216, 239], [170, 194, 221], [228, 217, 190]] },
    'along-the-way': { base: '#0b0d0c', paper: '#f3f2ec', mist: [[96, 110, 92], [135, 105, 80], [83, 106, 119]], stars: [[214, 217, 199], [189, 203, 181], [234, 207, 172]] },
    'grace-archive': { base: '#090b0e', paper: '#e6e3d7', mist: [[121, 111, 76], [67, 92, 114], [104, 90, 117]], stars: [[218, 216, 197], [172, 193, 217], [232, 207, 148]] },
  }
  const p = variants[style] || variants.default
  const light = !cosmic && !dark
  return { base: light ? p.paper : p.base, mist: p.mist, stars: light ? [[61, 79, 88], [73, 93, 108], [105, 83, 53]] : p.stars, ink: light ? [51, 64, 73] : [211, 222, 228], light }
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  return { canvas, ctx }
}

// A cached fractal density field gives the mist irregular filaments, not blurred discs.
function cloudTexture(seed: number, rgb: RGB): HTMLCanvasElement {
  const { canvas, ctx } = canvas2d(448, 288)
  const rng = random(seed)
  const grid = Array.from({ length: 65 * 65 }, rng)
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), tx = ease(x - ix), ty = ease(y - iy)
    const at = (a: number, b: number) => grid[((b % 65 + 65) % 65) * 65 + ((a % 65 + 65) % 65)]
    return mix(mix(at(ix, iy), at(ix + 1, iy), tx), mix(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty)
  }
  const image = ctx.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const u = x / canvas.width, v = y / canvas.height
      let density = 0, amplitude = .55, frequency = 3
      for (let octave = 0; octave < 5; octave++) {
        density += noise(u * frequency + 7 * octave, v * frequency + 13 * octave) * amplitude
        amplitude *= .48
        frequency *= 2.04
      }
      const ridge = Math.exp(-Math.pow((v - .5 - .16 * Math.sin(u * 6 + seed)) / .26, 2))
      const feather = Math.pow(Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 1.5)
      const alpha = clamp((density - .24) * 1.5, 0, 1) * ridge * feather * 180
      const index = (y * canvas.width + x) * 4
      image.data[index] = rgb[0]
      image.data[index + 1] = rgb[1]
      image.data[index + 2] = rgb[2]
      image.data[index + 3] = alpha
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function starTexture(rgb: RGB, kind: GraphNode['kind'], light: boolean): HTMLCanvasElement {
  const { canvas, ctx } = canvas2d(128, 128)
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  glow.addColorStop(0, rgba(rgb, .92))
  glow.addColorStop(.035, rgba(rgb, .83))
  glow.addColorStop(.095, rgba(rgb, kind === 'section' ? .57 : .3))
  glow.addColorStop(.25, rgba(rgb, .12))
  glow.addColorStop(.6, rgba(rgb, .025))
  glow.addColorStop(1, rgba(rgb, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 128)
  if (kind === 'tag') {
    for (let axis = 0; axis < 2; axis++) {
      ctx.save()
      ctx.translate(64, 64)
      ctx.rotate(axis * Math.PI / 2 + .18)
      const ray = ctx.createLinearGradient(-31, 0, 31, 0)
      ray.addColorStop(0, rgba(rgb, 0)); ray.addColorStop(.5, rgba(rgb, light ? .24 : .4)); ray.addColorStop(1, rgba(rgb, 0))
      ctx.fillStyle = ray
      ctx.fillRect(-31, -.55, 62, 1.1)
      ctx.restore()
    }
  }
  return canvas
}

/** Canvas owns only rendering and physical input; Vue owns all semantic controls. */
export function createAtlasEngine(options: AtlasOptions): AtlasEngine {
  const { canvas, nebula } = options
  const context = canvas.getContext('2d', { alpha: true })
  const backdrop = nebula.getContext('2d', { alpha: false })
  if (!context || !backdrop) throw new Error('Canvas 2D is unavailable')
  const ctx: CanvasRenderingContext2D = context
  const bg: CanvasRenderingContext2D = backdrop
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motion.matches
  let disposed = false, frame = 0, width = 1, height = 1, dpr = 1, bgDpr = 1
  let time = 0, lastFrame = 0, lastBackground = -Infinity, introStart = performance.now()
  let palette = paletteFor('default', true, true)
  let clouds: HTMLCanvasElement[] = [], sprites: HTMLCanvasElement[] = []
  let stars: Star[] = [], threads: Thread[] = [], byId = new Map<string, Star>()
  let neighbors = new Map<string, Set<string>>()
  let active = '', hoverId = '', selected = '', matches = new Set<string>(), labelMode: LabelMode = 'auto'
  let spotlightStart = 0, fitScale = 1, fitCenter = { x: 0, y: 0 }
  let camera: Camera = { x: 0, y: 0, k: 1 }, target: Camera = { ...camera }, flight: Flight | undefined
  let velocity = { x: 0, y: 0 }, pointer = { x: -1000, y: -1000 }, pointerGlow = 0
  let nextPulse = 2200, pulseCursor = 0, pulses: Pulse[] = []
  const pointers = new Map<number, Point>()
  let gesture: { start: Point; previous: Point; time: number; dragged: boolean; pinched: boolean } | undefined
  const dustRandom = random(76403)
  const dust = Array.from({ length: 280 }, (_, i) => ({
    x: dustRandom(), y: dustRandom(), z: i % 3, radius: .25 + dustRandom() * .65,
    alpha: .12 + dustRandom() * .42, phase: dustRandom() * TAU,
  }))
  const markIndex = { article: 0, tag: 1, section: 2 }

  function invalidate() {
    if (!disposed && !frame && !document.hidden) frame = requestAnimationFrame(render)
  }
  function assets() {
    clouds = palette.mist.map((color, i) => cloudTexture(142 + i * 71, color))
    sprites = (['article', 'tag', 'section'] as const).map((kind, i) => starTexture(palette.stars[i], kind, palette.light))
    lastBackground = -Infinity
  }
  function setGraph(nodes: GraphNode[], links: Link[]) {
    const previous = byId
    byId = new Map()
    neighbors = new Map(nodes.map(node => [node.id, new Set<string>()]))
    for (const link of links) {
      if (!neighbors.has(link.source) || !neighbors.has(link.target)) continue
      neighbors.get(link.source)!.add(link.target)
      neighbors.get(link.target)!.add(link.source)
    }
    stars = nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y)).map(node => {
      const seed = hash(node.id), rng = random(seed)
      const star: Star = {
        node, seed, z: .25 + rng() * .75, phase: rng() * TAU, period: 7000 + rng() * 13000,
        magnitude: .55 + rng() * .45, x: 0, y: 0, alpha: previous.get(node.id)?.alpha ?? 1,
        reveal: 1, degree: neighbors.get(node.id)?.size || 0, pulse: 0,
      }
      byId.set(node.id, star)
      return star
    })
    threads = links.flatMap((link, rank) => {
      const source = byId.get(link.source), targetStar = byId.get(link.target)
      return source && targetStar ? [{ source, target: targetStar, bend: ((hash(link.source + link.target) % 100) / 100 - .5) * .35, rank }] : []
    })
    pulses = []
    if (!byId.has(active)) active = ''
    if (!byId.has(selected)) selected = ''
    fit()
    invalidate()
  }

  function bounds(nodes: Star[]) {
    if (!nodes.length) return { left: -100, right: 100, top: -100, bottom: 100 }
    return {
      left: Math.min(...nodes.map(s => s.node.x)), right: Math.max(...nodes.map(s => s.node.x)),
      top: Math.min(...nodes.map(s => s.node.y)), bottom: Math.max(...nodes.map(s => s.node.y)),
    }
  }
  function fly(to: Camera, immediate = false) {
    velocity = { x: 0, y: 0 }
    target = { ...to }
    if (reduced || immediate) { camera = { ...to }; flight = undefined }
    else flight = { from: { ...camera }, to: { ...to }, start: performance.now(), duration: 1000 }
    lastBackground = -Infinity
    invalidate()
  }
  function fit(immediate = false) {
    const b = bounds(stars)
    fitScale = Math.min(2.4, (width * .81) / Math.max(120, b.right - b.left), (height * .77) / Math.max(120, b.bottom - b.top))
    fitCenter = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
    fly({ x: width / 2 - fitCenter.x * fitScale, y: height / 2 - fitCenter.y * fitScale, k: fitScale }, immediate)
  }
  function focus(id: string, cluster = false) {
    const star = byId.get(id)
    if (!star) return
    let center = { x: star.node.x, y: star.node.y }
    let scale = Math.max(fitScale * 2.3, camera.k)
    if (cluster) {
      const ids = neighbors.get(id) || new Set<string>()
      const b = bounds(stars.filter(s => s === star || ids.has(s.node.id)))
      center = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
      scale = Math.min(width * .66 / Math.max(90, b.right - b.left), height * .62 / Math.max(90, b.bottom - b.top))
    }
    scale = clamp(scale, fitScale, fitScale * 7)
    fly({ x: width / 2 - center.x * scale, y: height * .46 - center.y * scale, k: scale })
  }
  function zoomAt(factor: number, anchor: Point) {
    // A wheel/pinch interrupt takes over the visible camera, not the flight's destination.
    if (flight) target = { ...camera }
    flight = undefined
    velocity = { x: 0, y: 0 }
    const scale = clamp(target.k * factor, fitScale * .45, Math.max(6, fitScale * 12))
    const ratio = scale / target.k
    target = { x: anchor.x - (anchor.x - target.x) * ratio, y: anchor.y - (anchor.y - target.y) * ratio, k: scale }
    if (reduced) camera = { ...target }
    invalidate()
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const nextDpr = Math.min(2, window.devicePixelRatio || 1)
    if (width === rect.width && height === rect.height && dpr === nextDpr) return
    const initial = width === 1
    const previousWidth = width, previousHeight = height
    width = rect.width; height = rect.height; dpr = nextDpr
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
    bgDpr = Math.min(1, 1000 / width)
    nebula.width = Math.round(width * bgDpr); nebula.height = Math.round(height * bgDpr)
    if (initial) fit(true)
    else {
      camera.x += (width - previousWidth) / 2; camera.y += (height - previousHeight) / 2
      target = { ...camera }; flight = undefined
      const b = bounds(stars)
      fitScale = Math.min(2.4, width * .81 / Math.max(120, b.right - b.left), height * .77 / Math.max(120, b.bottom - b.top))
    }
    lastBackground = -Infinity
    invalidate()
  }
  const observer = new ResizeObserver(resize)

  function drawBackground(now: number) {
    bg.setTransform(bgDpr, 0, 0, bgDpr, 0, 0)
    bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over'
    bg.fillStyle = palette.base; bg.fillRect(0, 0, width, height)
    const elapsed = reduced ? 0 : time
    const dx = camera.x + fitCenter.x * camera.k - width / 2
    const dy = camera.y + fitCenter.y * camera.k - height / 2
    bg.globalCompositeOperation = palette.light ? 'multiply' : 'screen'
    clouds.forEach((cloud, i) => {
      const phase = i * 2.14
      const driftX = Math.sin(elapsed / 48000 + phase) * width * .028
      const driftY = Math.cos(elapsed / 62000 + phase) * height * .022
      const scale = 1.3 + i * .16 + Math.log(Math.max(.2, camera.k / fitScale)) * .02
      bg.save()
      bg.translate(width * (.41 + i * .08) + dx * (.014 + i * .009) + driftX, height * (.45 + i * .055) + dy * .02 + driftY)
      bg.rotate([-.34, .37, -.1][i])
      bg.globalAlpha = (palette.light ? .19 : .58) * (1 + .06 * Math.sin(elapsed / 19000 + phase))
      bg.drawImage(cloud, -width * scale / 2, -height * scale / 2, width * scale, height * scale)
      bg.restore()
    })
    bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over'
    lastBackground = now
  }

  function related(star: Star) {
    return active ? star.node.id === active || !!neighbors.get(active)?.has(star.node.id) : matches.size > 0 && matches.has(star.node.id)
  }
  function edgeRelated(edge: Thread) {
    return active ? edge.source.node.id === active || edge.target.node.id === active : matches.has(edge.source.node.id) || matches.has(edge.target.node.id)
  }
  function control(edge: Thread): Point {
    return {
      x: (edge.source.x + edge.target.x) / 2 - (edge.target.y - edge.source.y) * edge.bend,
      y: (edge.source.y + edge.target.y) / 2 + (edge.target.x - edge.source.x) * edge.bend,
    }
  }
  function path(edge: Thread, end = 1) {
    const c = control(edge), a = edge.source, b = edge.target
    ctx.beginPath(); ctx.moveTo(a.x, a.y)
    if (end >= 1) ctx.quadraticCurveTo(c.x, c.y, b.x, b.y)
    else ctx.quadraticCurveTo(mix(a.x, c.x, end), mix(a.y, c.y, end), (1 - end) ** 2 * a.x + 2 * (1 - end) * end * c.x + end ** 2 * b.x, (1 - end) ** 2 * a.y + 2 * (1 - end) * end * c.y + end ** 2 * b.y)
  }
  function drawDust() {
    const dx = camera.x + fitCenter.x * camera.k - width / 2, dy = camera.y + fitCenter.y * camera.k - height / 2
    for (const mote of dust) {
      const depth = [.015, .04, .085][mote.z]
      const drift = reduced ? 0 : Math.sin(time / 30000 + mote.phase) * (mote.z + 1) * 1.7
      const x = ((mote.x * width + dx * depth + drift) % width + width) % width
      const y = ((mote.y * height + dy * depth) % height + height) % height
      ctx.globalAlpha = mote.alpha * (palette.light ? .38 : .72) * (reduced ? 1 : .86 + .14 * Math.sin(time / 9000 + mote.phase))
      ctx.fillStyle = rgba(palette.ink, 1)
      ctx.beginPath(); ctx.arc(x, y, mote.radius * (1 + mote.z * .28), 0, TAU); ctx.fill()
    }
  }

  function drawLabels(intro: number) {
    const zoomLevel = camera.k / fitScale
    const sectionCore = new Set(stars.filter(s => s.node.kind === 'section').sort((a, b) => b.degree - a.degree).slice(0, 5).map(s => s.node.id))
    const candidates = stars.filter(star => {
      if (star.node.id === active || matches.has(star.node.id)) return true
      if (active && related(star)) return true
      if (labelMode === 'quiet') return sectionCore.has(star.node.id)
      if (labelMode === 'all') return true
      if (star.node.kind === 'section') return zoomLevel > 1.4 || sectionCore.has(star.node.id)
      return star.node.kind === 'tag' ? zoomLevel > 1.7 : zoomLevel > 3.1
    }).sort((a, b) => {
      const priority = (s: Star) => s.node.id === active ? 10000 : matches.has(s.node.id) ? 9000 : related(s) ? 5000 + s.degree : s.node.kind === 'section' ? 3000 + s.degree : s.degree
      return priority(b) - priority(a)
    })
    const placed: { x: number; y: number; width: number }[] = []
    for (const star of candidates) {
      if (placed.length > (active ? 22 : labelMode === 'all' ? 48 : 30)) break
      if (star.x < 20 || star.x > width - 20 || star.y < 24 || star.y > height - 28) continue
      const important = related(star) || matches.has(star.node.id)
      const isSection = star.node.kind === 'section'
      const maxLength = important ? 25 : isSection ? 17 : 19
      const letters = Array.from(star.node.label)
      const label = letters.length > maxLength ? letters.slice(0, maxLength - 1).join('') + '…' : star.node.label
      ctx.font = `${isSection ? 12 : 11}px ${isSection ? '"Noto Serif SC", "Source Han Serif SC", serif' : 'system-ui, sans-serif'}`
      const span = ctx.measureText(label).width
      const offset = isSection ? 15 : 10
      const x = star.x + offset + span < width - 16 ? star.x + offset : star.x - offset - span
      const y = star.y
      if (placed.some(rect => Math.abs(rect.y - y) < 23 && x < rect.x + rect.width + 12 && x + span + 12 > rect.x)) continue
      placed.push({ x, y, width: span })
      let alpha = important ? .92 : isSection ? .5 : .52 * clamp((zoomLevel - (star.node.kind === 'tag' ? 1.5 : 2.9)) * 2, 0, 1)
      if (labelMode === 'all') alpha = important ? .92 : .58
      if ((active || matches.size) && !important) alpha *= .35
      ctx.globalAlpha = alpha * star.reveal * intro
      ctx.fillStyle = rgba(palette.ink, 1); ctx.textBaseline = 'middle'
      ctx.fillText(label, x, y)
    }
  }

  function render(now: number) {
    frame = 0
    if (disposed || document.hidden) return
    const dt = Math.min(40, lastFrame ? now - lastFrame : 16.67)
    lastFrame = now
    if (!reduced) time += dt
    const smoothing = reduced ? 1 : 1 - Math.exp(-dt / 85)
    let cameraMoving = false
    if (flight) {
      const t = clamp((now - flight.start) / flight.duration, 0, 1), e = ease(t)
      camera = {
        x: mix(flight.from.x, flight.to.x, e), y: mix(flight.from.y, flight.to.y, e),
        k: mix(flight.from.k, flight.to.k, e) * (1 - .11 * Math.sin(Math.PI * t)),
      }
      // Keep the optical centre anchored while the flight briefly pulls back.
      const baseline = mix(flight.from.k, flight.to.k, e)
      camera.x = width / 2 + (camera.x - width / 2) * camera.k / baseline
      camera.y = height / 2 + (camera.y - height / 2) * camera.k / baseline
      cameraMoving = true
      if (t === 1) { camera = { ...flight.to }; flight = undefined }
    } else {
      if (!pointers.size && !reduced && Math.abs(velocity.x) + Math.abs(velocity.y) > .05) {
        target.x += velocity.x * dt / 16.67; target.y += velocity.y * dt / 16.67
        const damping = Math.pow(.89, dt / 16.67)
        velocity.x *= damping; velocity.y *= damping
      }
      cameraMoving = Math.abs(camera.x - target.x) + Math.abs(camera.y - target.y) + Math.abs(camera.k - target.k) > .015
      camera.x = mix(camera.x, target.x, smoothing); camera.y = mix(camera.y, target.y, smoothing); camera.k = mix(camera.k, target.k, smoothing)
    }
    if (now - lastBackground > (reduced ? 0 : 80) || lastBackground === -Infinity) drawBackground(now)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
    drawDust()
    const intro = reduced ? 1 : clamp((now - introStart) / 1250, 0, 1)
    const spotlight = !!active || matches.size > 0
    for (const star of stars) {
      const node = star.node
      const radius = Math.hypot(node.x - fitCenter.x, node.y - fitCenter.y)
      const delay = Math.min(.5, radius / 1200) + (star.seed % 13) / 100
      star.reveal = reduced ? 1 : ease(clamp((intro - delay) / (1 - delay), 0, 1))
      const spread = .92 + .08 * star.reveal
      const drift = reduced ? 0 : 1.5 + star.z * 1.5
      const dx = Math.sin(time / star.period * TAU + star.phase) * drift
      const dy = Math.cos(time / (star.period * 1.3) * TAU + star.phase) * drift * .65
      star.x = camera.x + (fitCenter.x + (node.x - fitCenter.x) * spread + dx) * camera.k
      star.y = camera.y + (fitCenter.y + (node.y - fitCenter.y) * spread + dy) * camera.k
      star.alpha = mix(star.alpha, spotlight && !related(star) ? .14 : 1, reduced ? 1 : 1 - Math.exp(-dt / 230))
      star.pulse = Math.max(0, star.pulse - dt / 1300)
    }
    if (cameraMoving || reduced) options.onCameraChange?.()
    const edgesReveal = reduced ? 1 : ease(clamp((intro - .38) / .62, 0, 1))
    ctx.lineWidth = .55
    for (const edge of threads) {
      if ((edge.source.x < -80 && edge.target.x < -80) || (edge.source.x > width + 80 && edge.target.x > width + 80) || (edge.source.y < -80 && edge.target.y < -80) || (edge.source.y > height + 80 && edge.target.y > height + 80)) continue
      const lit = spotlight && edgeRelated(edge)
      ctx.globalAlpha = edgesReveal * Math.min(edge.source.alpha, edge.target.alpha) * (lit ? .37 : palette.light ? .13 : .1)
      ctx.strokeStyle = rgba(palette.stars[1], 1)
      path(edge); ctx.stroke()
      if (lit) {
        const progress = reduced ? 1 : clamp((now - spotlightStart - (edge.rank % 9) * 48) / 800, 0, 1)
        ctx.globalAlpha *= .65; ctx.lineWidth = .8
        path(edge, progress); ctx.stroke(); ctx.lineWidth = .55
      }
    }
    if (!reduced && time >= nextPulse && threads.length) {
      // Pulses follow only actual data edges; no synthetic semantic relationships.
      const edge = threads[(pulseCursor * 83 + 17) % threads.length]
      pulses.push({ edge, start: time, duration: 2600 + (pulseCursor % 3) * 350 })
      pulseCursor++; nextPulse = time + 3200 + (pulseCursor % 3) * 500
    }
    ctx.globalCompositeOperation = palette.light ? 'source-over' : 'lighter'
    pulses = pulses.filter(pulse => time - pulse.start < pulse.duration)
    for (const pulse of pulses) {
      const t = clamp((time - pulse.start) / pulse.duration, 0, 1), c = control(pulse.edge), a = pulse.edge.source, b = pulse.edge.target
      const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x
      const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y
      ctx.globalAlpha = Math.sin(Math.PI * t) * .6 * (spotlight && !edgeRelated(pulse.edge) ? .2 : 1)
      ctx.drawImage(sprites[1], x - 10, y - 10, 20, 20)
      if (t < .12) a.pulse = Math.max(a.pulse, (1 - t / .12) * .75)
      if (t > .87) b.pulse = Math.max(b.pulse, (t - .87) / .13 * .8)
    }
    for (const star of stars) {
      if (star.x < -70 || star.x > width + 70 || star.y < -70 || star.y > height + 70) continue
      const kind = star.node.kind, isActive = star.node.id === active
      const breathing = reduced ? 1 : .9 + .1 * Math.sin(time / star.period * TAU + star.phase)
      const size = (kind === 'section' ? 79 : kind === 'tag' ? 43 : 22 + Math.min(10, star.degree * 1.2)) * (.87 + star.z * .2) * clamp(Math.pow(camera.k / fitScale, .12), .8, 1.5)
      const highlight = isActive ? 1.25 : related(star) ? 1.08 : 1
      ctx.globalAlpha = Math.min(1, star.alpha * star.reveal * breathing * (.6 + star.magnitude * .4) * highlight)
      ctx.drawImage(sprites[markIndex[kind]], star.x - size / 2, star.y - size / 2, size, size)
      if (star.pulse > .01 || isActive) {
        ctx.globalAlpha = (isActive ? .25 : star.pulse * .38) * star.alpha
        ctx.drawImage(sprites[markIndex[kind]], star.x - size * .8, star.y - size * .8, size * 1.6, size * 1.6)
      }
      // The core is warm ivory rather than a hard white outline.
      ctx.globalAlpha = star.reveal * star.alpha * breathing * (.65 + star.magnitude * .35)
      ctx.fillStyle = rgba(palette.stars[markIndex[kind]], 1)
      ctx.beginPath(); ctx.arc(star.x, star.y, kind === 'section' ? 2.45 : kind === 'tag' ? 1.4 : .8 + star.z * .55, 0, TAU); ctx.fill()
      if (kind === 'section') {
        ctx.globalAlpha = .14 * star.alpha * star.reveal
        ctx.strokeStyle = rgba(palette.stars[2], 1); ctx.lineWidth = .55
        ctx.beginPath(); ctx.ellipse(star.x, star.y, size * .23, size * .095, -.5 + star.phase / 3, .25, Math.PI * 1.5); ctx.stroke()
      }
    }
    pointerGlow = mix(pointerGlow, pointer.x >= 0 && !pointers.size ? 1 : 0, reduced ? 1 : .06)
    if (pointerGlow > .01 && !reduced) {
      ctx.globalAlpha = pointerGlow * .075
      ctx.drawImage(sprites[0], pointer.x - 100, pointer.y - 100, 200, 200)
    }
    ctx.globalCompositeOperation = 'source-over'
    drawLabels(edgesReveal)
    ctx.globalAlpha = 1
    if (!reduced) invalidate()
  }

  function local(event: PointerEvent | WheelEvent): Point {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  function hit(point: Point, touch = false): string {
    let best = '', distance = Infinity
    for (const star of stars) {
      const radius = touch ? 22 : star.node.kind === 'section' ? 18 : 12
      const squared = (star.x - point.x) ** 2 + (star.y - point.y) ** 2
      if (squared < radius * radius && squared < distance) { best = star.node.id; distance = squared }
    }
    return best
  }
  function hover(id: string) {
    if (hoverId === id) return
    hoverId = id; options.onHover(id)
    canvas.style.cursor = id ? 'pointer' : 'grab'
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    const point = local(event)
    pointers.set(event.pointerId, point)
    canvas.setPointerCapture(event.pointerId)
    if (pointers.size === 1) gesture = { start: point, previous: point, time: event.timeStamp, dragged: false, pinched: false }
    else if (gesture) { gesture.pinched = true; gesture.dragged = true }
    flight = undefined; target = { ...camera }; velocity = { x: 0, y: 0 }
    hover(''); canvas.style.cursor = 'grabbing'; invalidate()
  }
  function pointerMove(event: PointerEvent) {
    const point = local(event)
    pointer = point
    if (!pointers.has(event.pointerId)) { if (event.pointerType === 'mouse') hover(hit(point)); invalidate(); return }
    const previousPoints = [...pointers.values()]
    pointers.set(event.pointerId, point)
    const currentPoints = [...pointers.values()]
    if (currentPoints.length >= 2) {
      const [a, b] = previousPoints, [c, d] = currentPoints
      const oldMiddle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const middle = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 }
      const oldDistance = Math.hypot(a.x - b.x, a.y - b.y)
      const newDistance = Math.hypot(c.x - d.x, c.y - d.y)
      if (oldDistance > 1) zoomAt(newDistance / oldDistance, oldMiddle)
      target.x += middle.x - oldMiddle.x; target.y += middle.y - oldMiddle.y
      if (reduced) camera = { ...target }
      if (gesture) { gesture.pinched = true; gesture.dragged = true; gesture.previous = point }
    } else if (gesture) {
      const dx = point.x - gesture.previous.x, dy = point.y - gesture.previous.y
      if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) > 5) gesture.dragged = true
      if (gesture.dragged) {
        target.x += dx; target.y += dy
        const dt = Math.max(8, event.timeStamp - gesture.time)
        velocity = { x: clamp(dx * 16.67 / dt, -45, 45), y: clamp(dy * 16.67 / dt, -45, 45) }
        if (reduced) camera = { ...target }
      }
      gesture.previous = point; gesture.time = event.timeStamp
    }
    invalidate()
  }
  function endPointer(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return
    const point = local(event)
    const wasTap = event.type === 'pointerup' && pointers.size === 1 && gesture && !gesture.dragged && !gesture.pinched
    pointers.delete(event.pointerId)
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (wasTap) {
      const id = hit(point, event.pointerType !== 'mouse')
      const repeat = !!id && selected === id
      selected = id; options.onSelect(id, repeat)
    }
    if (!pointers.size) {
      if (gesture && event.timeStamp - gesture.time > 80) velocity = { x: 0, y: 0 }
      if (event.type !== 'pointerup') velocity = { x: 0, y: 0 }
      gesture = undefined
      canvas.style.cursor = 'grab'
    } else if (gesture) {
      gesture.previous = [...pointers.values()][0]
      gesture.time = event.timeStamp
    }
    invalidate()
  }
  function pointerLeave() { pointer = { x: -1000, y: -1000 }; if (!pointers.size) hover(''); invalidate() }
  function wheel(event: WheelEvent) {
    event.preventDefault()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
    zoomAt(Math.exp(-clamp(event.deltaY * unit, -160, 160) * .002), local(event))
  }
  function changeMotion() {
    reduced = motion.matches
    pulses = []; velocity = { x: 0, y: 0 }; flight = undefined; camera = { ...target }
    for (const star of stars) star.pulse = 0
    introStart = performance.now() - 1300
    if (frame) { cancelAnimationFrame(frame); frame = 0 }
    lastBackground = -Infinity; invalidate()
  }
  function visibility() {
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0 }
    else { introStart = Math.min(introStart, performance.now() - 1300); invalidate() }
  }
  assets()
  setGraph(options.nodes, options.links)
  resize()
  observer.observe(canvas)
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', endPointer)
  canvas.addEventListener('lostpointercapture', endPointer)
  canvas.addEventListener('pointerleave', pointerLeave)
  canvas.addEventListener('wheel', wheel, { passive: false })
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', visibility)
  motion.addEventListener('change', changeMotion)
  canvas.style.touchAction = 'none'
  canvas.style.cursor = 'grab'
  invalidate()

  return {
    setGraph,
    setPalette(style, cosmic, themeDark) {
      palette = paletteFor(style, cosmic, themeDark)
      // Read the site's actual surface in both day and night modes, including future palettes.
      if (!cosmic) palette.base = getComputedStyle(canvas).getPropertyValue('--vp-c-bg').trim() || palette.base
      assets(); invalidate()
    },
    setActive(id) { if (id !== active) { active = id; spotlightStart = performance.now(); invalidate() } },
    setMatches(ids) { matches = new Set(ids); spotlightStart = performance.now(); invalidate() },
    setLabels(mode) { labelMode = mode; invalidate() },
    focus,
    fit,
    zoom(factor) { zoomAt(factor, { x: width / 2, y: height / 2 }) },
    getNodePosition(id) { const star = byId.get(id); return star ? { x: star.x, y: star.y } : undefined },
    dispose() {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', endPointer)
      canvas.removeEventListener('pointercancel', endPointer)
      canvas.removeEventListener('lostpointercapture', endPointer)
      canvas.removeEventListener('pointerleave', pointerLeave)
      canvas.removeEventListener('wheel', wheel)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', changeMotion)
      for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
      pointers.clear(); clouds = []; sprites = []; pulses = []
    },
  }
}
