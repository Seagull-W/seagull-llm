<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import type { ContentEntry } from '../content-catalog'
import { normalizeContentPath } from '../public-content'
import { getHomeTopics } from './home-discovery-data'
import { connectedColumns, graceColumns } from './grace-home-data'
import GraceDayIndex from './GraceDayIndex.vue'
import GraceInventoryIndex from './GraceInventoryIndex.vue'
import GraceHomeJournal from './GraceHomeJournal.vue'

const props = defineProps<{ pages: ContentEntry[] }>()
const { isDark } = useData()
const columns = computed(() => graceColumns(props.pages))
const topics = computed(() => getHomeTopics(props.pages))
const selected = ref('cs336')
const selectedUrl = ref('')
const column = computed(() => columns.value.find(c => c.id === selected.value) ?? columns.value[0])
const story = computed(() => {
  const items = column.value?.items ?? []
  return items.find(item => item.url === selectedUrl.value)
    ?? (column.value?.id === 'cs336' ? items.find(item => normalizeContentPath(item.url) === '/cs336/lecture-05') : undefined)
    ?? items[0]
})
const related = computed(() => story.value ? connectedColumns(story.value, columns.value, topics.value) : undefined)
let visited = new Set([selected.value])
function select(id: string) {
  if (selected.value === id) return
  selected.value = id
  selectedUrl.value = ''
  visited.add(id)
}
function explore() {
  const others = columns.value.filter(c => c.items.length && c.id !== selected.value)
  let unvisited = others.filter(c => !visited.has(c.id))
  if (!unvisited.length) {
    visited = new Set([selected.value])
    unvisited = others
  }
  const next = unvisited[Math.floor(Math.random() * unvisited.length)] ?? column.value
  if (!next?.items.length) return
  const choices = next.id === selected.value ? next.items.filter(item => item.url !== story.value?.url) : next.items
  if (!choices.length) return
  select(next.id)
  selectedUrl.value = choices[Math.floor(Math.random() * choices.length)].url
}
</script>

<template>
  <div v-if="column" class="grace-discovery">
    <GraceInventoryIndex v-if="isDark" :sections="columns" :selected="column.id" :story="story" @select="select" @explore="explore">
      <template #journal><GraceHomeJournal night /></template>
    </GraceInventoryIndex>
    <template v-else>
      <GraceDayIndex :sections="columns" :selected="column.id" :story="story" @select="select" @explore="explore" />
      <GraceHomeJournal />
    </template>
    <nav class="grace-crossreading" aria-label="从选篇继续逛栏目">
      <template v-if="related?.columns.length">
        <span>同题选读 · {{ related.label }}</span>
        <a v-for="peer in related.columns" :key="peer.id" :href="withBase(peer.url)">{{ peer.title }} ↗</a>
      </template>
      <template v-else><span>本栏选读</span><a :href="withBase(column.url)">{{ column.title }} ↗</a></template>
    </nav>
  </div>
</template>

<style scoped>
.grace-crossreading { display:flex; align-items:center; flex-wrap:wrap; gap:3px 18px; padding:10px 0; min-height:48px; color:var(--vp-c-text-2); font:13px/1.7 var(--grace-serif); }
.grace-crossreading a { color:var(--vp-c-brand-1); text-decoration:underline; text-underline-offset:3px; }
@media(max-width:639px) {
  .grace-crossreading { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-content:center; min-height:92px; }
  .grace-crossreading span { grid-column:1/-1; }
}
</style>
