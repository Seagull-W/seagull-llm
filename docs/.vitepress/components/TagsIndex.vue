<script setup lang="ts">
import '../theme/styles/tag-editions.css'
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vitepress'
import { data as pages } from '../data/tagged-pages.data'
import { contextFor, fold, isMaturity, maturities, maturityLabels, metadataScore, newestFirst, normalizeTag, queryTerms, sections, type Maturity } from '../content-catalog'
import { normalizeContentPath } from '../public-content'
import ChapterCards from './ChapterCards.vue'
import MaturityIcon from './MaturityIcon.vue'
const KnowledgeGraph = defineAsyncComponent(() => import('./KnowledgeGraph.vue'))
const view = ref<'list' | 'graph'>('list')
const selected = ref(''), query = ref(''), section = ref(''), kind = ref(''), sort = ref('recent'), topicQuery = ref('')
const maturity = ref<Maturity | ''>('')
const picker = ref<HTMLDetailsElement>()
const router = useRouter()
let indexPath: string
let restoreRouteHook: () => void
const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const page of pages) for (const tag of page.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
})
const kinds = [...new Set(pages.map(p => p.kind))]
const common = computed(() => tags.value.slice(0, 5))
const moreTags = computed(() => tags.value.filter(([tag]) => fold(tag).includes(fold(topicQuery.value))))
const terms = computed(() => queryTerms(query.value))
const contextPages = computed(() => pages.filter(page => {
  if (section.value && page.section !== section.value) return false
  if (kind.value && page.kind !== kind.value) return false
  if (selected.value && !page.tags.includes(selected.value)) return false
  if (!terms.value.length) return true
  const text = fold([page.title, page.description, ...page.tags].join(' '))
  return terms.value.every(term => text.includes(term))
}))
const maturityCounts = computed(() => {
  const counts: Record<Maturity, number> = { seedling: 0, budding: 0, evergreen: 0 }
  for (const page of contextPages.value) counts[page.maturity]++
  return counts
})
const filtered = computed(() => contextPages.value
  .filter(page => !maturity.value || page.maturity === maturity.value)
  .sort((a, b) => sort.value === 'relevance' && terms.value.length
    ? metadataScore(b, terms.value) - metadataScore(a, terms.value) || newestFirst(a, b)
    : newestFirst(a, b)))
const cards = computed(() => filtered.value.map(page => ({
  title: page.title, link: page.url, description: page.description, label: contextFor(page),
  date: page.section === 'research' ? page.updated : undefined, maturity: page.maturity
})))
function readUrl() {
  const url = new URL(location.href)
  if (normalizeContentPath(url.pathname) !== indexPath) return
  const requestedView = url.searchParams.get('view')
  view.value = requestedView === 'graph' ? 'graph' : 'list'
  query.value = url.searchParams.get('q') || ''
  section.value = url.searchParams.get('section') || ''
  kind.value = url.searchParams.get('type') || ''
  sort.value = url.searchParams.get('sort') || (query.value ? 'relevance' : 'recent')
  let tag = url.hash.slice(1)
  try { tag = decodeURIComponent(tag) } catch { /* A literal percent sign can occur in a pasted tag. */ }
  selected.value = normalizeTag(tag)
  const requested = url.searchParams.get('maturity')
  maturity.value = isMaturity(requested) ? requested : ''
  if ((requested !== null && (!maturity.value || !maturityCounts.value[maturity.value])) ||
      (requestedView !== null && requestedView !== 'graph')) writeUrl(true)
}
function writeUrl(replace = false) {
  // Keep the newly chosen context when its results no longer include the selected stage.
  if (maturity.value && !maturityCounts.value[maturity.value]) maturity.value = ''
  const url = new URL(location.href)
  const filters = [
    ['view', view.value === 'graph' ? 'graph' : ''], ['q', query.value],
    ['section', section.value], ['type', kind.value], ['maturity', maturity.value],
    ['sort', sort.value === 'recent' && !query.value ? '' : sort.value]
  ]
  for (const [key, value] of filters) value ? url.searchParams.set(key, value) : url.searchParams.delete(key)
  url.hash = selected.value ? encodeURIComponent(selected.value) : ''
  if (url.href === location.href) return
  history[replace ? 'replaceState' : 'pushState'](history.state, '', url)
}
function selectView(mode: 'list' | 'graph') {
  view.value = mode
  writeUrl()
}
function selectSection(id: string) {
  section.value = id
  writeUrl()
}
function selectTag(tag: string) { selected.value = tag; if (picker.value) picker.value.open = false; topicQuery.value = ''; writeUrl() }
function selectMaturity(level: Maturity) {
  maturity.value = maturity.value === level ? '' : level
  writeUrl()
}
function reset() {
  query.value = ''
  section.value = ''
  kind.value = ''
  selected.value = ''
  maturity.value = ''
  sort.value = 'recent'
  topicQuery.value = ''
  if (picker.value) picker.value.open = false
  writeUrl()
}
function search() { sort.value = query.value ? 'relevance' : 'recent'; writeUrl(true) }
onMounted(() => {
  indexPath = normalizeContentPath(location.pathname)
  readUrl()
  window.addEventListener('popstate', readUrl)
  window.addEventListener('hashchange', readUrl)
  // VitePress also reuses this page for links that change only its query.
  const previous = router.onAfterRouteChange
  const afterNavigation = previous ?? router.onAfterRouteChanged
  const syncUrl = async (to: string) => { await afterNavigation?.(to); readUrl() }
  router.onAfterRouteChange = syncUrl
  restoreRouteHook = () => {
    if (router.onAfterRouteChange === syncUrl) router.onAfterRouteChange = previous
  }
})
onUnmounted(() => {
  restoreRouteHook()
  window.removeEventListener('popstate', readUrl)
  window.removeEventListener('hashchange', readUrl)
})
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
    <div class="maturity-filters" role="group" aria-label="成熟度">
      <span class="maturity-label" aria-hidden="true">成熟度</span>
      <button v-for="level in maturities" :key="level" type="button" :value="level"
        :aria-pressed="maturity === level" :disabled="maturityCounts[level] === 0" @click="selectMaturity(level)">
        <MaturityIcon :maturity="level" />{{ maturityLabels[level] }} <span class="maturity-count">{{ maturityCounts[level] }}</span>
      </button>
    </div>
    <div class="catalog-summary">
      <p role="status">{{ filtered.length }} 项内容<span v-if="selected"> · {{ selected }}</span></p>
      <button v-if="query || section || kind || selected || maturity" @click="reset">清除筛选</button>
      <select v-if="view === 'list'" v-model="sort" aria-label="排序方式" @change="writeUrl()">
        <option value="recent">最近更新</option><option value="relevance" :disabled="!query.trim()">相关度</option>
      </select>
      <div class="catalog-view" role="group" aria-label="浏览视图">
        <button type="button" :aria-pressed="view === 'list'" @click="selectView('list')">列表</button>
        <button type="button" :aria-pressed="view === 'graph'" @click="selectView('graph')">图谱</button>
      </div>
    </div>
    <p v-if="!filtered.length" class="tag-empty">没有找到匹配的内容。试试其他关键词，或清除筛选。</p>
    <ChapterCards v-else-if="view === 'list'" :items="cards" />
    <ClientOnly v-else>
      <KnowledgeGraph :pages="filtered" @tag="selectTag" @section="selectSection" />
    </ClientOnly>
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
.tag-filters button,.topic-picker summary { padding:7px 10px; min-height:36px; border:1px solid var(--vp-c-divider); border-radius:5px; font-size:13px; color:var(--vp-c-text-2); cursor:pointer; }
.tag-filters button:hover,.topic-picker summary:hover { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); }
.tag-filters button[aria-pressed='true'] { color:var(--vp-c-brand-1); background:var(--vp-c-bg-soft); border-color:var(--vp-c-brand-1); }
.topic-picker { margin:0; }
.topic-picker summary { display:inline-flex; align-items:center; gap:4px; border-color:transparent; color:var(--vp-c-brand-1); }
.topic-panel { position:absolute; left:0; right:0; z-index:5; margin-top:8px; padding:14px; border:1px solid var(--vp-c-divider); border-radius:8px; background:var(--vp-c-bg); box-shadow:0 12px 28px #0002; }
.topic-panel input { width:100%; }
.topic-options { display:flex; flex-wrap:wrap; gap:6px; max-height:220px; overflow:auto; margin-top:12px; overscroll-behavior:contain; }
.topic-options span { margin-left:5px; opacity:.7; font-size:11px; }
.catalog-summary { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; margin-top:22px; padding-bottom:10px; border-bottom:1px solid var(--vp-c-divider); font-size:13px; color:var(--vp-c-text-2); }
.vp-doc .catalog-summary p { margin:0; font-size:13px; }
.catalog-summary button { font-size:12px; color:var(--vp-c-brand-1); min-height:40px; }
.catalog-summary select { margin-left:auto; border:0; background:transparent; min-height:40px; padding-inline:4px; font-size:12px; }
.catalog-view { display:inline-flex; margin-inline-start:auto; padding:2px; border:1px solid var(--vp-c-divider); border-radius:6px; }
.catalog-summary select + .catalog-view { margin-inline-start:0; }
.catalog-view button { min-height:32px; padding:3px 10px; border-radius:4px; color:var(--vp-c-text-2); text-decoration:none; }
.catalog-view button[aria-pressed='true'] { background:var(--vp-c-bg-soft); color:var(--vp-c-brand-1); font-weight:600; }
.catalog-view button:focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:-2px; }
.tag-empty { padding:24px 0; color:var(--vp-c-text-2); }
@media(max-width:480px) { .tag-filters { gap:3px; } .tag-filters button { padding-inline:8px; font-size:12px; } }
</style>
