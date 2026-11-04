<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { sectionFor, topicTags } from '../content-catalog'
import SectionArtwork from './SectionArtwork.vue'
import GraceEmblem from './GraceEmblem.vue'
import { useVisualStyle } from '../theme/visual-styles'
import '../theme/styles/reader-editions.css'
const { page, frontmatter } = useData()
const style = useVisualStyle()
const section = computed(() => sectionFor('/' + page.value.relativePath))
const tags = computed(() => topicTags(frontmatter.value.tags || []))
</script>
<template>
  <div class="article-context">
    <div v-if="section" class="reader-imprint" aria-hidden="true">
      <GraceEmblem v-if="style.iconSet === 'grace'" :section="section.id" />
      <SectionArtwork v-else :section="section.id" />
    </div>
    <div class="article-context-copy">
      <nav aria-label="当前位置"><a :href="withBase('/')">首页</a><span aria-hidden="true">/</span><a v-if="section" class="section-link" :href="withBase('/' + section.id + '/')">{{ section.title }}</a><time v-if="frontmatter.date" :datetime="String(frontmatter.date)">{{ String(frontmatter.date).slice(0, 10) }}</time></nav>
      <nav v-if="tags.length" class="article-topics" aria-label="文章主题"><a v-for="tag in tags" :key="tag" :href="withBase('/tags') + '#' + encodeURIComponent(tag)">{{ tag }}</a></nav>
    </div>
  </div>
</template>
<style scoped>
.article-context { max-width:720px; margin:0 auto 22px; font:12px/1.8 var(--vp-font-family-base); color:var(--vp-c-text-2); }
nav { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:center; }
a:hover { color:var(--vp-c-brand-1); text-decoration:underline; }
time { margin-left:auto; font-variant-numeric:tabular-nums; }
.article-topics { gap:6px 14px; margin-top:10px; }
.article-topics a { color:var(--vp-c-brand-1); }
.section-link { display:inline-flex; gap:6px; align-items:center; }
</style>
