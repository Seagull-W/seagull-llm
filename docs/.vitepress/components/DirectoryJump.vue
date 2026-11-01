<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { onContentUpdated } from 'vitepress'
const groups = shallowRef<{ id: string; title: string; count: number }[]>([])
function refresh() {
  groups.value = Array.from(document.querySelectorAll<HTMLElement>('.format-directory .note-panel > h2')).map(h => ({ id: h.id, title: h.textContent?.trim() || '', count: h.parentElement!.querySelectorAll('.chapter-card').length }))
}
onMounted(refresh)
onContentUpdated(refresh)
function jump(event: Event) {
  const select = event.target as HTMLSelectElement
  document.getElementById(select.value)?.scrollIntoView({ block: 'start' })
  history.pushState(history.state, '', '#' + encodeURIComponent(select.value))
  select.value = ''
}
</script>
<template><label v-if="groups.length > 3" class="directory-jump"><span>浏览分组</span><select aria-label="跳转到文章分组" @change="jump"><option value="">选择分组…</option><option v-for="group in groups" :key="group.id" :value="group.id">{{ group.title }} · {{ group.count }}</option></select></label></template>
<style scoped>
.directory-jump { display:flex; align-items:center; gap:14px; font-size:13px; color:var(--vp-c-text-2); margin-bottom:18px; }
select { flex:1; max-width:360px; min-width:0; min-height:40px; border:1px solid var(--vp-c-divider); border-radius:5px; padding:8px 10px; font:13px var(--vp-font-family-base); background:var(--vp-c-bg-alt); color:var(--vp-c-text-1); }
</style>
