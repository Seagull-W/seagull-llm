<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed } from 'vue'
import { useData } from 'vitepress'
import ReaderNavigation from '../components/ReaderNavigation.vue'
import SeagullLens from '../components/SeagullLens.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import NavActions from '../components/NavActions.vue'
import SearchDialog from '../components/SearchDialog.vue'
import ArticleContext from '../components/ArticleContext.vue'
import RelatedReading from '../components/RelatedReading.vue'
import ReadingMedia from '../components/ReadingMedia.vue'
import { usesAcademicReading } from './reading-design'
const { Layout } = DefaultTheme
const { frontmatter, page } = useData()
const academicReading = computed(() => usesAcademicReading('/' + page.value.relativePath, frontmatter.value))
const sectionClass = computed(() => {
  const section = page.value.relativePath?.split('/')[0]
  return ['research', 'papers', 'rl-book', 'westlake-rl', 'rust-notes', 'linux-notes', 'videos'].includes(section) ? 'section-' + section : ''
})
</script>
<template>
  <Layout :class="[sectionClass, { 'academic-reading': academicReading }]">
    <template #layout-top><ClientOnly><ReadingProgress v-if="academicReading" /></ClientOnly></template>
    <template #nav-bar-content-before><SearchDialog /></template>
    <template #nav-bar-content-after><NavActions /></template>
    <template #home-hero-image><SeagullLens /></template>
    <template #home-hero-info>
      <h1 class="seagull-hero-heading"><span class="seagull-hero-wordmark" aria-label="SEAGULL"><span aria-hidden="true">S<span class="wordmark-e">E</span><span class="wordmark-a">A</span>GULL</span></span><span class="seagull-hero-title">{{ frontmatter.hero.text }}</span></h1>
      <p class="seagull-hero-tagline">{{ frontmatter.hero.tagline }}</p>
    </template>
    <template #doc-top><ReaderNavigation /></template>
    <template #doc-before><ArticleContext v-if="academicReading" /><div v-if="frontmatter.status === 'draft'" class="draft-notice">本文仍在写作中，内容尚未完成。</div></template>
    <template #doc-after><RelatedReading v-if="academicReading" /></template>
    <template #layout-bottom><ClientOnly><ReadingMedia /></ClientOnly></template>
  </Layout>
</template>
