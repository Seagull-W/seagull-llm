<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { sections, type ContentEntry } from '../content-catalog'
import { visualStyles } from '../theme/visual-styles'
import { getHomeTopics, discoveryGroups } from './home-discovery-data'

const props = defineProps<{ pages: ContentEntry[] }>()
const die = visualStyles['pixel-voyage'].assets.shuffleDie
const byId = new Map(sections.map(section => [section.id, section]))
const directory = discoveryGroups.flatMap(group => group.sectionIds.flatMap(id => byId.get(id) ?? []))
const topics = computed(() => getHomeTopics(props.pages).map(topic => ({
  ...topic,
  name: topic.key === 'reward' ? '偏好怎样变成奖励？' : topic.name,
  sources: [...new Set(topic.readings.map(({ page }) => page.section))].flatMap(id => byId.get(id) ?? []),
})))
const chosen = ref('gpu')
const active = computed(() => topics.value.find(topic => topic.key === chosen.value) ?? topics.value[0])
const hoveredSection = ref('')
const focusedSection = ref('')
const litSections = computed(() => {
  const sources = active.value?.readings.map(({ page }) => page.section) ?? []
  const highlighted = hoveredSection.value || focusedSection.value
  return new Set(sources.includes(highlighted) ? [highlighted] : sources)
})
const announcement = ref('')
let remaining: string[] = []

function shuffle() {
  const choices = topics.value.map(topic => topic.key).filter(key => key !== active.value?.key)
  remaining = remaining.filter(key => choices.some(choice => choice === key))
  if (!remaining.length) remaining = choices
  if (!remaining.length) return
  const index = Math.floor(Math.random() * remaining.length)
  chosen.value = remaining.splice(index, 1)[0]
  hoveredSection.value = ''
  focusedSection.value = ''
  announcement.value = active.value?.name ?? ''
}
function focusReading(section: string) {
  hoveredSection.value = ''
  focusedSection.value = section
}
function pointAtReading(event: PointerEvent, section: string) {
  if (event.pointerType !== 'touch') hoveredSection.value = section
}
function sectionUrl(id: string) { return withBase('/' + id + '/') }
</script>

<template>
  <div class="pixel-cliff-discovery">
    <section v-if="active" class="cliff-reading" aria-label="专题选读">
      <div id="cliff-editions" class="cliff-stage">
        <button v-if="topics.length > 1" type="button" class="cliff-shuffle" title="随机换个专题"
          aria-label="随机换个专题" aria-controls="cliff-editions" @click="shuffle">
          <img :src="withBase(die)" width="26" height="26" alt="" />
        </button>
        <article v-for="topic in topics" :key="topic.key" class="cliff-edition" :data-topic="topic.key"
          :class="{ 'is-current': active.key === topic.key }" :aria-hidden="active.key !== topic.key" :inert="active.key !== topic.key">
          <div class="cliff-sources">
            <span v-for="(source, index) in topic.sources" :key="source.id">
              <span v-if="index" class="cliff-slash" aria-hidden="true">/</span>
              <a class="cliff-source" :class="{ 'is-traced': source.id === (hoveredSection || focusedSection) }"
                :href="sectionUrl(source.id)">{{ source.title }}</a>
            </span>
          </div>
          <h2>{{ topic.name }}</h2>
          <ul class="cliff-items">
            <li v-for="{ page } in topic.readings" :key="page.url"
              @pointerenter="pointAtReading($event, page.section)" @pointerleave="hoveredSection = ''"
              @focusin="focusReading(page.section)" @focusout="focusedSection = ''">
              <a class="cliff-story" :href="withBase(page.url)">{{ page.title }}<span class="cliff-sr">，{{ byId.get(page.section)?.title }}</span><span class="cliff-arrow" aria-hidden="true">↗</span></a>
            </li>
          </ul>
        </article>
      </div>
      <span class="cliff-sr" role="status">{{ announcement }}</span>
    </section>
    <nav class="cliff-directory" aria-labelledby="cliff-directory-title">
      <h2 id="cliff-directory-title">栏目</h2>
      <div class="cliff-links">
        <a v-for="section in directory" :key="section.id" class="cliff-section"
          :class="{ 'is-lit': litSections.has(section.id) }" :href="sectionUrl(section.id)">{{ section.title }}</a>
      </div>
    </nav>
  </div>
</template>

<style scoped src="./pixel-cliff-discovery.css"></style>
