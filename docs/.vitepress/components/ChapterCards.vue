<script setup lang="ts">
import { withBase } from 'vitepress'
import { useVisualStyle } from '../theme/visual-styles'
defineProps<{ items: { title: string; link: string; description: string; label?: string; date?: string }[] }>()
const visual = useVisualStyle()
</script>
<template>
  <nav class="chapter-cards" aria-label="文章列表" :data-index="visual.iconSet">
    <a v-for="(item,i) in items" :key="item.link" class="chapter-card" :href="withBase(item.link)">
      <span class="chapter-no" aria-hidden="true">{{ String(i + 1).padStart(2,'0') }}</span>
      <span v-if="item.label || item.date" class="chapter-card-meta"><span v-if="item.label">{{ item.label }}</span><time v-if="item.date" :datetime="item.date">{{ item.date }}</time></span>
      <span class="chapter-card-title">{{ item.title }}<span class="chapter-card-arrow" aria-hidden="true">→</span></span>
      <span class="chapter-card-description">{{ item.description }}</span>
    </a>
  </nav>
</template>
<style scoped>
.chapter-cards { display:grid; grid-template-columns:minmax(0,1fr); margin:0 0 24px; }
.vp-doc .chapter-card { display:flex; flex-direction:column; padding:20px 0; border-bottom:1px solid var(--vp-c-divider); background:transparent; text-decoration:none; color:var(--vp-c-text-1); }
.chapter-card-meta { display:flex; flex-wrap:wrap; gap:4px 16px; font-size:12px; color:var(--vp-c-text-2); margin-bottom:6px; }
.chapter-card-title { display:flex; justify-content:space-between; gap:16px; font-size:19px; line-height:1.6; font-weight:600; }
.chapter-card-arrow { flex:none; color:var(--vp-c-brand-1); font-size:17px; font-weight:400; }
.chapter-card-description { margin-top:6px; color:var(--vp-c-text-2); font-size:14px; line-height:1.85; max-width:60em; }
.chapter-card:hover .chapter-card-title { color:var(--vp-c-brand-1); }
@media(max-width:640px) { .chapter-card-title { font-size:17px; } .chapter-card-meta { font-size:11px; } .vp-doc .chapter-card { padding:18px 0; } }

.chapter-no { font-variant-numeric:tabular-nums; color:var(--vp-c-text-2); }
.vp-doc .chapter-cards[data-index='paper'] { grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:clamp(18px,3vw,38px); }
.chapter-cards[data-index='paper'] .chapter-card { position:relative; padding:19px 8px 17px 30px; }
.chapter-cards[data-index='paper'] .chapter-no { position:absolute; left:0; top:22px; font:italic 14px Georgia,serif; }
.chapter-cards[data-index='paper'] .chapter-card-title { font-family:'Seagull Academic Serif',SimSun,serif; }
.chapter-cards[data-index='paper'] .chapter-card:is(:focus-visible,:hover)::after { content:''; position:absolute; right:0; top:0; width:11px; height:11px; background:linear-gradient(45deg,var(--vp-c-bg-soft) 49%,var(--vp-c-divider) 50%,transparent 57%); }
.vp-doc .chapter-cards[data-index='pixel'] { border-top:0; }
.vp-doc .chapter-cards[data-index='pixel'] .chapter-card { position:relative; display:grid; grid-template-columns:34px minmax(0,1fr); column-gap:16px; padding:15px 10px 15px 0; border-left:0; }
.chapter-cards[data-index='pixel'] .chapter-card:not(:last-child)::after { content:''; position:absolute; top:50%; bottom:-50%; left:16px; width:2px; background:repeating-linear-gradient(var(--pixel-edge) 0 4px,transparent 4px 9px); pointer-events:none; }
.chapter-cards[data-index='pixel'] .chapter-no { display:grid; place-items:center; position:relative; z-index:1; grid-row:1/4; align-self:center; background:var(--pixel-panel); color:var(--vp-c-brand-1); font:14px/34px var(--vp-font-family-mono); border-block:2px solid var(--pixel-edge); }
.chapter-cards[data-index='cinema'] .chapter-card { display:grid; grid-template-columns:2.4em minmax(0,.9fr) minmax(0,1.15fr); column-gap:16px; align-items:start; }
.chapter-cards[data-index='cinema'] .chapter-no { grid-column:1; grid-row:1/3; font:italic 21px/1.35 Georgia,serif; }
.chapter-cards[data-index='cinema'] .chapter-card-meta { grid-column:2; margin-bottom:3px; }
.chapter-cards[data-index='cinema'] .chapter-card-title { grid-column:2; font:500 18px/1.65 'Seagull Academic Serif',SimSun,serif; }
.chapter-cards[data-index='cinema'] .chapter-card-description { grid-column:3; grid-row:1/3; margin:0; }
.chapter-cards[data-index='cinema'] .chapter-card-arrow { display:none; }
.vp-doc .chapter-cards[data-index='grace'] .chapter-card { display:grid; grid-template-columns:42px minmax(0,1fr); column-gap:16px; padding-block:17px; }
.chapter-cards[data-index='grace'] .chapter-no { display:grid; place-items:center; align-self:center; grid-row:1/4; height:43px; border:1px solid var(--grace-etch); color:var(--vp-c-brand-1); background:var(--grace-sheen); font:16px/1 Georgia,serif; }
@media(max-width:640px) {
  .vp-doc .chapter-cards[data-index='paper'] { grid-template-columns:1fr; }
  .chapter-cards[data-index='cinema'] .chapter-card { grid-template-columns:24px minmax(0,1fr); gap:2px 10px; }
  .chapter-cards[data-index='cinema'] .chapter-card-description { grid-column:2; grid-row:auto; }
  .chapter-cards[data-index='cinema'] .chapter-no { grid-row:1/4; font-size:17px; }
  .vp-doc .chapter-cards[data-index='grace'] .chapter-card { grid-template-columns:30px minmax(0,1fr); gap:0 10px; }
  .chapter-cards[data-index='grace'] .chapter-no { height:35px; font-size:13px; }
}
</style>
