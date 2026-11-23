<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { readingPortraitFor } from './grace-characters'
import { themeImagePath } from '../theme/visual-styles'

const host = ref<HTMLElement>()
const readingEdge = ref(0)
const { page, isDark } = useData()
const switches = ref(0)
watch(isDark, () => { switches.value++ }, { flush: 'sync' })
const portrait = computed(() => readingPortraitFor(page.value.relativePath, isDark.value, Math.floor(switches.value / 2)))
let observer: ResizeObserver | undefined

onMounted(() => {
  const doc = host.value?.closest('.Layout')?.querySelector('.VPDoc')
  const paper = doc?.querySelector('.content-container')
  if (!doc || !paper) return

  const measure = () => {
    const outline = doc.querySelector('.reader-toc')
    const leftmost = outline?.getClientRects().length ? outline : paper
    readingEdge.value = Math.floor(leftmost.getBoundingClientRect().left)
  }
  observer = new ResizeObserver(measure)
  observer.observe(doc)
  observer.observe(paper)
  // The toolbar spans the reading grid and resizes when the outline collapses.
  const tools = doc.querySelector('.reader-tools')
  if (tools) observer.observe(tools)
  measure()
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div ref="host" class="grace-reading-portrait" :style="{ '--reading-edge': readingEdge + 'px' }" aria-hidden="true" inert>
    <img v-if="readingEdge >= 140" :src="withBase(themeImagePath(portrait))"
      alt="" width="425" height="972" decoding="async" draggable="false" />
  </div>
</template>

<style scoped>
.grace-reading-portrait {
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 2;
  width: min(var(--reading-edge), calc(76vh * 425 / 972), 425px);
  pointer-events: none;
  user-select: none;
}
.grace-reading-portrait img {
  /* Every pose uses the same frame when the reader switches the light. */
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 425 / 972;
  object-fit: cover;
}
@media print {
  .grace-reading-portrait { display: none; }
}
</style>
