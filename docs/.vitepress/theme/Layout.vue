<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { ClientOnly } from 'vitepress'
import { onMounted, onUnmounted, ref } from 'vue'
import SeagullLens from '../components/SeagullLens.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import ChapterTag from '../components/ChapterTag.vue'

const { Layout } = DefaultTheme

// ===== 侧边栏状态 =====
const sidebarWidth = ref(272)
const sidebarVisible = ref(true)
let isResizing = false

function loadState() {
  try {
    const w = localStorage.getItem('vp-sidebar-width')
    const v = localStorage.getItem('vp-sidebar-visible')
    if (w) {
      const parsed = parseInt(w, 10)
      if (!isNaN(parsed)) sidebarWidth.value = Math.max(200, Math.min(500, parsed))
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

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  if (!isResizing) return
  const newWidth = Math.max(200, Math.min(500, e.clientX))
  if (newWidth !== sidebarWidth.value) {
    sidebarWidth.value = newWidth
    applyWidth()
  }
}

function onMouseUp() {
  if (isResizing) {
    isResizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    try {
      localStorage.setItem('vp-sidebar-width', String(sidebarWidth.value))
    } catch {
      /* ignore */
    }
  }
}

// 双击 resize handle 恢复默认宽度
function resetWidth() {
  sidebarWidth.value = 272
  applyWidth()
  try {
    localStorage.setItem('vp-sidebar-width', '272')
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  loadState()
  applyWidth()
  applyVisibility()
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <Layout>
    <template #layout-top>
      <!-- 阅读进度条 -->
      <ClientOnly>
        <ReadingProgress />
      </ClientOnly>
      <!-- 拖拽手柄 -->
      <div
        v-show="sidebarVisible"
        class="vp-sidebar-resize-handle"
        title="拖拽调整宽度，双击恢复默认"
        @mousedown="startResize"
        @dblclick="resetWidth"
      ></div>
      <!-- 折叠/展开按钮 -->
      <button
        class="vp-sidebar-toggle"
        :class="{ collapsed: !sidebarVisible }"
        :title="sidebarVisible ? '隐藏目录' : '显示目录'"
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
    <template #home-hero-image>
      <ClientOnly>
        <SeagullLens />
      </ClientOnly>
    </template>
    <template #doc-before>
      <ChapterTag />
    </template>
  </Layout>
</template>

<style>
/* ===== 拖拽手柄 ===== */
.vp-sidebar-resize-handle {
  position: fixed;
  top: var(--vp-nav-height);
  bottom: 0;
  left: var(--vp-sidebar-width);
  width: 7px;
  margin-left: -3.5px;
  cursor: col-resize;
  z-index: 40;
  transition: background-color 0.15s;
}

.vp-sidebar-resize-handle:hover {
  background-color: var(--vp-c-brand-3);
}

/* 拖拽中隐藏 transition，让宽度实时跟随鼠标 */
body:has(.vp-sidebar-resize-handle:active) {
  cursor: col-resize;
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
  width: 22px;
  height: 22px;
  border: 1px solid var(--glass-border, var(--vp-c-border));
  border-radius: 8px;
  background: var(--glass-bg, var(--vp-c-bg-alt));
  backdrop-filter: blur(14px) saturate(150%);
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
