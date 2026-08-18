<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'

const canvasRef = ref<HTMLCanvasElement>()

const CANVAS_W = 720
const CANVAS_H = 420
const LENS_RADIUS = 85
const ZOOM = 1.5
const CHANNEL_OFFSET = 3

let img: HTMLImageElement
let offCanvas: HTMLCanvasElement
let offCtx: CanvasRenderingContext2D
let ctx: CanvasRenderingContext2D
let rafId = 0
let mouseX = -10000
let mouseY = -10000
let isHovering = false
let lensAlpha = 0

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')!

  offCanvas = document.createElement('canvas')
  offCtx = offCanvas.getContext('2d')!

  img = new Image()
  img.src = withBase('/seagull.png')
  img.onload = () => {
    offCanvas.width = CANVAS_W
    offCanvas.height = CANVAS_H
    offCtx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
    animate()
  }

  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseleave', onMouseLeave)
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onMouseLeave)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseleave', onMouseLeave)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onMouseLeave)
  }
})

function onMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  mouseX = (e.clientX - rect.left) * (CANVAS_W / rect.width)
  mouseY = (e.clientY - rect.top) * (CANVAS_H / rect.height)
  isHovering = true
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const t = e.touches[0]
  mouseX = (t.clientX - rect.left) * (CANVAS_W / rect.width)
  mouseY = (t.clientY - rect.top) * (CANVAS_H / rect.height)
  isHovering = true
}

function onMouseLeave() {
  isHovering = false
}

function animate() {
  const target = isHovering ? 1 : 0
  lensAlpha += (target - lensAlpha) * 0.18

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.drawImage(offCanvas, 0, 0)

  if (lensAlpha > 0.01) {
    drawLens()
  }

  rafId = requestAnimationFrame(animate)
}

function drawMagnified(mx: number, my: number, r: number, zoom: number) {
  const srcSize = (r * 2) / zoom
  const srcX = mx - srcSize / 2
  const srcY = my - srcSize / 2
  ctx.drawImage(
    offCanvas,
    srcX, srcY, srcSize, srcSize,
    mx - r, my - r, r * 2, r * 2
  )
}

function drawLens() {
  const r = LENS_RADIUS
  const mx = mouseX
  const my = mouseY
  const a = lensAlpha

  // --- Clipped region: magnified image + chroma fringe ---
  ctx.save()
  ctx.beginPath()
  ctx.arc(mx, my, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  drawMagnified(mx, my, r, ZOOM)

  // Chromatic fringe at edges
  const fringe = ctx.createRadialGradient(mx, my, r * 0.65, mx, my, r)
  fringe.addColorStop(0, 'rgba(0,0,0,0)')
  fringe.addColorStop(0.7, 'rgba(255, 0, 80, 0.06)')
  fringe.addColorStop(0.85, 'rgba(0, 255, 100, 0.06)')
  fringe.addColorStop(1, 'rgba(0, 80, 255, 0.12)')
  ctx.fillStyle = fringe
  ctx.fillRect(mx - r, my - r, r * 2, r * 2)

  ctx.restore()

  // --- Glass border & highlights (not clipped) ---
  ctx.save()
  ctx.globalAlpha = a

  // Outer glow
  const glow = ctx.createRadialGradient(mx, my, r * 0.9, mx, my, r + 12)
  glow.addColorStop(0, 'rgba(37, 99, 235, 0)')
  glow.addColorStop(0.5, 'rgba(37, 99, 235, 0.06)')
  glow.addColorStop(1, 'rgba(37, 99, 235, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(mx, my, r + 12, 0, Math.PI * 2)
  ctx.fill()

  // Inner shadow ring
  const inner = ctx.createRadialGradient(mx, my, r * 0.75, mx, my, r)
  inner.addColorStop(0, 'rgba(0, 0, 0, 0)')
  inner.addColorStop(0.8, 'rgba(0, 0, 0, 0)')
  inner.addColorStop(1, 'rgba(15, 23, 42, 0.35)')
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.arc(mx, my, r, 0, Math.PI * 2)
  ctx.fill()

  // Glass border
  ctx.beginPath()
  ctx.arc(mx, my, r, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * a})`
  ctx.lineWidth = 2
  ctx.stroke()

  // Outer thin ring
  ctx.beginPath()
  ctx.arc(mx, my, r + 1, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(37, 99, 235, ${0.2 * a})`
  ctx.lineWidth = 1
  ctx.stroke()

  // Highlight arc (top-left)
  ctx.beginPath()
  ctx.arc(mx, my, r - 3, Math.PI * 1.1, Math.PI * 1.45)
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * a})`
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.stroke()

  // Small highlight dot
  ctx.beginPath()
  ctx.arc(mx - r * 0.35, my - r * 0.35, r * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * a})`
  ctx.fill()

  ctx.restore()
}
</script>

<template>
  <div class="seagull-lens">
    <canvas
      ref="canvasRef"
      :width="CANVAS_W"
      :height="CANVAS_H"
      class="seagull-lens__canvas"
    ></canvas>
  </div>
</template>

<style scoped>
.seagull-lens {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 20px 50px -20px rgba(15, 23, 42, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  cursor: crosshair;
  transition: box-shadow 0.3s, transform 0.3s;
}

.seagull-lens:hover {
  box-shadow:
    0 30px 60px -20px rgba(15, 23, 42, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  transform: translateY(-2px);
}

.seagull-lens__canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 720 / 420;
}

@media (max-width: 768px) {
  .seagull-lens {
    border-radius: 16px;
  }
}
</style>
