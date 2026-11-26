<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { withBase } from 'vitepress'
import { data as pages } from '../data/tagged-pages.data'
import { contextFor } from '../content-catalog'
import CollectionIndex from './CollectionIndex.vue'
import PaperDiscovery from './PaperDiscovery.vue'
import HomeResearchJournal from './HomeResearchJournal.vue'
import PixelCliffDiscovery from './PixelCliffDiscovery.vue'
import InterfaceIcon from './InterfaceIcon.vue'
import GraceHomeDiscovery from './GraceHomeDiscovery.vue'
import { useVisualStyle } from '../theme/visual-styles'
const active = ref('')
const style = useVisualStyle()
const results = ref<HTMLElement>()
const featured = shallowRef(pages.slice(0, 4))
onMounted(() => {
  const pool = [...pages]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  featured.value = pool.slice(0, 4)
})
const updates = computed(() => active.value ? pages.filter(p => active.value === 'notes' ? !['research','videos'].includes(p.section) : p.section === active.value).slice(0, 4) : featured.value)
// Only an explicit filter change should animate, never the first set of recommendations.
watch(active, () => {
  const grid = results.value
  if (!grid?.animate || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
  grid.getAnimations().forEach(animation => animation.cancel())
  if (style.value.iconSet === 'cinema') {
    grid.animate([{ opacity: 0.72 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' })
  } else {
    grid.animate([{ backgroundSize: '0 1px' }, { backgroundSize: '100px 1px', offset: .6 }, { backgroundSize: '0 1px' }], { duration: 320, easing: 'ease-out' })
  }
}, { flush: 'post' })
function search() { window.dispatchEvent(new Event('seagull-search')) }
function openGraph() { window.dispatchEvent(new Event('seagull-graph')) }
</script>
<template>
  <div class="home-dashboard" :data-index="style.iconSet">
    <div v-if="style.iconSet === 'paper' || style.iconSet === 'cinema'" class="home-discover">
      <button class="home-search" aria-haspopup="dialog" @click="search"><InterfaceIcon name="search" /> 搜索笔记、论文、主题…<span class="search-key">Ctrl K</span></button>
      <button type="button" class="home-graph-trigger" aria-haspopup="dialog" @click="openGraph"><InterfaceIcon name="graph" /><span>知识星图</span></button>
      <a :href="withBase('/tags')">全部内容 <span aria-hidden="true">→</span></a>
    </div>
    <div v-else class="home-atlas-bar">
      <button type="button" class="home-graph-trigger is-banner" aria-haspopup="dialog" @click="openGraph">
        <InterfaceIcon name="graph" />
        <span class="atlas-copy"><strong>全屏知识星图</strong><small>漫游 {{ pages.length }} 篇笔记、论文与主题星轨</small></span>
        <span class="atlas-cta" aria-hidden="true">进入星图 ↗</span>
      </button>
    </div>
    <template v-if="style.iconSet === 'paper' || style.iconSet === 'pixel'">
      <PaperDiscovery v-if="style.iconSet === 'paper'" :pages="pages" />
      <PixelCliffDiscovery v-else :pages="pages" />
      <HomeResearchJournal :edition="style.iconSet" />
    </template>
    <GraceHomeDiscovery v-else-if="style.iconSet === 'grace'" :pages="pages" />
    <template v-else>
      <section class="home-sections" aria-labelledby="home-sections-title">
        <header class="home-heading"><h2 id="home-sections-title">{{ style.collectionTitle }}</h2></header>
        <CollectionIndex />
      </section>
      <section class="home-updates" aria-labelledby="home-updates-title">
        <header class="home-heading"><h2 id="home-updates-title">{{ active ? '最近更新' : '内容推荐' }}</h2><a :href="withBase('/tags')">{{ active ? '全部更新 →' : '全部内容 →' }}</a></header>
        <div class="update-filters" aria-label="内容类型"><button v-for="filter in [{id:'',title:'全部'},{id:'notes',title:'笔记与论文'},{id:'research',title:'调研'},{id:'videos',title:'视频'}]" :key="filter.id" :aria-pressed="active === filter.id" @click="active = filter.id">{{ filter.title }}</button></div>
        <div ref="results" class="update-grid"><a v-for="(page,i) in updates" :key="page.url" :href="withBase(page.url)"><span class="update-no" aria-hidden="true">{{ String(i + 1).padStart(2,'0') }}</span><div class="update-meta"><span>{{ contextFor(page) }}</span><time v-if="page.section === 'research'" :datetime="page.updated">{{ page.updated }}</time></div><h3>{{ page.title }}</h3><p>{{ page.description }}</p></a></div>
      </section>
    </template>
  </div>
</template>
<style scoped>
.home-dashboard { max-width:1120px; margin:auto; }
.home-dashboard a { text-decoration:none; font-weight:400; }
.home-dashboard h2,.home-dashboard h3 { margin:0; padding:0; border:0; }
.home-dashboard p { margin-bottom:0; }
.home-discover { display:flex; align-items:center; gap:14px; margin:0 0 34px; }
.home-search { flex:1; display:flex; align-items:center; text-align:left; gap:10px; padding:14px 18px; border:1px solid var(--vp-c-divider); border-radius:8px; background:var(--vp-c-bg-alt); color:var(--vp-c-text-2); font-size:15px; min-height:54px; }
.home-search > span:first-child { font-size:25px; color:var(--vp-c-brand-1); }
.search-key { margin-left:auto; font-size:11px; opacity:.7; }
.home-graph-trigger {
  position:relative; display:inline-flex; align-items:center; gap:8px; min-height:54px; padding:0 16px;
  border:1px solid color-mix(in srgb, var(--vp-c-brand-1) 42%, var(--vp-c-divider)); border-radius:8px;
  background:linear-gradient(135deg, color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg-alt)), var(--vp-c-bg-alt));
  color:var(--vp-c-brand-1); font-size:14px; font-weight:600; white-space:nowrap; flex:none;
  transition:border-color .18s, background-color .18s, box-shadow .18s, transform .18s;
}
.home-graph-trigger:hover {
  border-color:var(--vp-c-brand-1);
  box-shadow:0 6px 20px color-mix(in srgb, var(--vp-c-brand-1) 20%, transparent);
  transform:translateY(-1px);
}
.home-graph-trigger:focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:2px; }
.home-atlas-bar { display:flex; justify-content:flex-end; margin:0 0 20px; }
.home-graph-trigger.is-banner {
  width:100%; justify-content:flex-start; gap:12px; min-height:52px; padding:10px 16px;
  backdrop-filter:blur(10px);
}
.atlas-copy { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 10px; text-align:left; }
.atlas-copy strong { font-size:14px; color:var(--vp-c-text-1); }
.atlas-copy small { font-size:12px; font-weight:400; color:var(--vp-c-text-2); }
.atlas-cta { margin-inline-start:auto; font-size:12px; color:var(--vp-c-brand-1); }
.home-discover > a,.home-heading > a { font-size:13px; color:var(--vp-c-brand-1); flex:none; white-space:nowrap; }
.home-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.home-heading h2 { font-size:22px; font-weight:600; line-height:1.5; }
.home-updates { margin-top:42px; }
.update-filters { display:flex; gap:20px; border-bottom:1px solid var(--vp-c-divider); }
.update-filters button { padding:0 0 12px; font-size:13px; color:var(--vp-c-text-2); border-bottom:2px solid transparent; }
.update-filters button[aria-pressed='true'] { color:var(--vp-c-brand-1); border-color:currentColor; }
.update-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 36px; }
.update-no { display:none; }
.update-grid > a { padding:22px 0; border-bottom:1px solid var(--vp-c-divider); }
.update-meta { display:flex; flex-wrap:wrap; gap:4px 12px; color:var(--vp-c-text-2); font-size:11px; }
.update-grid h3 { font-size:18px; line-height:1.65; margin:8px 0; font-weight:600; }
.update-grid p { font-size:13px; line-height:1.8; color:var(--vp-c-text-2); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.home-dashboard a:hover h3 { color:var(--vp-c-brand-1); }
.home-dashboard[data-index='cinema'] .update-grid { display:block; }
.home-dashboard[data-index='cinema'] .update-grid > a { display:grid; grid-template-columns:32px minmax(0,.65fr) minmax(0,1.5fr) minmax(0,1.5fr); align-items:baseline; gap:12px; padding:16px 0; }
.home-dashboard[data-index='cinema'] .update-no { display:inline; font:italic 17px/1 Georgia,serif; color:var(--vp-c-text-2); }
.home-dashboard[data-index='cinema'] .update-grid h3 { margin:0; font:500 18px/1.65 'Seagull Academic Serif',SimSun,serif; }
.home-dashboard[data-index='cinema'] .update-grid p { margin:0; }
@media(max-width:767px) {
  .home-discover { gap:14px; margin-bottom:24px; } .home-discover > a { line-height:1.7; } .search-key { display:none; } .home-search { font-size:13px; padding:10px 12px; } .home-heading h2 { font-size:20px; } .update-grid { grid-template-columns:1fr; } .home-updates { margin-top:32px; }
  .home-dashboard[data-index='cinema'] .update-grid > a { grid-template-columns:24px minmax(0,1fr); row-gap:3px; }
  .home-dashboard[data-index='cinema'] .update-no { grid-row:1/4; }
}
@media(max-width:380px) {
  .home-discover { flex-wrap:wrap; justify-content:flex-end; }
  .home-search { flex-basis:100%; }
}
</style>
