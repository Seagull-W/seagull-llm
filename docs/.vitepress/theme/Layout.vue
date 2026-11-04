<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, nextTick, onMounted, onUnmounted, provide, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import ReaderNavigation from '../components/ReaderNavigation.vue'
import HomeHero from '../components/HomeHero.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import NavActions from '../components/NavActions.vue'
import SearchDialog from '../components/SearchDialog.vue'
import ArticleContext from '../components/ArticleContext.vue'
import RelatedReading from '../components/RelatedReading.vue'
import ReadingMedia from '../components/ReadingMedia.vue'
import PixelThemeFilter from '../components/PixelThemeFilter.vue'
import { usesAcademicReading } from './reading-design'
import { sectionFor } from '../content-catalog'
import { createVisualStyleControls, visualStyles, visualStyleKey, visualStyleControlsKey } from './visual-styles'
import './styles/route-arrival.css'
import { showPageArrival } from './page-arrival'
const styleControls = createVisualStyleControls()
const visualStyle = computed(() => visualStyles[styleControls.selected.value])
provide(visualStyleKey, visualStyle)
provide(visualStyleControlsKey, styleControls)
const { Layout } = DefaultTheme
const { frontmatter, page } = useData()
let stopHomeOpening: (() => void) | undefined
onMounted(() => {
  // A direct visit to the home page gives this tab one opening shot. Wait for
  // the saved artwork to replace the server default without delaying the page.
  if (frontmatter.value.layout === 'home' && !location.hash && !window.scrollY) {
    let seen = false
    try {
      seen = sessionStorage.getItem('seagull-home-opening') === 'seen'
      sessionStorage.setItem('seagull-home-opening', 'seen')
    } catch { /* Still usable when tab storage is unavailable. */ }
    if (!seen) nextTick(() => {
      if (frontmatter.value.layout === 'home' && !window.scrollY) stopHomeOpening = showPageArrival(styleControls.selected.value)
    })
  }
  watch(() => page.value.relativePath, (_page, _previous, onCleanup) => {
    stopHomeOpening?.()
    stopHomeOpening = undefined
    const stop = showPageArrival(styleControls.selected.value)
    if (stop) onCleanup(stop)
  }, { flush: 'post' })
})
onUnmounted(() => stopHomeOpening?.())
const academicReading = computed(() => usesAcademicReading('/' + page.value.relativePath, frontmatter.value))
const sectionClass = computed(() => {
  const section = sectionFor('/' + page.value.relativePath)
  return section ? 'section-' + section.id : ''
})
</script>
<template>
  <Layout :data-visual-style="visualStyle.id" :class="[sectionClass, { 'academic-reading': academicReading }]">
    <template #layout-top><PixelThemeFilter /><ClientOnly><ReadingProgress v-if="academicReading" /></ClientOnly></template>
    <template #nav-bar-content-before><SearchDialog /></template>
    <template #nav-bar-title-before><img class="logo visual-logo" :src="withBase(visualStyle.assets.logo)" alt="seagull 首页" width="36" height="36" /></template>
    <template #nav-bar-content-after><NavActions /></template>
    <template #home-hero-info><HomeHero /></template>
    <template #doc-top><ReaderNavigation /></template>
    <template #doc-before><ArticleContext v-if="academicReading" /><div v-if="frontmatter.status === 'draft'" class="draft-notice">本文仍在写作中，内容尚未完成。</div></template>
    <template #doc-after><RelatedReading v-if="academicReading" /></template>
    <template #layout-bottom><ClientOnly><ReadingMedia /></ClientOnly></template>
  </Layout>
</template>
