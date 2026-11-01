<script setup lang="ts">
import { computed, ref, watch } from 'vue'
export interface Heading { id: string; text: string; level: number }
const props = defineProps<{ groups: { heading: Heading; children: Heading[] }[]; active: string; expanded: string }>()
defineEmits<{ jump: [id: string]; toggle: [id: string] }>()
const subExpanded = ref('')
const sections = computed(() => props.groups.map(group => {
  const children: { heading: Heading; children: Heading[] }[] = []
  for (const h of group.children) {
    if (h.level === 3 || !children.length) children.push({ heading: h, children: [] })
    else children.at(-1)!.children.push(h)
  }
  return { heading: group.heading, children }
}))
watch(() => props.active, id => {
  subExpanded.value = sections.value.flatMap(s => s.children).find(s => s.heading.id === id || s.children.some(h => h.id === id))?.heading.id || ''
}, { immediate: true })
</script>
<template>
  <nav class="reader-toc-list" aria-label="本页标题">
    <div v-for="group in sections" :key="group.heading.id" class="toc-group">
      <div class="toc-group-title"><a :href="'#' + encodeURIComponent(group.heading.id)" :aria-current="active === group.heading.id ? 'location' : undefined" @click.prevent="$emit('jump', group.heading.id)">{{ group.heading.text }}</a><button v-if="group.children.length" :aria-label="(expanded === group.heading.id ? '收起' : '展开') + group.heading.text" :aria-expanded="expanded === group.heading.id" @click="$emit('toggle', group.heading.id)">{{ expanded === group.heading.id ? '−' : '+' }}</button></div>
      <div v-if="expanded === group.heading.id" class="toc-children">
        <div v-for="sub in group.children" :key="sub.heading.id">
          <div class="toc-group-title"><a :href="'#' + encodeURIComponent(sub.heading.id)" :aria-current="active === sub.heading.id ? 'location' : undefined" @click.prevent="$emit('jump', sub.heading.id)">{{ sub.heading.text }}</a><button v-if="sub.children.length" :aria-label="(subExpanded === sub.heading.id ? '收起' : '展开') + sub.heading.text" :aria-expanded="subExpanded === sub.heading.id" @click="subExpanded = subExpanded === sub.heading.id ? '' : sub.heading.id">{{ subExpanded === sub.heading.id ? '−' : '+' }}</button></div>
          <template v-if="subExpanded === sub.heading.id"><a v-for="h in sub.children" :key="h.id" :href="'#' + encodeURIComponent(h.id)" :style="{ '--depth': Math.min(2, h.level - 3) }" :aria-current="active === h.id ? 'location' : undefined" @click.prevent="$emit('jump', h.id)">{{ h.text }}</a></template>
        </div>
      </div>
    </div>
  </nav>
</template>
