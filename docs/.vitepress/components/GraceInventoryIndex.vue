<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import type { ContentEntry } from '../content-catalog'
import { themeImagePath } from '../theme/visual-styles'
import { graceCharacters, portraitPath } from './grace-characters'
import type { GraceHomeColumn } from './grace-home-data'

const props = defineProps<{ sections: GraceHomeColumn[]; selected: string; story?: ContentEntry }>()
const emit = defineEmits<{ select: [id: string]; explore: [] }>()
const current = computed(() => props.sections.find(section => section.id === props.selected))
const companion = computed(() => current.value?.items.find(item => item.url !== props.story?.url))
const titles = computed(() => [...new Set(props.sections.flatMap(section => section.items.map(item => item.title)))])
const companionTitles = computed(() => props.sections.flatMap(section => section.items.slice(0, 2).map(item => item.title)))
const portraits = Object.fromEntries(graceCharacters.map(character => [
  character.section === 'tags' ? 'cuda-notes' : character.section, portraitPath(character),
]))
const scenery: Record<string, string> = {
  'vllm-notes': '/images/grace-archive/limgrave-small.webp',
  videos: '/images/grace-archive/night-sky-small.webp',
}

</script>

<template>
  <div class="night-ledger">
    <nav id="grace-home-directory" class="night-directory" aria-label="栏目">
      <header class="directory-heading">
        <h2>栏目</h2>
        <span>点图选读</span>
      </header>
      <ul class="directory-slots">
        <li v-for="section in sections" :key="section.id" :class="{ 'slot-active': section.id === selected }">
          <button type="button" class="slot-art" :aria-pressed="section.id === selected"
            :aria-label="'选读' + section.title" aria-controls="night-reading" @click="emit('select', section.id)">
            <img v-if="portraits[section.id]" class="item-portrait" :src="withBase(portraits[section.id])"
              width="248" height="256" alt="" decoding="async" />
            <img v-else-if="scenery[section.id]" class="item-view" :src="withBase(themeImagePath(scenery[section.id]))"
              width="160" height="90" alt="" decoding="async" />
            <span v-else class="item-initial" aria-hidden="true">{{ section.title.slice(0, 1) }}</span>
          </button>
          <a class="slot-link" :href="withBase(section.url)">{{ section.title }}<span aria-hidden="true">›</span></a>
        </li>
      </ul>
    </nav>

    <section id="night-reading" class="night-reading" aria-label="栏目选篇">
      <div class="reading-meta">
        <a v-if="current" :href="withBase(current.url)">{{ current.title }}<span aria-hidden="true"> ›</span></a>
        <button v-if="sections.some(section => section.id !== selected && section.items.length)" type="button" class="night-explore" @click="emit('explore')">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
            <path d="M3 6h3c4 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2.4 0 4-3.2 5.3-5.8M14 8c1.4-1.7 2.7-2 4-2h3m-4-4 4 4-4 4"/>
          </svg>
          换个栏目
        </button>
      </div>
      <div class="reading-body">
        <!-- Reserve both text blocks using the titles that can actually appear at this width. -->
        <div class="reading-measure" aria-hidden="true">
          <div class="title-measure reading-titles">
            <span v-for="title in titles" :key="title">{{ title }}</span>
          </div>
          <div class="title-measure companion-story">
            <span v-for="(title, i) in companionTitles" :key="i"><span class="companion-label">同栏选读</span>{{ title }}</span>
          </div>
        </div>
        <div class="story-copy" aria-live="polite" aria-atomic="true">
          <h3 v-if="story" class="reading-titles"><a :href="withBase(story.url)">{{ story.title }}</a></h3>
          <p v-else class="empty-story">本栏暂无选篇</p>
          <div class="story-abstract"><p v-if="story?.description">{{ story.description }}</p></div>
          <a v-if="companion" class="companion-story" :href="withBase(companion.url)">
            <span class="companion-label">同栏选读</span>{{ companion.title }}
          </a>
        </div>
      </div>
    </section>

    <div class="night-journal"><slot name="journal" /></div>
  </div>
</template>

<style scoped src="./grace-inventory-index.css"></style>
