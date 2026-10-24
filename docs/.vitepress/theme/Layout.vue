<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed, onMounted, onUnmounted } from 'vue'
import ReaderNavigation from '../components/ReaderNavigation.vue'
import { useData, useRoute, withBase } from 'vitepress'
import SeagullLens from '../components/SeagullLens.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import ChapterTag from '../components/ChapterTag.vue'
import NavActions from '../components/NavActions.vue'
import { isPublicContent } from '../public-content'

const { Layout } = DefaultTheme
const route = useRoute()
const { frontmatter, page } = useData()
// Source paths work with base URLs, encoded routes, and client-side navigation.
const sectionClass = computed(() => {
  const section = page.value.relativePath?.split('/')[0]
  return ['research', 'llm-book', 'papers', 'rl-book', 'westlake-rl', 'rust-notes', 'linux-notes', 'videos'].includes(section)
    ? `section-${section}` : ''
})

let navMenu: HTMLElement | null = null

function scrollNav(e: WheelEvent) {
  if (!navMenu || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  const before = navMenu.scrollLeft
  navMenu.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? navMenu.clientWidth : 1)
  if (navMenu.scrollLeft !== before) e.preventDefault()
}
onMounted(() => {
  navMenu = document.querySelector('.VPNavBarMenu')
  navMenu?.addEventListener('wheel', scrollNav, { passive: false })
})

onUnmounted(() => {
  navMenu?.removeEventListener('wheel', scrollNav)
})
</script>

<template>
  <Layout :class="sectionClass">
    <template #layout-top>
      <!-- 阅读进度条 -->
      <ClientOnly>
        <ReadingProgress />
      </ClientOnly>
    </template>
    <template #nav-bar-content-after><NavActions /></template>
    <template #home-hero-image>
      <SeagullLens />
    </template>
    <template #home-hero-info>
      <h1 class="seagull-hero-heading">
        <span class="seagull-hero-wordmark" aria-label="SEAGULL"><span aria-hidden="true">S<span class="wordmark-e">E</span><span class="wordmark-a">A</span>GULL</span></span>
        <span class="seagull-hero-title">{{ frontmatter.hero.text }}</span>
      </h1>
      <p class="seagull-hero-tagline">{{ frontmatter.hero.tagline }}</p>
    </template>
    <template #doc-top><ReaderNavigation /></template>
    <template #doc-before>
      <div v-if="sectionClass === 'section-research' && frontmatter.date" class="research-issue">
        <span>每日调研</span><time :datetime="String(frontmatter.date)">{{ frontmatter.date }}</time>
      </div>
      <ChapterTag v-else-if="!frontmatter.pdf && frontmatter.contentFormat !== 'html'" />
      <div v-if="frontmatter.status === 'draft'" class="draft-notice">
        本文仍在写作中，内容尚未完成。
      </div>
    </template>
    <template #doc-footer-before>
      <nav v-if="frontmatter.tags?.length && isPublicContent(route.path, frontmatter)" class="article-tags" aria-label="文章标签">
        <a v-for="tag in frontmatter.tags" :key="tag" :href="withBase('/tags') + '#' + encodeURIComponent(tag)">{{ tag }}</a>
      </nav>
    </template>
  </Layout>
</template>

<style>
.draft-notice {
  margin: 0 0 24px;
  padding: 12px 16px;
  border: 1px solid var(--vp-custom-block-warning-border);
  border-radius: 10px;
  background: var(--vp-custom-block-warning-bg);
  color: var(--vp-c-text-1);
  line-height: 1.6;
}

.draft-notice a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}

</style>
