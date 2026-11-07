<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { heroImageFor, heroMobileMedia, useVisualStyle } from '../theme/visual-styles'

defineProps<{ loadImage: boolean }>()
const { frontmatter, isDark } = useData()
const style = useVisualStyle()
</script>

<template>
  <section class="grace-hero" aria-labelledby="grace-home-title">
    <picture class="grace-hero-art" aria-hidden="true">
      <template v-if="loadImage">
        <source :media="heroMobileMedia" :srcset="withBase(heroImageFor(style, isDark, true))" />
        <img :src="withBase(heroImageFor(style, isDark, false))" alt="" width="1680" height="945" fetchpriority="high" />
      </template>
    </picture>
    <div class="grace-hero-title">
      <h1 id="grace-home-title">{{ frontmatter.hero.name }}</h1>
      <svg class="grace-hero-rule" width="192" height="10" viewBox="0 0 192 10" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M0 6.7 11 4l10.4.9L190 5.5 21 6.4 10 7Z" />
        <path d="M5.5 5.8 13.2.8 12.1 3.7 8.8 6.2l-2.3 2.6Z" />
      </svg>
      <p>{{ frontmatter.hero.text }}</p>
      <p v-if="frontmatter.hero.tagline" class="grace-motto" lang="en">{{ frontmatter.hero.tagline }}</p>
    </div>
  </section>
</template>

<style scoped>
.grace-hero {
  position:relative;
  width:100%;
  min-width:0;
  isolation:isolate;
  display:flex;
  align-items:center;
  aspect-ratio:3.2;
  min-height:255px;
  overflow:hidden;
  background:#28291e;
  color:#fff2cc;
}
.grace-hero-art, .grace-hero::after { position:absolute; inset:0; pointer-events:none; }
.grace-hero-art {
  z-index:-2;
  background:url('../theme/hero-previews/grace-day.webp?inline') center 40% / cover no-repeat;
}
.dark .grace-hero-art { background-image:url('../theme/hero-previews/grace-night.webp?inline'); }
.grace-hero-art img {
  display:block; width:100%; height:100%;
  object-fit:cover; object-position:center 40%;
}
.grace-hero::after {
  content:"";
  z-index:-1;
  background:linear-gradient(90deg, rgb(10 13 11 / .65), rgb(14 15 12 / .37) 28%, transparent 59%),
    linear-gradient(0deg, rgb(11 13 10 / .25), transparent 20%);
}
.grace-hero-title {
  padding:clamp(28px,4.2vw,58px);
  text-align:left;
  text-shadow:0 1px 5px #11150f;
}
.grace-hero-title h1 {
  margin:0;
  color:inherit;
  font:400 clamp(54px,5.6vw,73px)/.96 Baskerville, 'Times New Roman', serif;
  letter-spacing:-.035em;
  text-transform:capitalize;
}
.grace-hero-rule {
  display:block;
  max-width:55%;
  margin:15px 0 8px;
  color:#cfb982;
}
.grace-hero-title p {
  margin:0;
  color:#f6edda;
  font:400 clamp(16px,1.55vw,19px)/1.65 'Seagull Academic Serif','Noto Serif SC',SimSun,serif;
  letter-spacing:.065em;
  text-wrap:balance;
}
.grace-hero-title .grace-motto { margin-top:5px; color:#e7dfc9; font:italic 13px/1.5 Georgia,serif; letter-spacing:.012em; }
@media(max-width:639px) {
  .grace-hero { display:block; min-height:0; aspect-ratio:auto; background:#20221c; }
  .grace-hero::after { content:none; }
  .grace-hero-art { position:relative; z-index:0; display:block; aspect-ratio:16 / 9; background-position:center; }
  .grace-hero-art img { object-position:center; }
  .grace-hero-title { width:100%; padding:18px clamp(16px,5vw,30px) 19px; }
  .grace-hero-title h1 { font-size:clamp(40px,8vw,51px); }
  .grace-hero-rule { margin:5px 0 4px; max-width:40%; }
  .grace-hero-title p { font-size:clamp(14px,3.8vw,17px); letter-spacing:.025em; }
}
</style>
