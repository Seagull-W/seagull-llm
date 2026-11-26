<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent, computed, nextTick, onMounted, onUnmounted, provide, ref, useId, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import ReaderNavigation from '../components/ReaderNavigation.vue'
import HomeHero from '../components/HomeHero.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import NavActions from '../components/NavActions.vue'
import SearchDialog from '../components/SearchDialog.vue'
import ArticleContext from '../components/ArticleContext.vue'
import RelatedReading from '../components/RelatedReading.vue'
import ReadingMedia from '../components/ReadingMedia.vue'
import GraceReadingPortrait from '../components/GraceReadingPortrait.vue'
import PixelThemeFilter from '../components/PixelThemeFilter.vue'
import ReaderIcon from '../components/ReaderIcon.vue'
import { supportsHtmlNotebook, usesAcademicReading, usesPaperNotebook } from './reading-design'
import { sectionFor } from '../content-catalog'
import { createVisualStyleControls, gracePortraitMedia, heroImageFor, heroMobileMedia, visualStyles, visualStyleKey, visualStyleControlsKey } from './visual-styles'
import './styles/route-arrival.css'
import { showPageArrival } from './page-arrival'
const HtmlNotebook = defineAsyncComponent(() => import('../components/HtmlNotebook.vue'))
const MathTexCopy = defineAsyncComponent(() => import('../components/MathTexCopy.vue'))
const styleControls = createVisualStyleControls()
const visualStyle = computed(() => visualStyles[styleControls.selected.value])
provide(visualStyleKey, visualStyle)
provide(visualStyleControlsKey, styleControls)
const { Layout } = DefaultTheme
const { frontmatter, page, isDark } = useData()
const pixelHome = computed(() => frontmatter.value.layout === 'home' && visualStyle.value.iconSet === 'pixel')
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
const paperNotebook = computed(() => usesPaperNotebook('/' + page.value.relativePath, frontmatter.value))
const toolbarNotebook = computed(() => paperNotebook.value || (academicReading.value && supportsHtmlNotebook(frontmatter.value)))
const paperNotesOpen = ref(false)
const articleNotesOpen = ref(false)
const notebookOpen = computed({
  get: () => paperNotebook.value ? paperNotesOpen.value : articleNotesOpen.value,
  set(value: boolean) {
    if (paperNotebook.value) paperNotesOpen.value = value
    else articleNotesOpen.value = value
  },
})
const notebookReady = ref(false)
const paperAuthor=ref(false)
const paperBoxMode = ref(false)
const notebookId = useId()
watch(() => page.value.relativePath, () => {
  notebookReady.value = false
  articleNotesOpen.value = false
  paperBoxMode.value = false
  paperAuthor.value = false
}, { flush: 'sync' })
const sectionClass = computed(() => {
  const section = sectionFor('/' + page.value.relativePath)
  return section ? 'section-' + section.id : ''
})
</script>
<template>
  <Layout :data-visual-style="visualStyle.id" :class="[sectionClass, { 'academic-reading': academicReading, 'pixel-mountain-home': pixelHome, 'paper-notebook-layout': paperNotebook, 'has-notebook-tools': toolbarNotebook }]">
    <template #layout-top>
      <picture v-if="pixelHome" class="pixel-mountain-world" aria-hidden="true">
        <source :media="heroMobileMedia" :srcset="withBase(heroImageFor(visualStyle, isDark, true))" />
        <img :src="withBase(heroImageFor(visualStyle, isDark, false))" alt="" fetchpriority="high" />
      </picture>
      <picture v-else-if="visualStyle.iconSet === 'grace'" class="grace-world" aria-hidden="true">
        <source :media="gracePortraitMedia" :srcset="withBase(heroImageFor(visualStyle, isDark, true))" />
        <img :src="withBase(heroImageFor(visualStyle, isDark, false))" alt="" fetchpriority="high" />
      </picture>
      <GraceReadingPortrait v-if="visualStyle.iconSet === 'grace' && academicReading" :key="page.relativePath" />
      <PixelThemeFilter /><ClientOnly><ReadingProgress v-if="academicReading" /></ClientOnly>
    </template>
    <template #nav-bar-content-before><SearchDialog /></template>
    <template #nav-bar-title-before><img class="logo visual-logo" :src="withBase(visualStyle.assets.logo)" alt="seagull 首页" width="36" height="36" /></template>
    <template #nav-bar-content-after><NavActions /></template>
    <template #home-hero-info><HomeHero /></template>
    <template #doc-top>
      <ReaderNavigation :outline-in-drawer="paperNotebook">
        <template v-if="toolbarNotebook" #actions>
          <button v-if="paperNotebook && paperAuthor" aria-label="框选批注" title="框选批注" :aria-pressed="paperBoxMode" @click="paperBoxMode=!paperBoxMode">
            <ReaderIcon name="box" /><span class="notebook-tool-label">框选</span>
          </button>
          <button aria-label="阅读笔记" title="阅读笔记" :disabled="!notebookReady" :aria-expanded="notebookOpen" :aria-controls="notebookId" @click="notebookOpen=!notebookOpen">
            <ReaderIcon name="notes" /><span class="notebook-tool-label">阅读笔记</span>
          </button>
        </template>
      </ReaderNavigation>
      <ClientOnly>
        <HtmlNotebook v-if="toolbarNotebook" :key="page.relativePath" :id="notebookId" v-model:open="notebookOpen" v-model:box-mode="paperBoxMode"
          :document="'html:'+page.relativePath" :title="page.title" :docked="paperNotebook" @ready="notebookReady=true" @author="paperAuthor=$event" />
      </ClientOnly>
    </template>
    <template #doc-before>
      <ArticleContext v-if="academicReading" />
      <ClientOnly>
        <HtmlNotebook v-if="!toolbarNotebook && supportsHtmlNotebook(frontmatter)" inline-launcher :key="page.relativePath" :document="'html:'+page.relativePath" :title="page.title" />
      </ClientOnly>
      <div v-if="frontmatter.status === 'draft'" class="draft-notice">本文仍在写作中，内容尚未完成。</div>
    </template>
    <template #doc-after><RelatedReading v-if="academicReading" /></template>
    <template #layout-bottom>
      <ClientOnly>
        <ReadingMedia />
        <MathTexCopy v-if="academicReading" :key="page.relativePath" :box-mode="paperBoxMode" />
      </ClientOnly>
    </template>
  </Layout>
</template>
