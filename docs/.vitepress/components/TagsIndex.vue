<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { data as pages } from '../data/tagged-pages.data'
import { contextFor, fold, metadataScore, newestFirst, normalizeTag, queryTerms, sections } from '../content-catalog'
import ChapterCards from './ChapterCards.vue'
const selected = ref(''), query = ref(''), section = ref(''), kind = ref(''), sort = ref('recent'), topicQuery = ref('')
const picker = ref<HTMLDetailsElement>()
const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const page of pages) for (const tag of page.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
})
const kinds = [...new Set(pages.map(p => p.kind))]
const common = computed(() => tags.value.slice(0, 5))
const moreTags = computed(() => tags.value.filter(([tag]) => fold(tag).includes(fold(topicQuery.value))))
const filtered = computed(() => {
  const terms = queryTerms(query.value)
  return pages.filter(page => (!section.value || page.section === section.value) && (!kind.value || page.kind === kind.value) && (!selected.value || page.tags.includes(selected.value)) && terms.every(term => fold([page.title, page.description, ...page.tags].join(' ')).includes(term)))
    .sort((a, b) => sort.value === 'relevance' && terms.length ? metadataScore(b, terms) - metadataScore(a, terms) || newestFirst(a, b) : newestFirst(a, b))
})
const cards = computed(() => filtered.value.map(page => ({ title: page.title, link: page.url, description: page.description, label: contextFor(page), date: page.section === 'research' ? page.updated : undefined })))
function readUrl() {
  const url = new URL(location.href)
  query.value = url.searchParams.get('q') || ''
  section.value = url.searchParams.get('section') || ''
  kind.value = url.searchParams.get('type') || ''
  sort.value = url.searchParams.get('sort') || (query.value ? 'relevance' : 'recent')
  selected.value = normalizeTag(decodeURIComponent(url.hash.slice(1)))
}
function writeUrl(replace = false) {
  const url = new URL(location.href)
  for (const [key, value] of [['q', query.value], ['section', section.value], ['type', kind.value], ['sort', sort.value === 'recent' ? '' : sort.value]]) value ? url.searchParams.set(key, value) : url.searchParams.delete(key)
  url.hash = selected.value ? encodeURIComponent(selected.value) : ''
  history[replace ? 'replaceState' : 'pushState'](history.state, '', url)
}
function selectTag(tag: string) { selected.value = tag; if (picker.value) picker.value.open = false; topicQuery.value = ''; writeUrl() }
function reset() { query.value = ''; section.value = ''; kind.value = ''; selected.value = ''; sort.value = 'recent'; writeUrl() }
function search() { sort.value = query.value ? 'relevance' : 'recent'; writeUrl(true) }
onMounted(() => { readUrl(); window.addEventListener('popstate', readUrl); window.addEventListener('hashchange', readUrl) })
onUnmounted(() => { window.removeEventListener('popstate', readUrl); window.removeEventListener('hashchange', readUrl) })
</script>
<template>
  <section class="tag-index" aria-label="浏览全部内容">
    <label class="tag-search"><span class="sr-only">查找标题或主题</span><input v-model="query" type="search" placeholder="查找标题、摘要或主题…" @input="search" /></label>
    <div class="catalog-filters">
      <label><span class="sr-only">栏目</span><select v-model="section" aria-label="栏目" @change="writeUrl()"><option value="">全部栏目</option><option v-for="s in sections" :key="s.id" :value="s.id">{{ s.title }}</option></select></label>
      <label><span class="sr-only">内容类型</span><select v-model="kind" aria-label="内容类型" @change="writeUrl()"><option value="">全部类型</option><option v-for="k in kinds" :key="k" :value="k">{{ k }}</option></select></label>
    </div>
    <div class="tag-filters" aria-label="主题筛选">
      <button :aria-pressed="!selected" @click="selectTag('')">全部主题</button>
      <button v-for="[tag] in common" :key="tag" :aria-pressed="selected === tag" @click="selectTag(tag)">{{ tag }}</button>
      <button v-if="selected && !common.some(([t]) => t === selected)" aria-pressed="true" @click="selectTag('')">{{ selected }} ×</button>
      <details ref="picker" class="topic-picker"><summary>更多主题</summary><div class="topic-panel"><input v-model="topicQuery" type="search" aria-label="查找主题" placeholder="输入主题名称…"><div class="topic-options"><button v-for="[tag, count] in moreTags" :key="tag" :aria-pressed="selected === tag" @click="selectTag(tag)">{{ tag }} <span>{{ count }}</span></button><p v-if="!moreTags.length">没有匹配的主题</p></div></div></details>
    </div>
    <div class="catalog-summary"><p role="status">{{ filtered.length }} 项内容<span v-if="selected"> · {{ selected }}</span></p><button v-if="query || section || kind || selected" @click="reset">清除筛选</button><select v-model="sort" aria-label="排序方式" @change="writeUrl()"><option value="recent">最近更新</option><option value="relevance" :disabled="!query.trim()">相关度</option></select></div>
    <ChapterCards v-if="cards.length" :items="cards" />
    <p v-else class="tag-empty">没有找到匹配的内容。试试其他关键词，或清除筛选。</p>
  </section>
</template>
<style scoped>
.tag-search { display:block; margin:20px 0 12px; }
input,select { min-height:44px; padding:8px 12px; border:1px solid var(--vp-c-divider); border-radius:6px; background:var(--vp-c-bg-alt); font:14px var(--vp-font-family-base); color:var(--vp-c-text-1); }
.tag-search input { width:100%; font-size:16px; padding-inline:16px; }
.catalog-filters { display:flex; gap:10px; margin-bottom:14px; }
.catalog-filters label { flex:1; }
.catalog-filters select { width:100%; }
.tag-filters { display:flex; flex-wrap:wrap; gap:6px; align-items:center; position:relative; }
.tag-filters button,.topic-picker summary { padding:7px 10px; min-height:36px; border:1px solid transparent; border-radius:5px; font-size:13px; color:var(--vp-c-text-2); cursor:pointer; }
.tag-filters button:hover { background:var(--vp-c-bg-soft); }
.tag-filters button[aria-pressed='true'] { color:var(--vp-c-brand-1); background:var(--vp-c-bg-soft); border-color:var(--vp-c-divider); }
.topic-picker { margin:0; }
.topic-picker summary { color:var(--vp-c-brand-1); }
.topic-panel { position:absolute; left:0; right:0; z-index:5; margin-top:8px; padding:14px; border:1px solid var(--vp-c-divider); border-radius:8px; background:var(--vp-c-bg); box-shadow:0 12px 28px #0002; }
.topic-panel input { width:100%; }
.topic-options { display:flex; flex-wrap:wrap; gap:6px; max-height:220px; overflow:auto; margin-top:12px; overscroll-behavior:contain; }
.topic-options span { margin-left:5px; opacity:.7; font-size:11px; }
.catalog-summary { display:flex; gap:12px; align-items:center; margin-top:22px; padding-bottom:10px; border-bottom:1px solid var(--vp-c-divider); font-size:13px; color:var(--vp-c-text-2); }
.vp-doc .catalog-summary p { margin:0; font-size:13px; }
.catalog-summary button { font-size:12px; color:var(--vp-c-brand-1); min-height:40px; }
.catalog-summary select { margin-left:auto; border:0; background:transparent; min-height:40px; padding-inline:4px; font-size:12px; }
.tag-empty { padding:24px 0; color:var(--vp-c-text-2); }
@media(max-width:480px) { .tag-filters { gap:3px; } .tag-filters button { padding-inline:8px; font-size:12px; } }
</style>
