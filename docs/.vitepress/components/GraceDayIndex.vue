<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import type { ContentEntry } from '../content-catalog'
import type { GraceHomeColumn } from './grace-home-data'

const props = defineProps<{
  sections: GraceHomeColumn[]
  selected: string
  story?: ContentEntry
}>()
const emit = defineEmits<{ select: [id: string]; explore: [] }>()
const current = computed(() => props.sections.find(section => section.id === props.selected))
const stories = computed(() => props.sections.flatMap(section => section.items))
</script>

<template>
  <section class="gd-board" data-grace-day aria-label="赐福选读与栏目索引">
    <div class="gd-scene">
      <div v-if="current" id="grace-day-reading" class="gd-reading">
        <div class="gd-reading-body">
          <div class="gd-provenance">
            <svg class="gd-grace" viewBox="0 0 38 40" fill="none" aria-hidden="true">
              <path d="M2 34c3.8-2.5 12.3-4.5 19.4-5-5.5 1.3-9.3 3.2-11 5.3 6.9-3.2 15.2-5.6 24.9-5.4-3.1 2.3-12.2 5.7-21.2 7.3" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" />
              <path class="gd-wisp" d="M15.4 29.7c6.8-3.5 11.9-10.5 10.9-16.5-1.3 4.9-3.4 7.5-5.6 8.2 1.7-4.2.4-7.9 1-11.5.8-3.8 2.7-6.7 5.2-9.3-5.3 2.1-9.7 7.8-10.1 12.8-.4 3.6 1.6 6.9.7 10.3-.4 2-1.2 3.8-2.1 6Z" fill="currentColor" />
            </svg>
            <a class="gd-column-link" :href="withBase(current.url)">
              {{ current.title }}<span aria-hidden="true"> ↗</span>
            </a>
          </div>
          <button v-if="stories.length > 1" type="button" class="gd-explore" @click="emit('explore')">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
              <path d="M3 7a7 7 0 1 1 .5 7M3 2.5V7h4.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>换一篇
          </button>
          <div class="gd-title-space" aria-live="polite" aria-atomic="true">
            <a v-if="story" class="gd-story" :href="withBase(story.url)">{{ story.title }}</a>
            <span v-else class="gd-empty">这个栏目暂无选篇。</span>
          </div>
        </div>
        <!-- Keep the control and the article baseline fixed at the longest real title wrap. -->
        <div class="gd-sizing" aria-hidden="true">
          <span v-for="entry in stories" :key="entry.url">{{ entry.title }}</span>
        </div>
      </div>
    </div>

    <nav id="grace-home-directory" class="gd-directory" aria-labelledby="gd-directory-title">
      <header class="gd-directory-head">
        <h2 id="gd-directory-title">栏目索引</h2>
        <span aria-hidden="true">选读</span>
      </header>
      <ul>
        <li v-for="section in sections" :key="section.id" :class="{ 'gd-current': selected === section.id }">
          <a :href="withBase(section.url)">{{ section.title }}</a>
          <button
            type="button" class="gd-preview" :aria-label="'选读' + section.title" :title="'选读' + section.title"
            :data-grace-column="section.id" :aria-pressed="selected === section.id"
            aria-controls="grace-day-reading" @click="emit('select', section.id)"
          >
            <svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
              <path d="M11 6.4C8.5 4.3 5.4 4 2.7 4.5v12c3.1-.5 5.8 0 8.3 2 2.5-2 5.2-2.5 8.3-2v-12c-2.7-.5-5.8-.2-8.3 1.9Zm0 0v12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  </section>
</template>

<style scoped src="./grace-day-index.css"></style>
