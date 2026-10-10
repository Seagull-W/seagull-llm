<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PDFDocumentLoadingTask } from 'pdfjs-dist'
import type { PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'

const props = defineProps<{
  src: string
  title: string
  outline: { title: string; page: number }[]
}>()
const container = ref<HTMLDivElement>()
const pagesElement = ref<HTMLDivElement>()
const page = ref(1)
const count = ref(0)
const percent = ref(100)
const ready = ref(false)
const error = ref('')
const showOutline = ref(false)
const scaleMode = ref('page-width')
const zoomOptions = [50, 75, 100, 125, 150, 200, 300, 400]
const customZoom = computed(() => !zoomOptions.includes(percent.value))
let viewer: PDFViewer | undefined
let task: PDFDocumentLoadingTask | undefined
let lifecycle: AbortController | undefined
let resizeObserver: ResizeObserver | undefined
let generation = 0
let pinchDistance = 0
let pinchScale = 1

function dispose() {
  lifecycle?.abort()
  resizeObserver?.disconnect()
  viewer?.setDocument(null)
  viewer = undefined
  if (task) void task.destroy()
  task = undefined
}

async function load() {
  const run = ++generation
  dispose()
  ready.value = false
  error.value = ''
  count.value = 0
  page.value = 1
  scaleMode.value = 'page-width'
  try {
    // Browser-only, sequential imports: the viewer consumes the core's pdfjsLib.
    const pdfjs = await import('pdfjs-dist')
    const { PDFViewer, PDFLinkService, EventBus } = await import('pdfjs-dist/web/pdf_viewer.mjs')
    if (run !== generation || !container.value || !pagesElement.value) return
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    lifecycle = new AbortController()
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    viewer = new PDFViewer({
      container: container.value,
      viewer: pagesElement.value,
      eventBus,
      linkService,
      abortSignal: lifecycle.signal,
      // Keep text selection, disable editing and executable PDF scripting.
      annotationMode: pdfjs.AnnotationMode.ENABLE,
      annotationEditorMode: pdfjs.AnnotationEditorType.NONE,
      maxCanvasPixels: 32 * 1024 * 1024
    })
    linkService.setViewer(viewer)
    eventBus.on('pagesinit', () => {
      if (run !== generation || !viewer) return
      viewer.currentScaleValue = 'page-width'
      ready.value = true
    })
    eventBus.on('pagechanging', (event: { pageNumber: number }) => {
      if (run === generation) page.value = event.pageNumber
    })
    eventBus.on('scalechanging', (event: { scale: number }) => {
      if (run === generation) percent.value = Math.round(event.scale * 100)
    })
    task = pdfjs.getDocument({ url: props.src, isEvalSupported: false })
    const document = await task.promise
    if (run !== generation || !viewer) return
    count.value = document.numPages
    linkService.setDocument(document)
    viewer.setDocument(document)
    container.value.addEventListener('wheel', wheelZoom, { passive: false, signal: lifecycle.signal })
    container.value.addEventListener('touchstart', touchStart, { passive: true, signal: lifecycle.signal })
    container.value.addEventListener('touchmove', touchMove, { passive: false, signal: lifecycle.signal })
    resizeObserver = new ResizeObserver(() => {
      if (ready.value && scaleMode.value === 'page-width') fitWidth()
    })
    resizeObserver.observe(container.value)
  } catch (cause) {
    if (run !== generation) return
    error.value = 'PDF 加载失败'
    console.error(cause)
  }
}

function goTo(value: number) {
  if (!viewer || !ready.value) return
  viewer.currentPageNumber = Math.max(1, Math.min(count.value, Math.round(value) || 1))
}
function pageInput(event: Event) {
  goTo(Number((event.target as HTMLInputElement).value))
}
function setZoom(value: number) {
  if (!viewer || !ready.value) return
  scaleMode.value = 'custom'
  viewer.currentScale = Math.min(4, Math.max(0.25, value / 100))
}
function zoom(direction: number) {
  setZoom(percent.value + direction * 25)
}
function fitWidth() {
  if (!viewer) return
  scaleMode.value = 'page-width'
  viewer.currentScaleValue = 'page-width'
}
async function toggleOutline() {
  showOutline.value = !showOutline.value
  await nextTick()
  if (scaleMode.value === 'page-width') fitWidth()
}
function followOutline(value: number) {
  goTo(value)
  if (window.matchMedia('(max-width: 640px)').matches) showOutline.value = false
}
function wheelZoom(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  if (!viewer || !ready.value) return
  const scale = Math.min(4, Math.max(0.25, viewer.currentScale * Math.exp(-event.deltaY * 0.002)))
  scaleMode.value = 'custom'
  viewer.updateScale({ scaleFactor: scale / viewer.currentScale, origin: [event.clientX, event.clientY], drawingDelay: 150 })
}
function distance(event: TouchEvent) {
  return Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY)
}
function touchStart(event: TouchEvent) {
  pinchDistance = event.touches.length === 2 ? distance(event) : 0
  pinchScale = viewer?.currentScale || 1
}
function touchMove(event: TouchEvent) {
  if (event.touches.length !== 2 || !pinchDistance) return
  event.preventDefault()
  setZoom(pinchScale * distance(event) / pinchDistance * 100)
}
function keyboard(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  if (['+', '=', '-', '0'].includes(event.key)) {
    event.preventDefault()
    if (event.key === '0') fitWidth()
    else zoom(event.key === '-' ? -1 : 1)
  }
}
onMounted(load)
watch(() => props.src, load)
onBeforeUnmount(() => { ++generation; dispose() })
</script>

<template>
  <section class="pdf-reader" :aria-label="`${title} PDF 阅读器`" @keydown="keyboard">
    <div class="pdf-toolbar" role="toolbar" aria-label="PDF 工具栏">
      <button type="button" :aria-expanded="showOutline" aria-label="切换 PDF 目录" @click="toggleOutline">目录</button>
      <div class="pdf-controls">
        <button type="button" aria-label="上一页" :disabled="!ready || page <= 1" @click="goTo(page - 1)">‹</button>
        <input type="number" aria-label="PDF 页码" :value="page" min="1" :max="count" :disabled="!ready" @change="pageInput" />
        <span>/ {{ count || '—' }}</span>
        <button type="button" aria-label="下一页" :disabled="!ready || page >= count" @click="goTo(page + 1)">›</button>
      </div>
      <div class="pdf-controls">
        <button type="button" aria-label="缩小 PDF" :disabled="!ready || percent <= 25" @click="zoom(-1)">−</button>
        <select aria-label="PDF 缩放比例" :value="percent" :disabled="!ready" @change="setZoom(Number(($event.target as HTMLSelectElement).value))">
          <option v-if="customZoom" :value="percent">{{ percent }}%</option>
          <option v-for="value in zoomOptions" :key="value" :value="value">{{ value }}%</option>
        </select>
        <button type="button" aria-label="放大 PDF" :disabled="!ready || percent >= 400" @click="zoom(1)">+</button>
        <button type="button" :disabled="!ready" @click="fitWidth">适应宽度</button>
      </div>
      <a class="pdf-download" :href="src" :download="`${title}.pdf`">下载</a>
    </div>
    <div class="pdf-body">
      <nav v-if="showOutline" class="pdf-outline" aria-label="PDF 目录">
        <button v-for="(item, index) in outline" :key="index" type="button" :class="{ nested: /^\d+\.\d+\.\d+/.test(item.title) }" :disabled="!ready" @click="followOutline(item.page)">
          <span>{{ item.title }}</span><small>{{ item.page }}</small>
        </button>
        <template v-if="!outline.length">
          <button v-for="number in count" :key="number" type="button" @click="followOutline(number)">第 {{ number }} 页</button>
        </template>
      </nav>
      <div class="pdf-stage">
        <div ref="container" class="pdf-scroll" tabindex="0" aria-label="PDF 文档滚动区域">
          <div ref="pagesElement" class="pdfViewer"></div>
        </div>
        <div v-if="!ready || error" class="pdf-status" role="status">
          <template v-if="error">{{ error }} · <a :href="src" target="_blank" rel="noopener noreferrer">打开原文件</a></template>
          <template v-else>加载中…</template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pdf-reader {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--vp-nav-height, 64px) - 100px);
  min-height: 420px;
  max-height: 1100px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
}
.pdf-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
}
.pdf-controls { display: flex; align-items: center; gap: 4px; }
.pdf-toolbar button, .pdf-toolbar select, .pdf-toolbar input {
  height: 32px;
  min-width: 32px;
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
}
.pdf-toolbar input { width: 54px; }
.pdf-toolbar button:not(:disabled) { cursor: pointer; }
.pdf-toolbar button:hover:not(:disabled) { background: var(--vp-c-default-soft); }
.pdf-toolbar button:disabled { opacity: .4; }
.pdf-download { margin-left: auto; font-size: 13px; }
.pdf-body { display: flex; flex: 1; min-height: 0; min-width: 0; position: relative; }
.pdf-outline {
  width: 240px;
  flex-shrink: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border-right: 1px solid var(--vp-c-divider);
  padding: 8px;
  background: var(--vp-c-bg);
}
.pdf-outline button {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 8px;
  text-align: left;
  font-size: 13px;
  line-height: 1.5;
  border-radius: 4px;
  cursor: pointer;
}
.pdf-outline button:hover { background: var(--vp-c-default-soft); }
.pdf-outline small { margin-left: auto; color: var(--vp-c-text-3); }
.pdf-outline .nested { padding-left: 20px; }
.pdf-stage { flex: 1; min-width: 0; position: relative; background: #525659; }
.pdf-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
}
.pdf-status { position: absolute; inset: 0; display: grid; place-content: center; color: white; background: #525659; }
.pdf-status a { color: #a8d5ff; }
.pdf-scroll :deep(.pdfViewer) { padding: 12px 0; }
.pdf-scroll :deep(.page) { margin-bottom: 12px; }
.pdf-reader :is(button, input, select, a, .pdf-scroll):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -2px; }
@media (max-width: 640px) {
  .pdf-reader { height: calc(100dvh - 170px); min-height: 360px; }
  .pdf-toolbar { gap: 6px; padding: 6px; }
  .pdf-outline { position: absolute; inset: 0 auto 0 0; max-width: 80%; z-index: 5; box-shadow: 4px 0 12px #0003; }
}
</style>
