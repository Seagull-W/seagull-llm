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
.article-context {
  display:flex; align-items:center; gap:10px; max-width:var(--reading-measure);
  margin:0 auto 14px; font:12px/1.55 var(--vp-font-family-base); color:var(--vp-c-text-2);
}
.reader-imprint { flex:none; width:34px; }
.article-context .reader-imprint :deep(:is(svg,.section-photograph)) { display:block; width:100%; height:auto; }
.article-context-copy { flex:1; min-width:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 16px; }
nav { min-width:0; display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 8px; }
.section-link { font-weight:600; color:var(--vp-c-text-1); }
time { font-variant-numeric:tabular-nums; }
.article-topics { column-gap:10px; }
.article-topics a { overflow-wrap:anywhere; }
a:hover { color:var(--vp-c-brand-1); text-decoration:underline; }
</style>
