<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { closingImageFor, heroMobileMedia, useVisualStyle } from '../theme/visual-styles'
import FilmClosingScene from './FilmClosingScene.vue'

const PixelClosingScene = defineAsyncComponent(() => import('./PixelClosingScene.vue'))
const GraceClosingScene = defineAsyncComponent(() => import('./GraceClosingScene.vue'))
const style = useVisualStyle()
const { isDark } = useData()
const footer = ref<HTMLElement>()
const sceneActive = ref(false)
let inView = false
let observer: IntersectionObserver | undefined
function syncActivity() { sceneActive.value = inView && !document.hidden }

onMounted(() => {
  if (!footer.value) return
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      syncActivity()
    })
    observer.observe(footer.value)
  } else {
    inView = true
    syncActivity()
  }
  document.addEventListener('visibilitychange', syncActivity)
})
onUnmounted(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', syncActivity)
})
</script>

<template>
  <footer ref="footer" class="home-colophon" :class="{ 'is-scene-active': sceneActive }" :data-index="style.iconSet" aria-label="首页结尾">
    <GraceClosingScene v-if="style.iconSet === 'grace'" />
    <PixelClosingScene v-else-if="style.iconSet === 'pixel'" :active="sceneActive" />
    <FilmClosingScene v-else-if="style.iconSet === 'cinema'" />
    <picture v-else class="paper-closing-scene">
      <source :media="heroMobileMedia" :srcset="withBase(closingImageFor(style, isDark, true))" width="720" height="295" />
      <img :src="withBase(closingImageFor(style, isDark))" width="1440" height="480" loading="lazy" decoding="async" fetchpriority="low" alt="剪纸海鸥掠过翻开的书，层叠的纸浪延伸到远处的灯塔。" />
    </picture>
    <div class="closing-line">
      <span v-if="style.iconSet !== 'pixel'">{{ style.closingTitle }}<i v-if="style.iconSet === 'cinema'" lang="it">Fine</i></span>
      <a href="#VPContent">返回页首 ↑</a>
    </div>
  </footer>
</template>

<style scoped>
.home-colophon { max-width:1120px; margin:20px auto 0; }
.paper-closing-scene, .paper-closing-scene img { display:block; width:100%; height:auto; }
html[data-visual-style]:not([data-visual-style='paper-coast']) .paper-closing-scene { display:none; }
.closing-line { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:11px 0; border-top:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); font-size:12px; }
.closing-line a { margin-inline-start:auto; padding:6px 0; color:var(--vp-c-brand-1); text-decoration:none; }
.closing-line a:is(:focus-visible,:hover) { text-decoration:underline; }
.closing-line i { margin-left:8px; font:italic 15px Georgia,serif; }
.home-colophon[data-index='paper'] .closing-line { font-family:'Seagull Academic Serif',SimSun,serif; letter-spacing:.04em; }
.home-colophon[data-index='pixel'] .closing-line { border:0; font-family:var(--vp-font-family-mono); }
.home-colophon[data-index='grace'] .closing-line { color:var(--vp-c-brand-1); font-family:var(--grace-serif); border:0; }
</style>
