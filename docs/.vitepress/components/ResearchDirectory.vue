<script setup lang="ts">
import { shallowRef } from 'vue'
import { withBase } from 'vitepress'
import { featuredResearchCards, researchCards } from '../research-sidebar'
import ChapterCards from './ChapterCards.vue'

const featuredOnly = shallowRef(false)
</script>

<template>
  <section v-if="featuredResearchCards.length" class="research-section" aria-labelledby="精选调研">
    <h2 id="精选调研">精选调研</h2>
    <div class="featured-grid">
      <a v-for="card in featuredResearchCards" :key="card.link" class="featured-card" :href="withBase(card.link)">
        <span class="featured-meta">
          <span class="featured-label">精选</span>
          <time :datetime="card.date">{{ card.date }}</time>
        </span>
        <span class="featured-title">{{ card.title }}<span class="featured-arrow" aria-hidden="true">→</span></span>
        <span class="featured-note">{{ card.featuredNote || card.description }}</span>
      </a>
    </div>
  </section>

  <section class="research-section" aria-labelledby="调研记录">
    <div class="research-heading">
      <h2 id="调研记录">全部调研</h2>
      <div v-if="featuredResearchCards.length" class="research-filter" role="group" aria-label="筛选调研文章">
        <button type="button" :aria-pressed="!featuredOnly" aria-controls="research-list" @click="featuredOnly = false">全部 ({{ researchCards.length }})</button>
        <button type="button" :aria-pressed="featuredOnly" aria-controls="research-list" @click="featuredOnly = true">仅看精选 ({{ featuredResearchCards.length }})</button>
      </div>
    </div>
    <ChapterCards id="research-list" :items="featuredOnly ? featuredResearchCards : researchCards" />
  </section>
</template>

<style scoped>
.research-section + .research-section { margin-top:36px; }
.research-section h2 { margin:0 0 14px; padding:0; border:0; font-size:20px; }
.featured-grid { display:grid; gap:16px; grid-template-columns:minmax(0,1fr); }
@media (min-width:768px) {
  .featured-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .featured-card:only-child { grid-column:1/-1; }
}
.vp-doc .featured-card {
  display:flex; flex-direction:column; gap:10px; padding:clamp(16px,3vw,26px);
  background:var(--vp-c-bg-soft); border:1px solid var(--vp-c-divider);
  border-inline-start:3px solid var(--vp-c-brand-1); text-decoration:none;
  color:var(--vp-c-text-1); overflow-wrap:anywhere;
}
.featured-meta { display:flex; flex-wrap:wrap; align-items:center; gap:10px; font-size:12px; font-variant-numeric:tabular-nums; color:var(--vp-c-text-2); }
.featured-label { border:1px solid currentColor; border-radius:999px; padding:1px 8px; font-size:11px; line-height:1.5; }
.featured-title { display:flex; justify-content:space-between; gap:14px; font:600 clamp(18px,2vw,22px)/1.55 'Seagull Academic Serif',SimSun,serif; }
.featured-arrow { flex:none; color:var(--vp-c-brand-1); font:400 18px/1.6 var(--vp-font-family-base); }
.featured-note { max-width:60em; font-size:14px; font-weight:400; line-height:1.8; color:var(--vp-c-text-2); }
.featured-card:is(:hover,:focus-visible) .featured-title { color:var(--vp-c-brand-1); }
.research-heading { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 16px; margin-bottom:8px; }
.research-heading h2 { margin:0; }
.research-filter { display:inline-flex; padding:2px; border:1px solid var(--vp-c-divider); border-radius:5px; }
.research-filter button { border-radius:3px; padding:3px 9px; font-size:12px; color:var(--vp-c-text-2); }
.research-filter button[aria-pressed='true'] { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); font-weight:600; }
.featured-card:focus-visible, .research-filter button:focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:2px; }
</style>
