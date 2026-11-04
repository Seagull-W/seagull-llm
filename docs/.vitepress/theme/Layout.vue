<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, onMounted, provide, watch } from 'vue'
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
import { createVisualStyleControls, visualStyles, visualStyleKey, visualStyleControlsKey } from './visual-styles'
import './styles/route-arrival.css'
const styleControls = createVisualStyleControls()
const visualStyle = computed(() => visualStyles[styleControls.selected.value])
provide(visualStyleKey, visualStyle)
provide(visualStyleControlsKey, styleControls)
const { Layout } = DefaultTheme
const { frontmatter, page } = useData()
onMounted(() => {
  watch(() => page.value.relativePath, (_page, _previous, onCleanup) => {
    if (location.hash || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    const opening = document.querySelector<HTMLElement>('.VPHome .hero-art, .VPHome .film-frame, .VPDoc .section-illustration')
      ?? document.querySelector<HTMLElement>('.VPDoc main h1')
    if (!opening) return

    opening.dataset.routeArrival = styleControls.selected.value
    const clear = () => {
      delete opening.dataset.routeArrival
      opening.removeEventListener('animationend', finish)
      opening.removeEventListener('animationcancel', finish)
    }
    const finish = (event: AnimationEvent) => {
      if (event.target === opening && event.animationName.startsWith('seagull-arrive-')) clear()
    }
    opening.addEventListener('animationend', finish)
    opening.addEventListener('animationcancel', finish)
    onCleanup(clear)
  }, { flush: 'post' })
})
const academicReading = computed(() => usesAcademicReading('/' + page.value.relativePath, frontmatter.value))
const sectionClass = computed(() => {
  const section = page.value.relativePath?.split('/')[0]
  return ['research', 'papers', 'rl-book', 'westlake-rl', 'rust-notes', 'linux-notes', 'cs336', 'videos'].includes(section) ? 'section-' + section : ''
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
