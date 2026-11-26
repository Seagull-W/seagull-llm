<script setup lang="ts">
import { defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vitepress'
import type { ContentEntry } from '../content-catalog'

const KnowledgeGraph = defineAsyncComponent(() => import('./KnowledgeGraph.vue'))

const route = useRoute()
const open = ref(false)
const dialog = ref<HTMLElement>()
const pages = shallowRef<ContentEntry[]>([])
const loading = ref(false)
let loaded = false
let trigger: HTMLElement | null = null
let oldOverflow = ''

async function ensurePages() {
  if (loaded || loading.value) return
  loading.value = true
  try {
    pages.value = (await import('../data/tagged-pages.data')).data
    loaded = true
  } finally {
    loading.value = false
  }
}

async function openGraph() {
  if (open.value) return
  trigger = document.activeElement as HTMLElement | null
  oldOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  open.value = true
  void ensurePages()
  await nextTick()
  dialog.value?.focus({ preventScroll: true })
}

function closeGraph() {
  if (!open.value) return
  open.value = false
  document.documentElement.style.overflow = oldOverflow
  trigger?.focus({ preventScroll: true })
  trigger = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeGraph()
  } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
    event.preventDefault()
    if (open.value) closeGraph()
    else void openGraph()
  }
}

watch(() => route.path, closeGraph)

onMounted(() => {
  window.addEventListener('seagull-graph', openGraph)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  closeGraph()
  window.removeEventListener('seagull-graph', openGraph)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="kg-modal">
      <div v-if="open" ref="dialog" class="kg-modal-overlay" role="dialog" aria-modal="true" aria-label="全屏知识星图" tabindex="-1">
        <KnowledgeGraph v-if="pages.length" :pages="pages" fullscreen @close="closeGraph" />
        <div v-else class="kg-modal-loading">
          <span>正在点亮知识星图…</span>
          <button type="button" @click="closeGraph">关闭</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.kg-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  width: 100vw;
  height: 100dvh;
  background: #070b14;
  outline: none;
}
.kg-modal-loading {
  display: grid;
  place-content: center;
  gap: 14px;
  height: 100%;
  color: #cbd5e1;
  font-size: 14px;
  text-align: center;
}
.kg-modal-loading button {
  margin-inline: auto;
  padding: 6px 14px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  color: #f1f5f9;
  font-size: 12px;
}
.kg-modal-enter-active,
.kg-modal-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.kg-modal-enter-from,
.kg-modal-leave-to {
  opacity: 0;
  transform: scale(0.985);
}
@media (prefers-reduced-motion: reduce) {
  .kg-modal-enter-active,
  .kg-modal-leave-active {
    transition: none;
  }
}
</style>
