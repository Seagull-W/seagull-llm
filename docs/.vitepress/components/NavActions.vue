<script setup lang="ts">
import { useData } from 'vitepress'
const { isDark } = useData()
</script>

<template>
  <div class="seagull-nav-actions">
    <button type="button" :aria-pressed="isDark" :title="isDark ? '切换到浅色模式' : '切换到深色模式'" aria-label="深色主题" @click="isDark = !isDark">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path v-if="isDark" d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />
        <template v-else><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></template>
      </svg><span class="action-label">主题</span>
    </button>
    <a href="https://github.com/Seagull-W/seagull-llm" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库（新窗口）">GitHub</a>
  </div>
</template>

<style scoped>
.seagull-nav-actions { display: flex; align-items: center; flex: none; gap: 8px; padding-left: 10px; }
button, a { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 36px; padding: 0 8px; border: 1px solid var(--vp-c-divider); border-radius: 8px; color: var(--vp-c-text-1); font-size: 13px; white-space: nowrap; }
button:hover, a:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
button:focus-visible, a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
@media (max-width: 639px) { .action-label { display: none; } .seagull-nav-actions { gap: 4px; padding-left: 4px; } }
</style>
