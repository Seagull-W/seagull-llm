<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import AnnotationNotebook from './AnnotationNotebook.vue'
import ReaderIcon from './ReaderIcon.vue'

const props = defineProps<{
  src: string
  title: string
  outline: { title: string; page: number }[]
  backHref: string
  backLabel: string
  sourceHref?: string
  sourceLabel?: string
  webHref?: string
  initialPage?: number
}>()
const container = ref<HTMLDivElement>()
const pagesElement = ref<HTMLDivElement>()
const page = ref(1)
const fingerprint = ref('')
const notebook = ref<InstanceType<typeof AnnotationNotebook>>()
const author=ref(false)
const notesOpen = ref(false), areaMode = ref(false)
const notebookId = useId()
const outlineNav = ref<HTMLElement>(), files = ref<HTMLDetailsElement>()
const count = ref(0)
const percent = ref(100)
const ready = ref(false)
const error = ref('')
const external = computed(() => /^https?:\/\//i.test(props.src))
const originalFile = computed(() => props.initialPage && props.initialPage > 1 ? props.src + '#page=' + props.initialPage : props.src)
const fileInput = ref<HTMLInputElement>()
let localCopy = ''
const showOutline = ref(false)
const scaleMode = ref('page-width')
const zoomOptions = [50, 75, 100, 125, 150, 200, 300, 400]
const customZoom = computed(() => !zoomOptions.includes(percent.value))
type NativeOutline = NonNullable<Awaited<ReturnType<PDFDocumentProxy['getOutline']>>>
let outlineRequest: Promise<void> | undefined
const nativeOutline = ref<{ title: string; dest: NativeOutline[number]['dest']; depth: number }[]>([])
let links: PDFLinkService | undefined
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
  links = undefined
  outlineRequest = undefined
  nativeOutline.value = []
  if (task) void task.destroy()
  task = undefined
}

async function load() {
  const run = ++generation
  dispose()
  ready.value = false
  fingerprint.value = ''; author.value=false
  areaMode.value = false
  error.value = ''
  count.value = 0
  page.value = 1
  scaleMode.value = 'page-width'
  if (!props.src) return
  try {
    // Browser-only, sequential imports: the viewer consumes the core's pdfjsLib.
    const pdfjs = await import('pdfjs-dist')
    const { PDFViewer, PDFLinkService, EventBus } = await import('pdfjs-dist/web/pdf_viewer.mjs')
    if (run !== generation || !container.value || !pagesElement.value) return
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    lifecycle = new AbortController()
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    links = linkService
    viewer = new PDFViewer({
      container: container.value,
      viewer: pagesElement.value,
      eventBus,
      linkService,
      abortSignal: lifecycle.signal,
      // Keep text selection, disable editing and executable PDF scripting.
      annotationMode: pdfjs.AnnotationMode.ENABLE,
      annotationEditorMode: pdfjs.AnnotationEditorType.NONE,
      // Let PDF.js expose the bounds of embedded images alongside its native text layer.
      imagesRightClickMinSize: 1,
      maxCanvasPixels: 32 * 1024 * 1024
    })
    linkService.setViewer(viewer)
    eventBus.on('pagesinit', () => {
      if (run !== generation || !viewer) return
      viewer.currentScaleValue = 'page-width'
      ready.value = true
      applyPage()
      if (showOutline.value) readOutline()
    })
    eventBus.on('pagechanging', (event: { pageNumber: number }) => {
      if (run === generation) page.value = event.pageNumber
    })
    eventBus.on('pagerendered', (event: { pageNumber: number }) => {
      if (run === generation) notebook.value?.pageRendered(event.pageNumber)
    })
    eventBus.on('scalechanging', (event: { scale: number }) => {
      if (run === generation) percent.value = Math.round(event.scale * 100)
    })
    task = pdfjs.getDocument({ url: localCopy || props.src, isEvalSupported: false })
    const document = await task.promise
    if (run !== generation || !viewer) return
    count.value = document.numPages
    fingerprint.value = document.fingerprints[0]
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

function clearCopy() {
  if (localCopy) URL.revokeObjectURL(localCopy)
  localCopy = ''
}
function readCopy(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  clearCopy()
  localCopy = URL.createObjectURL(file)
  void load()
}
function goTo(value: number) {
  if (!viewer || !ready.value) return
  viewer.currentPageNumber = Math.max(1, Math.min(count.value, Math.round(value) || 1))
}
function applyPage() {
  const hashPage = Number(new URLSearchParams(location.hash.slice(1)).get('page'))
  goTo(props.initialPage || hashPage || 1)
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
  if (showOutline.value) readOutline()
  await nextTick()
  if (scaleMode.value === 'page-width') fitWidth()
}
function readOutline() {
  const pdf = viewer?.pdfDocument
  if (!pdf || props.outline.length || outlineRequest) return
  outlineRequest = pdf.getOutline().then(items => {
    if (viewer?.pdfDocument !== pdf || !items) return
    function flatten(rows: NativeOutline, depth: number): typeof nativeOutline.value {
      return rows.flatMap(row => [{ title: row.title, dest: row.dest, depth }, ...flatten(row.items, depth + 1)])
    }
    nativeOutline.value = flatten(items, 0)
  }).catch(() => { /* The page list remains available when a PDF has an unreadable outline. */ })
}
function followDestination(dest: NativeOutline[number]['dest']) {
  if (outlineNav.value && getComputedStyle(outlineNav.value).position === 'absolute') showOutline.value = false
  if (dest) void links?.goToDestination(dest)
}
function followOutline(value: number) {
  if (outlineNav.value && getComputedStyle(outlineNav.value).position === 'absolute') showOutline.value = false
  goTo(value)
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
function closeFiles() { if (files.value) files.value.open = false }
function outsideFiles(event: Event) {
  if (files.value?.open && !files.value.contains(event.target as Node)) closeFiles()
}
function keyboard(event: KeyboardEvent) {
  if (event.key==='Escape' && files.value?.open) {
    closeFiles(); files.value.querySelector('summary')?.focus()
    return
  }
  if (!(event.ctrlKey || event.metaKey)) return
  if (['+', '=', '-', '0'].includes(event.key)) {
    event.preventDefault()
    if (event.key === '0') fitWidth()
    else zoom(event.key === '-' ? -1 : 1)
  }
}
onMounted(() => {
  void load()
  window.addEventListener('hashchange', applyPage)
})
watch(() => props.src, () => { clearCopy(); void load() })
watch(() => props.initialPage, applyPage)
onBeforeUnmount(() => {
  ++generation
  window.removeEventListener('hashchange', applyPage)
  dispose()
  clearCopy()
})
</script>

<template>
    <main id="pdf-reading" class="pdf-reader pdf-reading-mode" aria-labelledby="paper-title" @keydown="keyboard" @pointerdown.capture="outsideFiles" @focusin="outsideFiles">
      <div class="pdf-toolbar" role="toolbar" aria-label="PDF 工具栏">
        <div class="pdf-tools">
          <a class="pdf-back" :href="backHref" :title="backLabel" :aria-label="backLabel"><ReaderIcon name="previous" /><span class="tool-label">{{backLabel}}</span></a>
          <button aria-label="切换 PDF 目录" title="目录" :aria-expanded="showOutline" @click="toggleOutline"><ReaderIcon name="outline" /><span class="tool-label">目录</span></button>
        </div>
        <h1 id="paper-title" class="pdf-title" :title="title">{{title}}</h1>
        <div class="pdf-tools pdf-pages">
          <button aria-label="上一页" :disabled="!ready || page<=1" @click="goTo(page-1)"><ReaderIcon name="previous" /></button>
          <input type="number" aria-label="PDF 页码" :value="page" min="1" :max="count" :disabled="!ready" @change="pageInput" />
          <span class="page-count">/ {{count || '—'}}</span>
          <button aria-label="下一页" :disabled="!ready || page>=count" @click="goTo(page+1)"><ReaderIcon name="next" /></button>
        </div>
        <div class="pdf-tools pdf-zoom">
          <button class="zoom-step" aria-label="缩小 PDF" :disabled="!ready || percent<=25" @click="zoom(-1)">−</button>
          <select aria-label="PDF 缩放比例" :value="percent" :disabled="!ready" @change="setZoom(Number(($event.target as HTMLSelectElement).value))">
            <option v-if="customZoom" :value="percent">{{percent}}%</option>
            <option v-for="value in zoomOptions" :key="value" :value="value">{{value}}%</option>
          </select>
          <button class="zoom-step" aria-label="放大 PDF" :disabled="!ready || percent>=400" @click="zoom(1)">+</button>
          <button aria-label="适应宽度" title="适应宽度" :disabled="!ready" @click="fitWidth"><ReaderIcon name="fit" /></button>
        </div>
        <div class="pdf-tools pdf-writing">
          <details v-if="src" ref="files" class="pdf-files">
            <summary aria-label="PDF 文件" title="PDF 文件"><ReaderIcon name="download" /><span class="tool-label">文件</span></summary>
            <div class="menu-items" @click="closeFiles">
              <a :href="src" :download="title+'.pdf'">下载 PDF</a>
              <a :href="originalFile" target="_blank" rel="noopener">在新窗口打开 PDF</a>
              <a v-if="webHref" :href="webHref">网页版正文</a>
              <a v-if="sourceHref" :href="sourceHref" target="_blank" rel="noopener">{{sourceLabel || '查看来源'}}</a>
            </div>
          </details>
          <button v-if="author" aria-label="框选批注" :aria-pressed="areaMode" :disabled="!ready" title="框选批注" @click="notebook?.toggleBox()"><ReaderIcon name="box" /><span class="tool-label">框选</span></button>
          <button class="notes-toggle" :aria-controls="notebookId" :aria-expanded="notesOpen" :disabled="!ready" @click="notesOpen=!notesOpen"><ReaderIcon name="notes" />笔记</button>
        </div>
      </div>
      <div class="pdf-body">
        <nav v-show="showOutline" ref="outlineNav" class="pdf-outline" aria-label="PDF 目录">
          <button v-for="(item,index) in outline" :key="index" :class="{nested:/^\d+\.\d+\.\d+/.test(item.title)}" :disabled="!ready" @click="followOutline(item.page)">
            <span>{{item.title}}</span><small>{{item.page}}</small>
          </button>
          <button v-for="(item,index) in nativeOutline" :key="'native-'+index" :class="{nested:item.depth>0}" :disabled="!item.dest" @click="followDestination(item.dest)">{{item.title}}</button>
          <template v-if="showOutline && !outline.length && !nativeOutline.length"><button v-for="number in count" :key="number" @click="followOutline(number)">第 {{number}} 页</button></template>
        </nav>
        <div class="pdf-stage">
          <div ref="container" class="pdf-scroll" tabindex="0" aria-label="PDF 文档滚动区域"><div ref="pagesElement" class="pdfViewer"></div></div>
          <div v-if="error && external" class="pdf-fallback">
            <div class="fallback-actions" role="status"><span>此文件未能载入批注工具。</span>
              <a :href="originalFile" target="_blank" rel="noopener">打开原文件</a>
              <button @click="fileInput?.click()">选择本地 PDF 继续批注</button>
              <input ref="fileInput" type="file" hidden accept="application/pdf,.pdf" @change="readCopy" />
            </div>
            <object :data="originalFile" type="application/pdf" :aria-label="title"></object>
          </div>
          <div v-else-if="!ready || error" class="pdf-status" role="status">
            <span v-if="error">{{error}} · <a :href="originalFile" target="_blank" rel="noopener noreferrer">打开原文件</a></span>
            <span v-else>加载中…</span>
          </div>
        </div>
        <AnnotationNotebook v-if="fingerprint" :id="notebookId" :key="fingerprint" ref="notebook" v-model:open="notesOpen" :target="pagesElement" :document="'pdf:'+fingerprint" :title="title" kind="pdf" @author="author=$event" @box-mode="areaMode=$event" />
      </div>
    </main>
</template>

<style scoped>
.pdf-reader { container:pdfspace / inline-size; display:flex; flex-direction:column; width:100%; min-width:0; height:100vh; height:100dvh; overflow:hidden; background:var(--nw-bg); color:var(--nw-text); font-family:var(--vp-font-family-base,sans-serif); }
.pdf-title { margin:0; max-width:30vw; font:600 14px/1.5 var(--vp-font-family-base,sans-serif); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pdf-files { position:relative; }
.pdf-files summary { display:flex; align-items:center; justify-content:center; gap:5px; height:30px; min-width:28px; padding:3px 6px; border-radius:5px; cursor:pointer; list-style:none; }
.pdf-files summary::-webkit-details-marker { display:none; }
.pdf-files summary:hover,.pdf-files[open] summary { background:var(--nw-soft); }
.pdf-files .menu-items { z-index:12; }
.pdf-files .menu-items a { justify-content:flex-start; white-space:nowrap; }
.pdf-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:3px 10px; flex:none; min-height:44px; padding:5px 10px; border-bottom:1px solid var(--nw-line); font-size:13px; line-height:1.4; }
.pdf-tools { display:flex; align-items:center; gap:2px; }.pdf-tools+.pdf-tools:not(.pdf-writing) { padding-left:8px; border-left:1px solid var(--nw-line); }.pdf-writing { margin-left:auto; }
.pdf-toolbar :is(button,a,select,input) { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-width:28px; height:30px; padding:3px 6px; border:0; border-radius:5px; background:transparent; color:var(--nw-text); font:inherit; text-decoration:none; }
.pdf-toolbar :is(button,a,select) { cursor:pointer; }.pdf-toolbar button:hover:not(:disabled),.pdf-toolbar a:hover { background:var(--nw-soft); }
.pdf-toolbar :is(button,select):disabled { opacity:.4; cursor:default; }
.pdf-toolbar [aria-pressed=true],.pdf-toolbar [aria-expanded=true],.pdf-toolbar .notes-toggle { color:var(--nw-accent); }
.pdf-toolbar .notes-toggle { padding-inline:9px; background:var(--nw-soft); }.pdf-toolbar .notes-toggle[aria-expanded=true] { background:var(--nw-tint); }
.pdf-toolbar input { width:3.1em; min-width:0; text-align:center; background:var(--nw-soft); appearance:textfield; }
.pdf-toolbar input::-webkit-inner-spin-button { appearance:none; }.pdf-toolbar select { padding:2px; max-width:64px; background:var(--nw-bg); }
.page-count { color:var(--nw-muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
.pdf-body,.pdf-stage { position:relative; flex:1; min-width:0; min-height:0; }.pdf-body { display:flex; }.pdf-stage { background:var(--nw-canvas); }
.pdf-outline { width:clamp(164px,17%,216px); flex:none; overflow:auto; overscroll-behavior:contain; padding:8px; scrollbar-width:thin; border-right:1px solid var(--nw-line); background:var(--nw-bg); }
.pdf-outline button { display:flex; width:100%; align-items:baseline; gap:6px; padding:6px 8px; text-align:left; font-size:13px; line-height:1.5; border-radius:4px; cursor:pointer; }.pdf-outline button:hover { background:var(--nw-soft); }.pdf-outline small { margin-left:auto; color:var(--nw-muted); }.pdf-outline .nested { padding-left:16px; }
.pdf-scroll { position:absolute; inset:0; overflow:auto; overscroll-behavior:contain; touch-action:pan-x pan-y; }
.pdf-status { position:absolute; inset:0; display:grid; place-content:center; color:var(--nw-muted); background:var(--nw-canvas); }.pdf-status a { color:var(--nw-accent); }
.pdf-fallback { position:absolute; inset:0; display:flex; flex-direction:column; background:var(--nw-canvas); }
.pdf-fallback object { flex:1; min-height:0; width:100%; border:0; }
.fallback-actions { display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px; padding:8px 14px; background:var(--nw-bg); font-size:13px; }
.fallback-actions :is(a,button) { color:var(--nw-accent); text-decoration:underline; cursor:pointer; }
:global([data-visual-style='grace-archive'] .pdf-reader .pdf-title) { font-family:var(--grace-serif); }
:global([data-visual-style='pixel-voyage'] .pdf-reader .pdf-pages) { font-family:var(--vp-font-family-mono); }
.pdf-scroll :deep(.pdfViewer) { padding:12px 0; --page-bg-color:#fff; --page-border:1px solid #d8dee1; }
.pdf-scroll :deep(.page) { margin:0 auto 12px; border-image:none; box-sizing:content-box; }
.pdf-reader :is(button,input,select,a,summary,.pdf-scroll):focus-visible { outline:2px solid var(--nw-accent); outline-offset:-2px; }
@container pdfspace (max-width:980px) { .pdf-title { position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip-path:inset(50%); } }
@container pdfspace (max-width:999px) { .pdf-outline { position:absolute; inset:0 auto 0 0; z-index:8; width:min(230px,72%); box-shadow:3px 0 8px #21353a10; } }
@container pdfspace (max-width:679px) { .pdf-body { flex-direction:column; }.tool-label { display:none; }.pdf-toolbar { gap:2px; padding:4px; }.pdf-tools+.pdf-tools:not(.pdf-writing) { padding-left:3px; }.zoom-step { display:none!important; } }
@container pdfspace (max-width:439px) { .pdf-toolbar { justify-content:space-between; }.pdf-writing { margin-left:0; }.pdf-toolbar :is(button,a) { min-width:24px; padding-inline:3px; }.pdf-tools { gap:0; }.pdf-toolbar input { width:2.3em; }.pdf-toolbar .notes-toggle { padding-inline:5px; } }
</style>
