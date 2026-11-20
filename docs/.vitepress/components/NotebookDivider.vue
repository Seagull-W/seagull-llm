<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { Kind } from './annotations'
const props = defineProps<{ kind: Kind; docked?: boolean }>()
const grip = ref<HTMLElement>(), width = ref(336), max = ref(560)
const min = 244
const key = 'seagull-notebook-width-v2:'+props.kind
let preferred = 336, host: HTMLElement, observer: ResizeObserver
let drag: { x: number; width: number; id: number } | undefined
function fit() {
  if (props.kind === 'pdf') {
    const body = host.closest<HTMLElement>('.pdf-body')!
    const outline = body.querySelector<HTMLElement>('.pdf-outline')
    const left = outline && getComputedStyle(outline).position !== 'absolute' ? outline.offsetWidth : 0
    max.value = Math.max(min,Math.min(680,Math.floor((body.clientWidth-left)*.48)))
  } else {
    const available = props.docked ? Math.floor(innerWidth*.42) : innerWidth-36
    max.value = Math.max(min,Math.min(680,available))
  }
  width.value = Math.round(Math.max(min,Math.min(preferred,max.value)))
  host.style.setProperty('--notebook-width',width.value+'px')
  if (props.kind==='html') document.body.style.setProperty('--notebook-width',width.value+'px')
}
function change(value: number) { preferred=Math.max(min,Math.min(value,max.value)); fit() }
function remember() { try { localStorage.setItem(key,String(preferred)) } catch {} }
function start(e: PointerEvent) {
  if (e.button!==0) return
  e.preventDefault()
  drag={x:e.clientX,width:width.value,id:e.pointerId}; grip.value!.setPointerCapture(e.pointerId)
  document.body.classList.add('notebook-resizing')
}
function move(e: PointerEvent) { if (drag?.id===e.pointerId) change(drag.width+drag.x-e.clientX) }
function end() {
  if (!drag) return
  const id=drag.id; drag=undefined
  if (grip.value?.hasPointerCapture(id)) grip.value.releasePointerCapture(id)
  remember(); document.body.classList.remove('notebook-resizing')
}
function keyboard(e: KeyboardEvent) {
  if (!['Home','End','ArrowLeft','ArrowRight'].includes(e.key)) return
  e.preventDefault()
  change(e.key==='Home'?min:e.key==='End'?max.value:width.value+(e.key==='ArrowLeft'?1:-1)*(e.shiftKey?60:16))
  remember()
}
onMounted(() => {
  host=grip.value!.parentElement!
  try { const value=Number(localStorage.getItem(key) || localStorage.getItem('seagull-notebook-width-v1')); if (value>=min && value<=760) preferred=value } catch {}
  fit(); observer=new ResizeObserver(fit)
  observer.observe(host.closest('.pdf-body')?.querySelector('.pdf-stage') || document.documentElement)
  window.addEventListener('resize',fit)
})
onBeforeUnmount(() => { end(); observer?.disconnect(); window.removeEventListener('resize',fit); if (props.kind==='html') document.body.style.removeProperty('--notebook-width') })
</script>
<template>
  <div ref="grip" class="notebook-resizer" role="separator" aria-orientation="vertical" aria-label="调整笔记栏宽度" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="width" tabindex="0" title="左右拖动，双击恢复默认宽度" @pointerdown="start" @pointermove="move" @pointerup="end" @lostpointercapture="end" @pointercancel="end" @keydown="keyboard" @dblclick="preferred=336;fit();remember()"><span /></div>
</template>
