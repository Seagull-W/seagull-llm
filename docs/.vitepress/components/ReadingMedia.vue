<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { onContentUpdated } from 'vitepress'
const viewer = ref<HTMLDialogElement>()
const source = ref(''), caption = ref(''), original = ref(false), imageWidth = ref(0)
let trigger: HTMLElement | SVGElement | null = null, objectUrl = '', oldOverflow = '', opened = false
let observer: ResizeObserver | undefined
function restore() {
  if (!opened) return
  opened = false; document.documentElement.style.overflow = oldOverflow
  trigger?.focus({ preventScroll: true })
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = '' }
}
function close() { viewer.value?.close(); restore() }
async function open(element: HTMLImageElement | SVGSVGElement) {
  trigger = element
  const figure = element.closest('figure, .figure')
  caption.value = figure?.querySelector('figcaption, .caption')?.textContent?.trim() || element.getAttribute('alt') || element.getAttribute('aria-label') || '图示'
  if (element instanceof HTMLImageElement) { source.value = element.currentSrc || element.src; imageWidth.value = element.naturalWidth }
  else {
    const clone = element.cloneNode(true) as SVGSVGElement
    const width = element.viewBox.baseVal.width || element.getBoundingClientRect().width
    const height = element.viewBox.baseVal.height || element.getBoundingClientRect().height
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height))
    // Preserve computed diagram colors/fonts when the SVG leaves its document.
    const originals = [element, ...element.querySelectorAll('*')]
    ;[clone, ...clone.querySelectorAll('*')].forEach((node, i) => {
      const css = getComputedStyle(originals[i])
      for (const key of ['fill', 'stroke', 'color', 'font-family', 'font-size', 'font-weight']) (node as SVGElement).style.setProperty(key, css.getPropertyValue(key))
    })
    objectUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
    source.value = objectUrl; imageWidth.value = width
  }
  original.value = false
  oldOverflow = document.documentElement.style.overflow; opened = true
  await nextTick(); viewer.value?.showModal(); document.documentElement.style.overflow = 'hidden'
}
function activate(event: MouseEvent | KeyboardEvent) {
  const target = (event.target as Element).closest('[data-reading-zoom]') as HTMLImageElement | SVGSVGElement | null
  if (!target) return
  if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return
  event.preventDefault(); open(target)
}
async function copy(event: MouseEvent) {
  const button = (event.target as Element).closest<HTMLButtonElement>('.plain-code-copy')
  if (!button) return
  try { await navigator.clipboard.writeText(button.parentElement!.querySelector('pre')!.textContent || ''); button.textContent = '已复制' }
  catch { button.textContent = '请选择代码复制' }
  setTimeout(() => { if (button.isConnected) button.textContent = '复制' }, 1600)
}
function measureTables() {
  document.querySelectorAll<HTMLElement>('.reader-table').forEach(wrap => {
    const wide = wrap.scrollWidth > wrap.clientWidth + 2
    wrap.classList.toggle('is-scrollable', wide)
    wrap.tabIndex = wide ? 0 : -1
    const hint = wrap.previousElementSibling as HTMLElement
    if (hint?.classList.contains('table-scroll-hint')) hint.hidden = !wide
  })
}
function enhance() {
  close(); observer?.disconnect()
  const root = document.querySelector('.academic-reading .vp-doc')
  if (!root) return
  root.querySelectorAll<HTMLImageElement | SVGSVGElement>('img, figure > svg, .figure > svg, .thread-diagram svg').forEach(element => {
    if (element.closest('a, button, mjx-container') || element.hasAttribute('data-reading-zoom')) return
    element.setAttribute('data-reading-zoom', ''); element.setAttribute('role', 'button'); element.setAttribute('tabindex', '0')
    element.setAttribute('aria-label', '放大查看：' + (element.getAttribute('alt') || element.closest('figure, .figure')?.querySelector('figcaption, .caption')?.textContent?.trim() || '图示'))
    element.setAttribute('aria-haspopup', 'dialog')
  })
  root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
    const existing = table.closest<HTMLElement>('.reader-table')
    if (existing) { observer?.observe(existing); return }
    let wrap = table.parentElement!
    if (!wrap.classList.contains('note-table')) { wrap = document.createElement('div'); table.before(wrap); wrap.append(table) }
    wrap.classList.add('reader-table'); wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '表格，宽表可左右滚动')
    const hint = document.createElement('p'); hint.className = 'table-scroll-hint'; hint.textContent = '左右滑动查看完整表格 →'; hint.hidden = true; wrap.before(hint)
    observer?.observe(wrap)
  })
  root.querySelectorAll<HTMLPreElement>('pre').forEach(pre => {
    if (pre.closest('div[class*="language-"], .plain-code')) return
    const wrap = document.createElement('div'); wrap.className = 'plain-code'; pre.before(wrap); wrap.append(pre)
    const button = document.createElement('button'); button.className = 'plain-code-copy'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码'); wrap.append(button)
  })
  measureTables()
}
onContentUpdated(enhance)
onMounted(() => {
  observer = new ResizeObserver(measureTables)
  enhance()
  document.addEventListener('click', activate); document.addEventListener('keydown', activate); document.addEventListener('click', copy)
  window.addEventListener('resize', measureTables)
})
onUnmounted(() => { close(); observer?.disconnect(); document.removeEventListener('click', activate); document.removeEventListener('keydown', activate); document.removeEventListener('click', copy); window.removeEventListener('resize', measureTables) })
</script>
<template>
  <dialog ref="viewer" class="image-viewer" aria-label="放大查看图示" @close="restore" @click="($event.target === viewer) && close()">
    <header><button @click="original = !original">{{ original ? '适应屏幕' : '原尺寸查看' }}</button><a :href="source" target="_blank" rel="noopener">打开原图 ↗</a><button autofocus aria-label="关闭图片" @click="close">关闭</button></header>
    <div class="image-viewport" :class="{ original }"><img v-if="source" :src="source" :alt="caption" :style="original ? { width: imageWidth + 'px' } : undefined" /></div>
    <p>{{ caption }}</p>
  </dialog>
</template>
<style>
[data-reading-zoom] { cursor:zoom-in; }
.image-viewer { inset:0; width:100vw; max-width:100vw; height:100dvh; max-height:100dvh; padding:0; margin:0; border:0; color:var(--vp-c-text-1); background:var(--vp-c-bg); }
.image-viewer[open] { display:flex; flex-direction:column; }
.image-viewer header { display:flex; align-items:center; gap:20px; padding:10px 20px; border-bottom:1px solid var(--vp-c-divider); flex:none; font-size:13px; }
.image-viewer button { min-height:40px; color:var(--vp-c-brand-1); }
.image-viewer header button:last-child { margin-left:auto; }
.image-viewport { overflow:auto; flex:1; min-height:0; display:flex; padding:16px; overscroll-behavior:contain; }
.image-viewport img { display:block; max-width:100%; max-height:100%; object-fit:contain; margin:auto; }
.image-viewport.original { display:block; }
.image-viewport.original img { max-width:none; max-height:none; height:auto; margin:0 auto; }
.image-viewer > p { flex:none; max-height:20dvh; overflow:auto; margin:0; padding:12px 20px; border-top:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); font-size:13px; line-height:1.8; }
.Layout .vp-doc .reader-table { max-width:100%; overflow:auto; margin:12px 0 28px; border-radius:0; }
.Layout .vp-doc .reader-table table { display:table; width:max-content; min-width:100%; max-width:none; margin:0; overflow:visible; }
.Layout .vp-doc .reader-table :is(th,td) { min-width:110px; max-width:360px; white-space:normal; }
.Layout.Layout .VPDoc .vp-doc .reader-table :is(th,td):not(:first-child) { min-width:160px; }
.Layout .vp-doc .reader-table :is(th,td):first-child { max-width:150px; }
.Layout .vp-doc .reader-table.is-scrollable th:first-child, .Layout .vp-doc .reader-table.is-scrollable td:first-child { position:sticky; left:0; z-index:1; background:var(--vp-c-bg-alt); box-shadow:1px 0 var(--vp-c-divider); }
.Layout.academic-reading .vp-doc .table-scroll-hint { font:12px/1.6 var(--vp-font-family-base); color:var(--vp-c-text-2); margin:20px 0 6px; }
.plain-code { position:relative; }
.Layout .VPDoc .vp-doc .plain-code pre { padding-top:40px; }
.plain-code-copy { position:absolute; top:6px; right:8px; padding:4px 10px; min-height:30px; font:12px var(--vp-font-family-base); border:1px solid var(--vp-c-divider); border-radius:4px; background:var(--vp-c-bg); color:var(--vp-c-text-2); }
@media print { .table-scroll-hint,.plain-code-copy { display:none; } }
</style>
