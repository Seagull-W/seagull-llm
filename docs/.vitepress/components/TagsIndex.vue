<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { data as pages } from '../data/tagged-pages.data'
import ChapterCards from './ChapterCards.vue'

const selected = ref('')
const query = ref('')
const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const page of pages) for (const tag of page.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
})
const filtered = computed(() => pages.filter(page =>
  (!selected.value || page.tags.includes(selected.value)) &&
  `${page.title} ${page.description} ${page.tags.join(' ')}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
))
const cards = computed(() => filtered.value.map(page => ({
  title: page.title, link: page.url, description: page.description, label: page.tags.join(' / ')
})))
function readHash() {
  try {
    const tag = decodeURIComponent(window.location.hash.slice(1))
    selected.value = tags.value.some(([name]) => name === tag) ? tag : ''
  } catch { selected.value = '' }
}
function selectTag(tag: string) {
  selected.value = tag
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + (tag ? `#${encodeURIComponent(tag)}` : ''))
}
onMounted(() => { readHash(); window.addEventListener('hashchange', readHash) })
onUnmounted(() => window.removeEventListener('hashchange', readHash))
</script>

<template>
  <section class="tag-index" aria-label="按标签查找内容">
    <label class="tag-search">搜索内容
      <input v-model="query" type="search" placeholder="输入标题、主题或关键词" />
    </label>
    <details class="tag-disclosure"><summary>按主题筛选 · {{ selected || '全部主题' }}</summary>
    <div class="tag-filters" aria-label="标签筛选">
      <button type="button" :aria-pressed="!selected" @click="selectTag('')">全部内容 <span>{{ pages.length }}</span></button>
      <button v-for="[tag, count] in tags" :key="tag" type="button" :aria-pressed="selected === tag" @click="selectTag(tag)">{{ tag }} <span>{{ count }}</span></button>
    </div>

    </details>
    <p class="tag-summary" role="status">{{ selected || '全部内容' }} · {{ filtered.length }} 篇</p>
    <ChapterCards v-if="cards.length" :items="cards" />
    <p v-else class="tag-empty">没有找到匹配的内容。试试其他关键词或标签。</p>
  </section>
</template>

<style scoped>
.tag-filters { display: flex; flex-wrap: wrap; gap: 10px; margin: 28px 0; }
.tag-filters button { padding: 7px 12px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-alt); color: var(--vp-c-text-2); font-size: 14px; cursor: pointer; }
.tag-filters button[aria-pressed='true'] { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); background: var(--vp-c-bg-soft); }
.tag-filters span { margin-left: 6px; font-size: 12px; }
.tag-search { display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--vp-c-text-2); }
.tag-search input { width: 100%; padding: 12px 14px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-alt); font: inherit; color: var(--vp-c-text-1); }
.tag-search input::placeholder { color: var(--vp-c-text-3); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.vp-doc .tag-summary { font-size: 14px; color: var(--vp-c-text-2); margin-top: 24px; }
.tag-empty { padding: 24px 0; color: var(--vp-c-text-2); }
</style>
