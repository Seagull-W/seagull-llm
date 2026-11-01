<script setup lang="ts">
import { withBase } from 'vitepress'
defineProps<{ items: { title: string; link: string; description: string; label?: string; date?: string }[] }>()
</script>
<template>
  <nav class="chapter-cards" aria-label="文章列表">
    <a v-for="item in items" :key="item.link" class="chapter-card" :href="withBase(item.link)">
      <span v-if="item.label || item.date" class="chapter-card-meta"><span v-if="item.label">{{ item.label }}</span><time v-if="item.date" :datetime="item.date">更新于 {{ item.date }}</time></span>
      <span class="chapter-card-title">{{ item.title }}<span class="chapter-card-arrow" aria-hidden="true">→</span></span>
      <span class="chapter-card-description">{{ item.description }}</span>
    </a>
  </nav>
</template>
<style scoped>
.chapter-cards { display:grid; grid-template-columns:minmax(0,1fr); margin:0 0 24px; }
.vp-doc .chapter-card { display:flex; flex-direction:column; padding:20px 0; border-bottom:1px solid var(--vp-c-divider); background:transparent; text-decoration:none; color:var(--vp-c-text-1); }
.chapter-card-meta { display:flex; flex-wrap:wrap; gap:4px 16px; font-size:12px; color:var(--vp-c-text-2); margin-bottom:6px; }
.chapter-card-meta time { margin-left:auto; font-variant-numeric:tabular-nums; }
.chapter-card-title { display:flex; justify-content:space-between; gap:16px; font-size:19px; line-height:1.6; font-weight:600; }
.chapter-card-arrow { flex:none; color:var(--vp-c-brand-1); font-size:17px; font-weight:400; }
.chapter-card-description { margin-top:6px; color:var(--vp-c-text-2); font-size:14px; line-height:1.85; max-width:60em; }
.chapter-card:hover .chapter-card-title { color:var(--vp-c-brand-1); }
@media(max-width:640px) { .chapter-card-title { font-size:17px; } .chapter-card-meta { font-size:11px; } .chapter-card-meta time { margin-left:0; } .vp-doc .chapter-card { padding:18px 0; } }
</style>
