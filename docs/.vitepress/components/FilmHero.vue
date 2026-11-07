<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { heroImageFor, heroMobileMedia, useVisualStyle } from '../theme/visual-styles'
defineProps<{ loadImage: boolean }>()
const { isDark, frontmatter } = useData()
const style = useVisualStyle()
</script>

<template>
  <section class="film-hero" :aria-label="style.name">
    <div class="film-heading">
      <h1><span class="film-wordmark">Seagull</span><span class="film-title">{{ frontmatter.hero.text }}</span></h1>
      <p lang="en">{{ frontmatter.hero.tagline }}</p>
    </div>
    <figure class="film-frame">
      <picture>
        <template v-if="loadImage">
          <source :media="heroMobileMedia" :srcset="withBase(heroImageFor(style, isDark, true))" />
          <img :src="withBase(heroImageFor(style, isDark, false))" :alt="isDark ? '窗前的背影，窗外绽放着烟花。' : '午后的列车里，一个人靠着窗边的木座椅休憩。'" width="2560" height="1446" fetchpriority="high" />
        </template>
      </picture>
      <figcaption><span>{{ isDark ? '窗前夜色' : '列车午后' }}</span><span>《灿烂人生》<i lang="it">La meglio gioventù</i></span></figcaption>
    </figure>
  </section>
</template>

<style scoped>
.film-hero { width:100%; }
.film-heading { padding:0 16px 24px; text-align:center; }
.film-heading h1 { display:flex; flex-direction:column; align-items:center; gap:12px; margin:0; }
.film-wordmark { font:italic 400 38px/1.15 'Times New Roman',Georgia,serif; letter-spacing:-.025em; color:var(--vp-c-text-1); }
.film-title { font:400 clamp(17px,1.65vw,21px)/1.6 'Seagull Academic Serif','Noto Serif SC',SimSun,serif; letter-spacing:.035em; text-wrap:balance; }
.film-heading p { margin:7px 0 0; font:italic 400 13px/1.6 'Times New Roman',Georgia,serif; letter-spacing:.015em; color:var(--vp-c-text-2); }
.film-frame { margin:0; }
.film-frame picture {
  display:block;
  aspect-ratio:2560 / 1446;
  overflow:hidden;
  background:#171b17 url('../theme/hero-previews/film-day.webp?inline') center / contain no-repeat;
}
.dark .film-frame picture { background-image:url('../theme/hero-previews/film-night.webp?inline'); }
.film-frame img { display:block; width:100%; height:100%; object-fit:contain; }
.film-frame figcaption { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 18px; padding:12px 0 0; color:var(--vp-c-text-2); font:11px/1.6 var(--vp-font-family-base); }
.film-frame i { margin-left:12px; font:italic 13px/1.6 Georgia,serif; }
@media(max-width:639px) {
  .film-heading { padding:0 0 20px; }
  .film-heading h1 { gap:10px; }
  .film-wordmark { font-size:32px; }
  .film-title { font-size:clamp(15px,4.2vw,18px); letter-spacing:0; }
  .film-heading p { font-size:11px; margin-top:6px; }
  .film-frame figcaption { font-size:10px; padding-top:10px; }
  .film-frame i { font-size:11px; margin-left:6px; }
}
</style>
