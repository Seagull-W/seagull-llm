<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { useVisualStyle } from '../theme/visual-styles'
import PixelWordmark from './PixelWordmark.vue'
import FilmHero from './FilmHero.vue'

const { isDark, frontmatter } = useData()
const style = useVisualStyle()
</script>

<template>
  <FilmHero v-if="style.iconSet === 'cinema'" />
  <div v-else class="home-illustrated-hero">
    <picture class="hero-art" aria-hidden="true">
      <source media="(max-width: 639px)" :srcset="withBase(style.assets.mobile)" />
      <img :src="withBase(isDark ? style.assets.heroDark : style.assets.heroLight)" alt="" width="1672" height="941" fetchpriority="high" />
    </picture>
    <div class="hero-copy">
      <h1 class="seagull-hero-heading"><span class="seagull-hero-wordmark" aria-label="SEAGULL"><PixelWordmark v-if="style.iconSet === 'pixel'" /><span v-else aria-hidden="true">S<span class="wordmark-e">E</span><span class="wordmark-a">A</span>GULL</span></span><span class="seagull-hero-title">{{ frontmatter.hero.text }}</span></h1>
      <p class="seagull-hero-tagline">{{ frontmatter.hero.tagline }}</p>
    </div>
  </div>
</template>

<style scoped>
.home-illustrated-hero { position:relative; isolation:isolate; display:flex; align-items:center; min-height:380px; overflow:hidden; border-radius:8px; }
.hero-art { position:absolute; inset:0; z-index:-1; pointer-events:none; }
.hero-art img { display:block; width:100%; height:100%; object-fit:cover; object-position:center 20%; }
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
  .seagull-hero-heading { gap:24px; }
  .seagull-hero-wordmark { font-size:clamp(36px,10vw,56px); }
  .seagull-hero-title { max-width:none; font-size:clamp(18px,4.7vw,20px); }
  .seagull-hero-tagline { max-width:23em; font-size:11px; }
}
</style>
