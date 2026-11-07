<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { defaultVisualStyle, heroImageFor, heroMobileMedia, useVisualStyle, visualStyles } from '../theme/visual-styles'
import PixelWordmark from './PixelWordmark.vue'
import FilmHero from './FilmHero.vue'
import GraceHero from './GraceHero.vue'

const { isDark, frontmatter } = useData()
const style = useVisualStyle()
const frame = ref<HTMLElement>()
const mounted = ref(false)
const edition = computed(() => style.value.id + (isDark.value ? '-night' : '-day'))
const shownEdition = ref('')
const loadImage = computed(() => shownEdition.value === edition.value)
const preloadMargin = 192
let observer: IntersectionObserver | undefined

// Keep the current image when scrolling away. A new edition gets its full
// image only when the reader is near the hero again.
function requestIfNear() {
  if (!frame.value) return
  const box = frame.value.getBoundingClientRect()
  if (!('IntersectionObserver' in window) || (box.bottom >= -preloadMargin && box.top <= innerHeight + preloadMargin)) {
    shownEdition.value = edition.value
  }
}
watch(edition, requestIfNear)
onMounted(() => {
  mounted.value = true
  requestIfNear()
  if (frame.value && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) shownEdition.value = edition.value
    }, { rootMargin: `${preloadMargin}px 0px` })
    observer.observe(frame.value)
  }
})
onUnmounted(() => observer?.disconnect())

// Static HTML has no access to preferences. CSS can show the paper artwork
// before hydration (also with JS off) without fetching it for returning readers.
const paper = visualStyles[defaultVisualStyle].assets
const paperSources = {
  '--paper-day': `url("${withBase(paper.heroLight)}")`,
  '--paper-night': `url("${withBase(paper.heroDark)}")`,
  '--paper-mobile': `url("${withBase(paper.mobile)}")`,
}
</script>

<template>
  <div ref="frame">
    <FilmHero v-if="style.iconSet === 'cinema'" :load-image="loadImage" />
    <GraceHero v-else-if="style.iconSet === 'grace'" :load-image="loadImage" />
    <div v-else class="home-illustrated-hero">
      <picture v-if="loadImage" class="hero-art" aria-hidden="true">
        <source :media="heroMobileMedia" :srcset="withBase(heroImageFor(style, isDark, true))" />
        <img :src="withBase(heroImageFor(style, isDark, false))" alt="" width="1672" height="941" fetchpriority="high" />
      </picture>
      <span v-else-if="!mounted" class="hero-art paper-first-paint" :style="paperSources" aria-hidden="true"></span>
      <div class="hero-copy">
        <h1 class="seagull-hero-heading"><span class="seagull-hero-wordmark" aria-label="SEAGULL"><PixelWordmark v-if="style.iconSet === 'pixel'" /><span v-else aria-hidden="true">S<span class="wordmark-e">E</span><span class="wordmark-a">A</span>GULL</span></span><span class="seagull-hero-title">{{ frontmatter.hero.text }}</span></h1>
        <p class="seagull-hero-tagline">{{ frontmatter.hero.tagline }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-illustrated-hero { position:relative; isolation:isolate; display:flex; align-items:center; min-height:380px; overflow:hidden; border-radius:8px; }
.hero-art { position:absolute; inset:0; z-index:-1; pointer-events:none; }
.hero-art img { display:block; width:100%; height:100%; object-fit:cover; object-position:center 20%; }
.paper-first-paint { --paper-poster:var(--paper-day); background-position:center 20%; background-size:cover; background-repeat:no-repeat; }
html.dark .paper-first-paint { --paper-poster:var(--paper-night); }
html:not([data-visual-style]) .paper-first-paint,
html[data-visual-style='paper-coast'] .paper-first-paint { background-image:var(--paper-poster); }
.hero-copy { width:57%; padding:48px 0 56px 40px; }
.seagull-hero-title { max-width:15em; text-wrap:balance; }
@media(min-width:640px) and (max-width:959px) {
  .home-illustrated-hero { min-height:320px; }
  .hero-copy { width:54%; padding-left:28px; }
  .seagull-hero-wordmark { font-size:64px; }
  .seagull-hero-title { font-size:23px; }
}
@media(max-width:639px) {
  .home-illustrated-hero { min-height:230px; overflow:visible; border-radius:0; }
  .hero-copy { width:100%; padding:22px 0 30px; }
  .hero-art { inset:0 -10px auto auto; width:130px; height:130px; }
  .hero-art img { object-fit:contain; }
  .paper-first-paint, html.dark .paper-first-paint { --paper-poster:var(--paper-mobile); background-position:center; background-size:contain; }
  .seagull-hero-heading { gap:24px; }
  .seagull-hero-wordmark { font-size:clamp(36px,10vw,56px); }
  .seagull-hero-title { max-width:none; font-size:clamp(18px,4.7vw,20px); }
  .seagull-hero-tagline { max-width:23em; font-size:11px; }
}
</style>
