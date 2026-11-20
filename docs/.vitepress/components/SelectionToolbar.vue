<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ReaderIcon from './ReaderIcon.vue'
const props = defineProps<{ point: { x: number; y: number; bottom: number }; pdf: boolean; imageOnly:boolean }>()
const emit = defineEmits<{ highlight: []; comment: []; copy: []; favorite: []; bookmark: []; dismiss: [] }>()
const root = ref<HTMLElement>(), more = ref(false), width = ref(268), height = ref(38)
let observer: ResizeObserver
const style = computed(() => {
  const x = Math.max(6,Math.min(innerWidth-width.value-6,props.point.x-width.value/2))
  const above = props.point.y-height.value-8
  const y = above >= 6 ? above : Math.min(innerHeight-height.value-6,props.point.bottom+8)
  return { left:x+'px', top:Math.max(6,y)+'px' }
})
onMounted(() => {
  observer = new ResizeObserver(() => {
    const r = root.value!.getBoundingClientRect(); width.value=r.width; height.value=r.height
  })
  observer.observe(root.value!)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div ref="root" class="selection-actions" role="toolbar" aria-label="选文操作" :style="style" @pointerdown.prevent @mousedown.prevent>
    <div class="selection-row">
      <button title="高亮" @click="emit('highlight')"><ReaderIcon name="mark" />高亮</button>
      <button title="添加批注（Enter）" aria-keyshortcuts="Enter" @click="emit('comment')"><ReaderIcon name="comment" />添加批注<kbd aria-hidden="true">↵</kbd></button>
      <button :aria-label="imageOnly?'复制图像':'复制选文'" :title="imageOnly?'复制图像':'复制选文'" @click="emit('copy')"><ReaderIcon name="copy" /></button>
      <button aria-label="收藏选文" title="收藏" @click="emit('favorite')"><ReaderIcon name="star" /></button>
      <button aria-label="更多选文操作" title="更多操作" :aria-expanded="more" @click="more=!more"><ReaderIcon name="more" /></button>
    </div>
    <div v-if="more" class="selection-more">
      <button v-if="pdf" @click="emit('bookmark')"><ReaderIcon name="bookmark" />为选文位置加书签</button>
      <button @click="emit('dismiss')">取消选区</button>
    </div>
  </div>
</template>
