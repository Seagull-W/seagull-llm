<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { sectionFor, topicTags } from '../content-catalog'
const { page, frontmatter } = useData()
const section = computed(() => sectionFor('/' + page.value.relativePath))
const tags = computed(() => topicTags(frontmatter.value.tags || []))
</script>
<template>
  <div class="article-context">
    <nav aria-label="当前位置"><a :href="withBase('/')">首页</a><span aria-hidden="true">/</span><a v-if="section" :href="withBase('/' + section.id + '/')">{{ section.title }}</a><time v-if="frontmatter.date" :datetime="String(frontmatter.date)">{{ String(frontmatter.date).slice(0, 10) }}</time></nav>
    <nav v-if="tags.length" class="article-topics" aria-label="文章主题"><a v-for="tag in tags" :key="tag" :href="withBase('/tags') + '#' + encodeURIComponent(tag)">{{ tag }}</a></nav>
  </div>
</template>
<style scoped>
.article-context { max-width:720px; margin:0 auto 22px; font:12px/1.8 var(--vp-font-family-base); color:var(--vp-c-text-2); }
nav { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:center; }
a:hover { color:var(--vp-c-brand-1); text-decoration:underline; }
time { margin-left:auto; font-variant-numeric:tabular-nums; }
.article-topics { gap:6px 14px; margin-top:10px; }
.article-topics a { color:var(--vp-c-brand-1); }
</style>
