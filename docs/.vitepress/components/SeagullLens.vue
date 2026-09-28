<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'

const containerRef = ref<HTMLElement>()
const imageRef = ref<HTMLImageElement>()
const canvasRef = ref<HTMLCanvasElement>()

const CANVAS_W = 720
const CANVAS_H = 420
const LENS_RADIUS = 85
const ZOOM = 1.5

let sourceCanvas: HTMLCanvasElement
let context: CanvasRenderingContext2D | null = null
let hoverQuery: MediaQueryList | undefined
let motionQuery: MediaQueryList | undefined
let sourceReady = false
let frameId = 0
let lastTime = 0
let pointerX = 0
let pointerY = 0
let previousX = 0
let previousY = 0
let hasPreviousFrame = false
let isHovering = false
let lensAlpha = 0

function canInteract() {
  return hoverQuery?.matches === true && motionQuery?.matches === false
}

function clearPreviousLens() {
  if (!context || !hasPreviousFrame) return
  const size = LENS_RADIUS + 5
  context.clearRect(previousX - size, previousY - size, size * 2, size * 2)
  hasPreviousFrame = false
}

function stopAnimation() {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
  lastTime = 0
  lensAlpha = 0
  isHovering = false
  clearPreviousLens()
}

function onMediaChange() {
  if (!canInteract()) stopAnimation()
}

function prepareSource() {
  const image = imageRef.value
  if (!image?.naturalWidth || !sourceCanvas) return
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) return
  sourceContext.drawImage(image, 0, 0, CANVAS_W, CANVAS_H)
  sourceReady = true
  if (isHovering) scheduleFrame()
}

function scheduleFrame() {
  if (!frameId && sourceReady && canInteract()) {
    frameId = requestAnimationFrame(drawFrame)
  }
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || !canInteract()) return
  const bounds = containerRef.value?.getBoundingClientRect()
  if (!bounds) return
  pointerX = (event.clientX - bounds.left) * CANVAS_W / bounds.width
  pointerY = (event.clientY - bounds.top) * CANVAS_H / bounds.height
  isHovering = true
  scheduleFrame()
}

function onPointerLeave() {
  isHovering = false
  scheduleFrame()
}

function drawFrame(now: number) {
  frameId = 0
  if (!context) return

  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60
  lastTime = now
  const target = isHovering ? 1 : 0
  const duration = target ? 0.28 : 0.35
  lensAlpha += (target - lensAlpha) * (1 - Math.pow(0.001, dt / duration))
  if (Math.abs(target - lensAlpha) < 0.005) lensAlpha = target

  // The image remains an ordinary <img>; only the small transparent lens is repainted.
  clearPreviousLens()
  if (lensAlpha > 0) {
    drawLens(context)
    previousX = pointerX
    previousY = pointerY
    hasPreviousFrame = true
  }

  // A stationary lens needs no animation frames once its fade has finished.
  if (lensAlpha !== target) scheduleFrame()
  else lastTime = 0
}

function drawLens(ctx: CanvasRenderingContext2D) {
  const x = pointerX
  const y = pointerY
  const radius = LENS_RADIUS
  const sourceSize = radius * 2 / ZOOM

  ctx.save()
  ctx.globalAlpha = lensAlpha
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(
    sourceCanvas,
    x - sourceSize / 2, y - sourceSize / 2, sourceSize, sourceSize,
    x - radius, y - radius, radius * 2, radius * 2
  )
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = lensAlpha
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

onMounted(() => {
  context = canvasRef.value?.getContext('2d') ?? null
  sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = CANVAS_W
  sourceCanvas.height = CANVAS_H
  hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  hoverQuery.addEventListener('change', onMediaChange)
  motionQuery.addEventListener('change', onMediaChange)
  if (imageRef.value?.complete) prepareSource()
})

onUnmounted(() => {
  stopAnimation()
  hoverQuery?.removeEventListener('change', onMediaChange)
  motionQuery?.removeEventListener('change', onMediaChange)
})
</script>

<template>
  <div
    ref="containerRef"
    class="seagull-lens"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <img
      ref="imageRef"
      class="seagull-lens__image"
      :src="withBase('/seagull.png')"
      alt="一只展翅飞翔的海鸥插画"
      :width="CANVAS_W"
      :height="CANVAS_H"
      fetchpriority="high"
      @load="prepareSource"
    >
    <canvas
      ref="canvasRef"
      class="seagull-lens__canvas"
      :width="CANVAS_W"
      :height="CANVAS_H"
      aria-hidden="true"
    ></canvas>
  </div>
</template>

<style scoped>
.seagull-lens {
  position: relative;
  overflow: hidden;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  box-shadow: 0 20px 50px -20px rgba(15, 23, 42, 0.15);
}

.seagull-lens__image,
.seagull-lens__canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 720 / 420;
}

.seagull-lens__canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .seagull-lens { cursor: crosshair; }
}

@media (max-width: 768px) {
  .seagull-lens { border-radius: 16px; }
}
</style>
