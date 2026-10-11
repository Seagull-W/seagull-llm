<script setup lang="ts">
import { withBase } from 'vitepress'
defineProps<{ items: { title: string; link: string; description: string; label?: string }[] }>()
</script>

<template>
  <nav class="chapter-cards" aria-label="章节入口">
    <a v-for="item in items" :key="item.link" class="chapter-card" :href="withBase(item.link)">
      <span v-if="item.label" class="chapter-card-label">{{ item.label }}</span>
      <span class="chapter-card-title">{{ item.title }}</span>
      <span class="chapter-card-description">{{ item.description }}</span>
      <span class="chapter-card-action">开始阅读 <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
    </a>
  </nav>
</template>

<style scoped>
.chapter-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 24px 0 32px; }
.vp-doc .chapter-card { display: flex; flex-direction: column; align-items: flex-start; padding: 24px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-alt); background-image: none; text-decoration: none; color: var(--vp-c-text-1); transition: border-color 160ms ease, background-color 160ms ease; }
.vp-doc .chapter-card:hover { border-color: var(--vp-c-brand-1); background-color: var(--vp-c-bg-soft); }
.chapter-card:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 4px; }
.chapter-card-label { margin-bottom: 12px; font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--vp-c-text-2); }
.chapter-card-title { font-size: 19px; font-weight: 650; line-height: 1.5; text-wrap: pretty; }
.chapter-card-description { margin: 10px 0 24px; font-size: 14px; line-height: 1.8; color: var(--vp-c-text-2); }
.chapter-card-action { display: flex; align-items: center; gap: 8px; margin-top: auto; color: var(--vp-c-brand-1); font-size: 13px; font-weight: 600; }
@media (max-width: 640px) {
  .chapter-cards { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .vp-doc .chapter-card { padding: 20px; }
}
@media (prefers-reduced-motion: reduce) { .vp-doc .chapter-card { transition: none; } }
</style>
