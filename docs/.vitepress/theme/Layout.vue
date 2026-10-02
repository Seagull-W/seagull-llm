<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import SeagullLens from '../components/SeagullLens.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import ChapterTag from '../components/ChapterTag.vue'
import HilbertQuote from '../components/HilbertQuote.vue'

const { Layout } = DefaultTheme
const route = useRoute()
const { frontmatter } = useData()
const isHome = computed(() => route.path === '/')

// ===== 侧边栏状态 =====
const sidebarWidth = ref(272)
const sidebarVisible = ref(true)
let isResizing = false
let activePointerId = -1
let resizeRafId = 0
let pendingWidth = 0
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 500
const DEFAULT_SIDEBAR_WIDTH = 272

function loadState() {
  try {
    const w = localStorage.getItem('vp-sidebar-width')
    const v = localStorage.getItem('vp-sidebar-visible')
    if (w) {
      const parsed = parseInt(w, 10)
      if (!isNaN(parsed)) sidebarWidth.value = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, parsed))
    }
    if (v === 'false') sidebarVisible.value = false
  } catch {
    /* ignore */
  }
}

function applyWidth() {
  document.documentElement.style.setProperty(
    '--vp-sidebar-width',
    sidebarWidth.value + 'px'
  )
}

function applyVisibility() {
  document.body.classList.toggle('vp-sidebar-collapsed', !sidebarVisible.value)
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
  applyVisibility()
  try {
    localStorage.setItem('vp-sidebar-visible', String(sidebarVisible.value))
  } catch {
    /* ignore */
  }
}

function saveWidth() {
  try {
    localStorage.setItem('vp-sidebar-width', String(sidebarWidth.value))
  } catch {
    /* ignore */
  }
}

function setWidth(width: number) {
  sidebarWidth.value = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width))
  applyWidth()
  saveWidth()
}

function startResize(e: PointerEvent) {
  if (e.button !== 0 || !sidebarVisible.value) return
  e.preventDefault()
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  isResizing = true
  activePointerId = e.pointerId
  pendingWidth = sidebarWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onPointerMove(e: PointerEvent) {
  if (!isResizing || e.pointerId !== activePointerId) return
  const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX))
  if (newWidth !== pendingWidth) {
    pendingWidth = newWidth
    if (resizeRafId === 0) {
      resizeRafId = requestAnimationFrame(flushResize)
    }
  }
}

function flushResize() {
  resizeRafId = 0
  if (pendingWidth !== sidebarWidth.value) {
    sidebarWidth.value = pendingWidth
    applyWidth()
  }
}

function finishResize(e?: PointerEvent) {
  if (!isResizing || (e && e.pointerId !== activePointerId)) return
  isResizing = false
  activePointerId = -1
  if (resizeRafId !== 0) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = 0
  }
  flushResize()
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  saveWidth()
}

function cancelResize() {
  finishResize()
}

function onResizeKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 40 : 16
  if (e.key === 'ArrowLeft') setWidth(sidebarWidth.value - step)
  else if (e.key === 'ArrowRight') setWidth(sidebarWidth.value + step)
  else if (e.key === 'Home') setWidth(MIN_SIDEBAR_WIDTH)
  else if (e.key === 'End') setWidth(MAX_SIDEBAR_WIDTH)
  else return
  e.preventDefault()
}

// 双击 resize handle 恢复默认宽度
function resetWidth() {
  setWidth(DEFAULT_SIDEBAR_WIDTH)
}

onMounted(() => {
  loadState()
  applyWidth()
  applyVisibility()
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', finishResize)
  document.addEventListener('pointercancel', finishResize)
  window.addEventListener('blur', cancelResize)
})

onUnmounted(() => {
  finishResize()
  if (resizeRafId !== 0) cancelAnimationFrame(resizeRafId)
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', finishResize)
  document.removeEventListener('pointercancel', finishResize)
  window.removeEventListener('blur', cancelResize)
})
</script>

<template>
  <Layout>
    <template #layout-top>
      <!-- 阅读进度条 -->
      <ClientOnly>
        <ReadingProgress />
      </ClientOnly>
      <!-- 拖拽手柄 / 折叠按钮（仅文档页显示，首页无侧边栏） -->
      <template v-if="!isHome">
        <!-- 拖拽手柄 -->
        <div
          v-show="sidebarVisible"
          class="vp-sidebar-resize-handle"
          role="separator"
          tabindex="0"
          aria-label="调整侧边栏宽度"
          aria-orientation="vertical"
          :aria-valuemin="MIN_SIDEBAR_WIDTH"
          :aria-valuemax="MAX_SIDEBAR_WIDTH"
          :aria-valuenow="sidebarWidth"
          title="拖拽或使用左右方向键调整宽度；双击恢复默认"
          @pointerdown="startResize"
          @dblclick="resetWidth"
          @keydown="onResizeKeydown"
        ></div>
        <!-- 折叠/展开按钮 -->
        <button
          class="vp-sidebar-toggle"
          :class="{ collapsed: !sidebarVisible }"
          :title="sidebarVisible ? '隐藏目录' : '显示目录'"
          :aria-label="sidebarVisible ? '隐藏目录' : '显示目录'"
          :aria-expanded="sidebarVisible"
          @click="toggleSidebar"
        >
          <svg
            v-if="sidebarVisible"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </template>
    </template>
    <template #home-hero-image>
      <SeagullLens />
    </template>
    <template #home-hero-info>
      <h1 class="seagull-hero-heading">
        <span class="seagull-hero-wordmark" aria-label="SEAGULL"><span aria-hidden="true">S<span class="wordmark-e">E</span><span class="wordmark-a">A</span>GULL</span></span>
        <span class="seagull-hero-title">{{ frontmatter.hero.text }}</span>
      </h1>
      <p class="seagull-hero-tagline">{{ frontmatter.hero.tagline }}</p>
    </template>
    <template #home-features-after>
      <ClientOnly>
        <HilbertQuote />
      </ClientOnly>
    </template>
    <template #doc-before>
      <ChapterTag />
      <div v-if="frontmatter.status === 'draft'" class="draft-notice">
        本章仍在写作中，内容尚未完成。<a :href="withBase('/llm-book/')">查看已发布章节</a>
      </div>
    </template>
  </Layout>
</template>

<style>
.draft-notice {
  margin: 0 0 24px;
  padding: 12px 16px;
  border: 1px solid var(--vp-custom-block-warning-border);
  border-radius: 10px;
  background: var(--vp-custom-block-warning-bg);
  color: var(--vp-c-text-1);
  line-height: 1.6;
}

.draft-notice a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}

/* ===== 拖拽手柄 ===== */
.vp-sidebar-resize-handle {
  position: fixed;
  top: var(--vp-nav-height);
  bottom: 0;
  left: calc(var(--vp-sidebar-width) - 12px);
  width: 24px;
  cursor: col-resize;
  touch-action: none;
  z-index: 40;
}

.vp-sidebar-resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 10px;
  width: 4px;
  background-color: transparent;
  transition: background-color 0.15s;
}

.vp-sidebar-resize-handle:hover::after,
.vp-sidebar-resize-handle:focus-visible::after {
  background-color: var(--vp-c-brand-3);
}

.vp-sidebar-resize-handle:focus-visible,
.vp-sidebar-toggle:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

/* ===== 折叠/展开按钮 ===== */
.vp-sidebar-toggle {
  position: fixed;
  top: calc(var(--vp-nav-height) + 10px);
  left: calc(var(--vp-sidebar-width) - 16px);
  z-index: 41;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--glass-border, var(--vp-c-border));
  border-radius: 8px;
  background: var(--glass-bg, var(--vp-c-bg-alt));
  backdrop-filter: var(--glass-blur);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: left 0.25s ease, color 0.15s, border-color 0.15s, box-shadow 0.2s;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.1);
}

.vp-sidebar-toggle:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-3);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.2);
}

.vp-sidebar-toggle.collapsed {
  left: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .vp-sidebar-toggle,
  .VPSidebar,
  .VPContent {
    transition: none !important;
  }
}

/* ===== 侧边栏折叠状态 ===== */
.vp-sidebar-collapsed .VPSidebar {
  transform: translateX(-100%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.vp-sidebar-collapsed {
  --vp-sidebar-width: 0px;
}

/* 平滑过渡 */
.VPSidebar {
  transition: transform 0.25s ease, opacity 0.25s ease, visibility 0.25s;
}

@media (min-width: 960px) {
  .VPContent {
    transition: padding-left 0.25s ease;
  }
}

/* ===== 仅桌面端显示 ===== */
@media (max-width: 959px) {
  .vp-sidebar-resize-handle,
  .vp-sidebar-toggle {
    display: none !important;
  }

  /* 移动端恢复默认 */
  .vp-sidebar-collapsed {
    --vp-sidebar-width: 272px;
  }
}
</style>
