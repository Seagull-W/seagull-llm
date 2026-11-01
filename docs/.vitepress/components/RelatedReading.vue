<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { data as pages } from '../data/tagged-pages.data'
import { normalizeContentPath } from '../public-content'
import { readingSeries, sectionFor } from '../content-catalog'
const { page } = useData()
const path = computed(() => normalizeContentPath('/' + page.value.relativePath))
const current = computed(() => pages.find(p => normalizeContentPath(p.url) === path.value))
const section = computed(() => sectionFor(path.value))
const series = computed(() => readingSeries.find(s => s.paths.includes(path.value)))
const sequence = computed(() => {
  const s = series.value
  if (!s) return []
  const i = s.paths.indexOf(path.value)
  return [{ path: s.paths[i - 1], label: '上一篇' }, { path: s.paths[i + 1], label: '下一篇' }].flatMap(item => {
    const entry = pages.find(p => normalizeContentPath(p.url) === item.path)
    return entry ? [{ ...entry, label: item.label }] : []
  })
})
const related = computed(() => {
  if (!current.value) return []
  return pages.filter(p => p.url !== current.value!.url && !sequence.value.some(s => s.url === p.url)).map(p => {
    const common = p.tags.filter(tag => current.value!.tags.includes(tag))
    return { ...p, common, score: common.reduce((n, tag) => n + 1 / pages.filter(p => p.tags.includes(tag)).length, 0) }
  }).filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
})
</script>
<template>
  <nav v-if="current" class="related-reading" aria-label="继续阅读">
    <div v-if="sequence.length" class="reading-sequence"><p>{{ series?.title }}</p><div><a v-for="item in sequence" :key="item.url" :href="withBase(item.url)"><small>{{ item.label }}</small><span>{{ item.title }} →</span></a></div></div>
    <template v-if="related.length"><h2>相关阅读</h2><a v-for="item in related" :key="item.url" class="related-link" :href="withBase(item.url)"><span>{{ item.title }}</span><small>{{ item.common.slice(0, 2).join(' · ') }}</small></a></template>
    <a v-if="section" class="back-to-section" :href="withBase('/' + section.id + '/')">← 返回 {{ section.title }}</a>
  </nav>
</template>
<style scoped>
.related-reading { max-width:720px; margin:48px auto 0; border-top:1px solid var(--vp-c-divider); padding-top:24px; font-family:var(--vp-font-family-base); }
h2 { font-size:17px; font-weight:600; margin-bottom:8px; }
.related-link { display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid var(--vp-c-divider); font-size:14px; line-height:1.7; }
small { color:var(--vp-c-text-2); font-size:11px; }
.related-link small { text-align:right; flex:0 0 100px; }
a:hover { color:var(--vp-c-brand-1); }
.reading-sequence { margin-bottom:28px; }
.reading-sequence p { color:var(--vp-c-text-2); font-size:12px; margin-bottom:10px; }
.reading-sequence > div { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.reading-sequence a { display:flex; flex-direction:column; padding:14px; gap:6px; border:1px solid var(--vp-c-divider); border-radius:6px; font-size:14px; line-height:1.7; }
.back-to-section { display:inline-block; color:var(--vp-c-brand-1); font-size:13px; margin-top:24px; padding:8px 0; }
@media(max-width:480px) { .related-link { flex-direction:column; gap:3px; } .related-link small { flex:auto; text-align:left; } }
</style>
