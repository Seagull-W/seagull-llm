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
const loadFailed = ref(false)
let loaded = false
let trigger: HTMLElement | null = null
let oldOverflow = ''

async function ensurePages() {
  if (loaded || loading.value) return
  loading.value = true
  loadFailed.value = false
  try {
    pages.value = (await import('../data/tagged-pages.data')).data
    loaded = true
  } catch {
    loadFailed.value = true
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
  if (trigger?.isConnected) trigger.focus({ preventScroll: true })
  trigger = null
}

function focusableElements() {
  if (!dialog.value) return []
  return [...dialog.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details > summary:first-of-type, [tabindex]:not([tabindex="-1"])'
  )].filter(element => {
    if (element.tabIndex < 0 || element.closest('[inert], [aria-hidden="true"]')
      || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return false
    // Chromium may retain layout rectangles for controls inside a closed details.
    // Only its first summary (and that summary's descendants) stays tabbable.
    for (let ancestor = element.parentElement; ancestor && ancestor !== dialog.value; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open
        && !ancestor.querySelector(':scope > summary')?.contains(element)) return false
    }
    return true
  })
}

function containFocus(event: FocusEvent) {
  if (open.value && dialog.value && !dialog.value.contains(event.target as Node)) {
    dialog.value.focus({ preventScroll: true })
  }
}

function onKeydown(event: KeyboardEvent) {
  // The atlas gets the first Escape to dismiss its command/search surface.
  if (event.defaultPrevented) return
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeGraph()
  } else if (event.key === 'Tab' && open.value) {
    const controls = focusableElements()
    const first = controls[0], last = controls[controls.length - 1]
    if (!first) {
      event.preventDefault()
      dialog.value?.focus({ preventScroll: true })
    } else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
      event.preventDefault()
      last.focus({ preventScroll: true })
    } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) {
      event.preventDefault()
      first.focus({ preventScroll: true })
    }
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
  document.addEventListener('focusin', containFocus)
})
onUnmounted(() => {
  closeGraph()
  window.removeEventListener('seagull-graph', openGraph)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('focusin', containFocus)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="kg-modal">
      <div v-if="open" ref="dialog" class="kg-modal-overlay" role="dialog" aria-modal="true" aria-label="全屏知识星图" tabindex="-1">
        <KnowledgeGraph v-if="pages.length" :pages="pages" fullscreen @close="closeGraph" />
        <div v-else class="kg-modal-loading" role="status">
          <span>{{ loadFailed ? '星图暂时未能加载' : '正在点亮知识星图…' }}</span>
          <button v-if="loadFailed" type="button" @click="ensurePages">重新加载</button>
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
  background: #060a10;
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
.kg-modal-enter-active {
  transition: opacity 1s cubic-bezier(.2, .65, .3, 1);
}
.kg-modal-leave-active {
  transition: opacity .3s ease;
  pointer-events: none;
}
.kg-modal-enter-from,
.kg-modal-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .kg-modal-enter-active,
  .kg-modal-leave-active {
    transition: none;
  }
}
</style>
