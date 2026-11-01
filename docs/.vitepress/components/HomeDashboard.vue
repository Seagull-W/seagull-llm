<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { data as pages } from '../data/tagged-pages.data'
import { sections, contextFor } from '../content-catalog'
const active = ref('')
const updates = computed(() => pages.filter(p => !active.value || (active.value === 'notes' ? !['research','videos'].includes(p.section) : p.section === active.value)).slice(0, 4))
function search() { window.dispatchEvent(new Event('seagull-search')) }
</script>
<template>
  <div class="home-dashboard">
    <div class="home-discover"><button class="home-search" aria-haspopup="dialog" @click="search"><span aria-hidden="true">⌕</span> 搜索笔记、论文、主题…<span class="search-key">Ctrl K</span></button><a :href="withBase('/tags')">全部内容 <span aria-hidden="true">→</span></a></div>
    <section class="home-sections" aria-labelledby="home-sections-title">
      <header class="home-heading"><h2 id="home-sections-title">从这里开始</h2></header>
      <nav class="section-grid" aria-label="内容栏目"><a v-for="s in sections.filter(s => s.id !== 'videos')" :key="s.id" :href="withBase('/' + s.id + '/')"><h3>{{ s.title }} <span aria-hidden="true">→</span></h3><p>{{ s.description }}</p></a></nav>
    </section>
    <section class="home-updates" aria-labelledby="home-updates-title">
      <header class="home-heading"><h2 id="home-updates-title">最近更新</h2><a :href="withBase('/tags')">全部更新 →</a></header>
      <div class="update-filters" aria-label="更新类型"><button v-for="filter in [{id:'',title:'全部'},{id:'notes',title:'笔记与论文'},{id:'research',title:'调研'},{id:'videos',title:'视频'}]" :key="filter.id" :aria-pressed="active === filter.id" @click="active = filter.id">{{ filter.title }}</button></div>
      <div class="update-grid"><a v-for="page in updates" :key="page.url" :href="withBase(page.url)"><div class="update-meta"><span>{{ contextFor(page) }}</span><time :datetime="page.updated">{{ page.updated }}</time></div><h3>{{ page.title }}</h3><p>{{ page.description }}</p></a></div>
    </section>
  </div>
</template>
<style scoped>
.home-dashboard { max-width:1120px; margin:auto; }
.home-dashboard a { text-decoration:none; font-weight:400; }
.home-dashboard h2,.home-dashboard h3 { margin:0; padding:0; border:0; }
.home-dashboard p { margin-bottom:0; }
.home-discover { display:flex; align-items:center; gap:24px; margin:0 0 34px; }
.home-search { flex:1; display:flex; align-items:center; text-align:left; gap:10px; padding:14px 18px; border:1px solid var(--vp-c-divider); border-radius:8px; background:var(--vp-c-bg-alt); color:var(--vp-c-text-2); font-size:15px; min-height:54px; }
.home-search > span:first-child { font-size:25px; color:var(--vp-c-brand-1); }
.search-key { margin-left:auto; font-size:11px; opacity:.7; }
.home-discover > a,.home-heading > a { font-size:13px; color:var(--vp-c-brand-1); flex:none; white-space:nowrap; }
.home-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.home-heading h2 { font-size:22px; font-weight:600; line-height:1.5; }
.section-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0 28px; border-top:1px solid var(--vp-c-divider); }
.section-grid > a { display:block; padding:18px 0; border-bottom:1px solid var(--vp-c-divider); }
.section-grid h3 { display:flex; justify-content:space-between; gap:12px; font-size:16px; font-weight:600; }
.section-grid h3 span { color:var(--vp-c-brand-1); font-weight:400; }
.section-grid p { font-size:12px; color:var(--vp-c-text-2); margin-top:6px; line-height:1.7; }
.home-updates { margin-top:42px; }
.update-filters { display:flex; gap:20px; border-bottom:1px solid var(--vp-c-divider); }
.update-filters button { padding:0 0 12px; font-size:13px; color:var(--vp-c-text-2); border-bottom:2px solid transparent; }
.update-filters button[aria-pressed='true'] { color:var(--vp-c-brand-1); border-color:currentColor; }
.update-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 36px; }
.update-grid > a { padding:22px 0; border-bottom:1px solid var(--vp-c-divider); }
.update-meta { display:flex; flex-wrap:wrap; gap:4px 12px; color:var(--vp-c-text-2); font-size:11px; }
.update-grid h3 { font-size:18px; line-height:1.65; margin:8px 0; font-weight:600; }
.update-grid p { font-size:13px; line-height:1.8; color:var(--vp-c-text-2); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.home-dashboard a:hover h3 { color:var(--vp-c-brand-1); }
@media(max-width:767px) { .section-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 20px; } .home-discover { gap:14px; margin-bottom:24px; } .home-discover > a { line-height:1.7; } .search-key { display:none; } .home-search { font-size:13px; padding:10px 12px; } .home-heading h2 { font-size:20px; } .section-grid p { font-size:11px; } .section-grid h3 { font-size:15px; } .update-grid { grid-template-columns:1fr; } .home-updates { margin-top:32px; } }
</style>
