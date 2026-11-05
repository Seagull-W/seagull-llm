import { moonDuration, poseAt, sheets, stage, type Cue, type Fighter, type Move } from './choreography'

export interface Scene {
  move: Move | null
  time: number
  clock: number
  ringAge: number
  charged: boolean
  gathering: number
  still: boolean
}

type Brush = CanvasRenderingContext2D
type Point = [number, number]
const tau = Math.PI * 2
const silk = '#aff0d6'
const pearl = '#fff2d2'
const scarlet = '#bd5048'

function line(c: Brush, color: string, width: number, ...points: Point[]) {
  c.beginPath()
  c.strokeStyle = color
  c.lineWidth = width
  c.moveTo(...points[0])
  for (const point of points.slice(1)) c.lineTo(...point)
  c.stroke()
}

function spark(c: Brush, x: number, y: number, size: number, color: string) {
  x = Math.round(x)
  y = Math.round(y)
  c.fillStyle = color
  c.fillRect(x - size, y, 2 * size + 1, 1)
  c.fillRect(x, y - size, 1, 2 * size + 1)
}

function insect(c: Brush, x: number, y: number, t: number) {
  const wing = Math.floor(t / 110) % 2 ? 1 : 2
  c.fillStyle = silk
  c.fillRect(x - 2, y - wing, 2, 1)
  c.fillRect(x + 1, y - wing, 2, 1)
  c.fillStyle = pearl
  c.fillRect(x, y, 1, 2)
}

// The rear thread passes behind the sprites and the near thread crosses in front of their feet.
function moon(c: Brush, age: number, front: boolean) {
  if (age < 0 || age >= moonDuration) return
  const unfurl = Math.min(1, age / 560)
  if (unfurl === 0) return
  const rx = 109 * (0.20 + 0.8 * unfurl), ry = 18 * (0.35 + 0.65 * unfurl)
  const cx = 222, cy = 127, from = front ? 0 : Math.PI
  const angle = Math.PI * unfurl
  c.save()
  c.globalAlpha = Math.min(1, (moonDuration - age) / 650) * (front ? .94 : .76)
  for (const [width, color] of [[2.6,'#538f92'],[.8,silk]] as const) {
    c.beginPath()
    c.ellipse(cx, cy, rx, ry, 0, from, from + angle)
    c.strokeStyle = color
    c.lineWidth = width
    c.stroke()
  }
  const a = from + (unfurl < 1 ? angle : (age / 1400) % Math.PI)
  const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a)
  insect(c, x, y - 1, age)
  if (!front && age < 520) {
    c.beginPath()
    c.moveTo(197, 93)
    c.quadraticCurveTo((197 + x) / 2, 87 + 9 * unfurl, x, y)
    c.strokeStyle = silk
    c.lineWidth = .7
    c.stroke()
  }
  c.restore()
}

function shadow(c: Brush, x: number, lift: number, radius: number) {
  const size = 1 - Math.min(.52, lift / 140)
  c.fillStyle = `rgba(23,36,39,${.38 * size})`
  c.beginPath()
  c.ellipse(x, stage.ground - .4, radius * size, 2.1 * size, 0, 0, tau)
  c.fill()
}

function sprite(c: Brush, image: HTMLImageElement, who: Fighter, pose: string, x: number, lift: number, breath: number) {
  const atlas = sheets[who]
  const poses: readonly string[] = atlas.poses
  const i = poses.indexOf(pose)
  const xScale = atlas.scale, yScale = xScale * breath
  c.drawImage(image, (i % atlas.columns) * atlas.width, Math.floor(i / atlas.columns) * atlas.height,
    atlas.width, atlas.height, Math.round((x - atlas.pivotX * xScale) * 2) / 2,
    Math.round((stage.ground - lift - atlas.pivotY * yScale) * 2) / 2, atlas.width * xScale, atlas.height * yScale)
}

function thunderbugs(c: Brush, x: number, y: number, p: number) {
  for (let i = 0; i < 11; i++) {
    const phase = (p * 1.35 + i / 11) % 1
    const a = i * 2.4 + phase * 1.9
    const d = (1 - phase) * (28 + 8 * (i % 4))
    insect(c, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * .56), p * 1100 + i * 70)
  }
}

// A tapered blade path with a thin hot edge. In local coordinates the blade sweeps up and right.
function crescent(c: Brush, x: number, y: number, size: number, angle: number, color: string) {
  c.save()
  c.translate(x, y)
  c.rotate(angle)
  c.scale(size, size)
  c.beginPath()
  c.moveTo(0, 0)
  c.quadraticCurveTo(22, -7, 40, -48)
  c.quadraticCurveTo(28, -10, 0, 0)
  c.fillStyle = color
  c.fill()
  c.beginPath()
  c.moveTo(13, -8)
  c.quadraticCurveTo(30, -22, 39, -45)
  c.strokeStyle = pearl
  c.lineWidth = .8
  c.stroke()
  c.restore()
}

function delayedCuts(c: Brush, x: number, y: number, p: number, count: number, echo: boolean) {
  for (let i = 0; i < count; i++) {
    const t = p * (count + 2) - i
    if (t <= 0 || t >= 2.3) continue
    const dx = (i % 3 - 1) * 4 + (echo ? i * 2 : 0), dy = echo ? (i % 2) * 4 : i * 2 - 5
    const reach = Math.min(1, t * 4) * (echo ? 11 : 16)
    c.save()
    c.globalAlpha *= Math.min(1, 2.3 - t)
    const tilt = echo && i % 2 ? -1 : 1
    line(c, echo ? '#70cbbf' : scarlet, 2, [x + dx - reach * tilt, y + dy + reach * .8], [x + dx + reach * tilt, y + dy - reach])
    line(c, echo ? '#e2ffec' : '#ffe5ba', .7, [x + dx - reach * .65 * tilt, y + dy + reach * .55], [x + dx + reach * tilt, y + dy - reach])
    spark(c, x + dx, y + dy, 1, pearl)
    c.restore()
  }
}

function effect(c: Brush, [start, duration, kind, x, y]: Cue, time: number) {
  const p = (time - start) / duration
  if (p < 0 || p >= 1) return
  c.save()
  c.globalAlpha = Math.min(1, (1 - p) * 4)
  switch (kind) {
    case 'cut':
      crescent(c, x + 9, y - 3, .88, -.03, '#a9d3bd')
      break
    case 'finish':
      crescent(c, x - 26 + p * 3, y + 12, 1.15, .39, scarlet)
      crescent(c, x - 17, y + 14, .94, .36, '#edb17a')
      break
    case 'fall':
      crescent(c, x - 7, y - 14 + p * 3, 1.06, 2.38, '#e4a38e')
      break
    case 'thrust':
      line(c, pearl, .8, [x - 13, y + .5], [x + 21 * Math.min(1,p * 4), y])
      spark(c, x + 17, y, 2, '#f5c48a')
      break
    case 'draw': {
      const end = x - 60 + 119 * Math.min(1, p * 5)
      line(c, scarlet, 2, [x - 60, y + 3], [end, y - 4])
      line(c, pearl, .85, [x - 49, y + 2.5], [end, y - 4])
      break
    }
    case 'break':
      delayedCuts(c, x, y, p, 7, false)
      break
    case 'spark':
      spark(c, x, y, 1 + Math.round(2.5 * Math.sin(p * Math.PI)), '#ebfaff')
      break
    case 'tail':
      c.beginPath()
      c.ellipse(x - 15, y - 3, 92, 12, -.06, .27, Math.PI * Math.min(1, .22 + p * 2))
      c.strokeStyle = '#e1cca2'
      c.lineWidth = 1
      c.stroke()
      break
    case 'charge': {
      const level = Math.min(2, Math.floor(p * 3)), t = (p * 3) % 1
      const color = ['#dbf0f2','#f3ce78','#f08369'][level]
      for (let i = 0; i < 6; i++) {
        const a = i * tau / 6 + .35, d = (1 - t) * 17 + 2
        line(c, color, .9, [x + Math.cos(a) * d, y + Math.sin(a) * d], [x + Math.cos(a) * (d + 3), y + Math.sin(a) * (d + 3)])
      }
      spark(c, x, y, 1 + level, color)
      break
    }
    case 'bugs':
      thunderbugs(c, x, y, p)
      break
    case 'bolt':
      line(c, silk, 1.6, [x + 15, y - 9], [x + 5, y - 3], [x + 8, y - 9], [x - 7, y + 2], [x - 4, y - 4], [x - 20, y + 5])
      break
    case 'dust':
      c.fillStyle = '#cbbd9d'
      for (let i = 0; i < 6; i++) c.fillRect(Math.round(x - i * 1.8 - p * (i + 4)), Math.round(y - Math.sin(p * Math.PI) * (2 + i % 3)), 2, 1)
      break
  }
  c.restore()
}

export function paintHunt(c: Brush, images: Record<Fighter, HTMLImageElement>, scene: Scene) {
  const {move, time, clock, ringAge} = scene
  const h = move ? poseAt(move.hunter, time) : {pose: 'guard', x: sheets.hunter.home, lift: 0}
  const z = move ? poseAt(move.zinogre, time) : {pose: 'guard', x: sheets.zinogre.home, lift: 0}
  if (scene.gathering >= 0 && !move) z.pose = scene.gathering < 340 ? 'crouch' : 'howl'
  if (scene.charged && z.pose === 'guard') z.pose = 'charged'
  const breathe = !move && !scene.still
  c.setTransform(2, 0, 0, 2, 0, 0)
  c.clearRect(0, 0, stage.width, stage.height)
  c.imageSmoothingEnabled = false
  moon(c, ringAge, false)
  shadow(c, h.x, h.lift, 19)
  shadow(c, z.x + 8, z.lift, 48)
  sprite(c, images.zinogre, 'zinogre', z.pose, z.x, z.lift, breathe ? 1 - .009 * (1 + Math.sin(clock / 880)) : 1)
  sprite(c, images.hunter, 'hunter', h.pose, h.x, h.lift, breathe ? 1 - .007 * (1 + Math.sin(clock / 620)) : 1)
  if (z.pose === 'charged' && Math.floor(clock / 210) % 6 < 2) {
    line(c, silk, .9, [z.x - 24,77], [z.x - 18,71], [z.x - 18,75], [z.x - 13,69])
    spark(c, z.x + 6, 80, 1, pearl)
  }
  if (scene.gathering >= 0 && !move) thunderbugs(c, z.x - 16, 85, scene.gathering / 1500)
  if (move) {
    for (const cue of move.cues) effect(c, cue, time)
    if (move.counter && ringAge >= 0 && ringAge < moonDuration) {
      const [hit, x, y] = move.counter
      delayedCuts(c, x, y, (time - hit - 70) / 470, 4, true)
    }
  }
  moon(c, ringAge, true)
}
