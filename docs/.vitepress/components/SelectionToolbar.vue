<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import ReaderIcon from './ReaderIcon.vue'
import HighlightColorPicker from './HighlightColorPicker.vue'
const props = defineProps<{ point: { x: number; y: number; bottom: number }; pdf: boolean; imageOnly:boolean; highlightColor?:string }>()
const emit = defineEmits<{ highlight: []; color: [value: string | undefined]; comment: []; copy: []; favorite: []; bookmark: []; dismiss: [] }>()
const root = ref<HTMLElement>(), more = ref(false), width = ref(268), height = ref(38)
const view = ref({ left:0, top:0, width:0, height:0 })
const picking = ref(false), trigger = ref<HTMLButtonElement>(), picker = ref<InstanceType<typeof HighlightColorPicker>>()
const pickerId = useId()
async function toggleColor() {
  more.value = false
  picking.value = !picking.value
  await nextTick()
  if (picking.value) picker.value?.focusChoice()
  else trigger.value?.focus({ preventScroll: true })
}
let observer: ResizeObserver
const viewportEvents = new AbortController()
function measureViewport() {
  const viewport = window.visualViewport
  view.value = { left:viewport?.offsetLeft ?? 0, top:viewport?.offsetTop ?? 0,
    width:viewport?.width ?? innerWidth, height:viewport?.height ?? innerHeight }
}
const style = computed(() => {
  const { left, top, width:vw, height:vh } = view.value
  if (!vw || !vh) return { display:'none' }
  const w = Math.min(width.value, vw-12), h = Math.min(height.value, vh-12)
  const x = Math.max(left+6, Math.min(left+vw-w-6, props.point.x-w/2))
  const above = props.point.y-h-8
  const y = Math.max(top+6, Math.min(top+vh-h-6, above >= top+6 ? above : props.point.bottom+8))
  return { left:x+'px', top:y+'px', maxWidth:vw-12+'px', maxHeight:vh-12+'px' }
})
onMounted(() => {
  measureViewport()
  const options = { signal:viewportEvents.signal }
  const viewport = window.visualViewport || window
  viewport.addEventListener('resize',measureViewport,options)
  window.visualViewport?.addEventListener('scroll',measureViewport,options)
  observer = new ResizeObserver(() => {
    const r = root.value!.getBoundingClientRect(); width.value=r.width; height.value=r.height
  })
  observer.observe(root.value!)
})
onBeforeUnmount(() => { viewportEvents.abort(); observer?.disconnect() })
</script>
<template>
  <div ref="root" class="selection-actions" role="toolbar" aria-label="选文操作" :style="style" @pointerdown.prevent @mousedown.prevent>
    <div class="selection-row">
      <button title="高亮" @click="emit('highlight')"><ReaderIcon name="mark" />高亮</button>
      <button ref="trigger" type="button" class="selection-color-trigger" aria-label="高亮颜色" title="高亮颜色"
        :aria-expanded="picking" :aria-controls="pickerId" @click="toggleColor">
        <i aria-hidden="true" :style="{backgroundColor: highlightColor}"></i><span aria-hidden="true">⌄</span>
      </button>
      <button title="添加批注（Enter）" aria-keyshortcuts="Enter" @click="emit('comment')"><ReaderIcon name="comment" />添加批注<kbd aria-hidden="true">↵</kbd></button>
      <button :aria-label="imageOnly?'复制图像':'复制选文'" :title="imageOnly?'复制图像':'复制选文'" @click="emit('copy')"><ReaderIcon name="copy" /></button>
      <button aria-label="收藏选文" title="收藏" @click="emit('favorite')"><ReaderIcon name="star" /></button>
      <button aria-label="更多选文操作" title="更多操作" :aria-expanded="more" @click="picking=false;more=!more"><ReaderIcon name="more" /></button>
    </div>
    <HighlightColorPicker v-if="picking" :id="pickerId" ref="picker" :color="highlightColor" @color="emit('color',$event)" @close="toggleColor" />
    <div v-if="more" class="selection-more">
      <button v-if="pdf" @click="emit('bookmark')"><ReaderIcon name="bookmark" />为选文位置加书签</button>
      <button @click="emit('dismiss')">取消选区</button>
    </div>
  </div>
</template>
<style scoped>
.selection-actions { box-sizing:border-box; width:max-content; overflow:auto; }
.selection-row { flex-wrap:wrap; }
.selection-row .selection-color-trigger { gap:2px; min-width:26px; padding-inline:3px; }
.selection-color-trigger i { width:11px; height:11px; border:1px solid var(--nw-muted); border-radius:50%; background:var(--nw-accent); }
.selection-actions .highlight-color-picker { width:280px; max-width:100%; }
</style>
