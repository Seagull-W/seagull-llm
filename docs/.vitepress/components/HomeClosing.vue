<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { useVisualStyle } from '../theme/visual-styles'
const style = useVisualStyle()
const { isDark } = useData()
</script>
<template>
  <footer class="home-colophon" :data-index="style.iconSet" aria-label="首页结尾">
    <div v-if="style.iconSet === 'grace'" class="grace-colophon" aria-hidden="true"><img :src="withBase(style.assets.closing)" width="32" height="40" alt="" loading="lazy" /></div>
    <div v-else class="home-closing-art" aria-hidden="true"><img :src="withBase(isDark && style.assets.closingDark ? style.assets.closingDark : style.assets.closing)" alt="" width="1440" height="480" loading="lazy" decoding="async" /></div>
    <div class="closing-line"><span>{{ style.closingTitle }}<i v-if="style.iconSet === 'cinema'" lang="it">Fine</i></span><a href="#VPContent">返回页首 ↑</a></div>
  </footer>
</template>
<style scoped>
.grace-colophon { display:flex; align-items:center; justify-content:center; gap:16px; padding:34px 0 12px; }
.grace-colophon::before,.grace-colophon::after { content:''; width:clamp(36px,13vw,135px); height:1px; background:var(--grace-etch); opacity:.65; }
.home-closing-art { max-width:1120px; height:150px; margin:12px auto 0; overflow:hidden; mask-image:radial-gradient(ellipse at center,#000 15%,transparent 72%); }
.home-closing-art img { display:block; width:100%; height:100%; object-fit:cover; object-position:center bottom; }
.dark .home-closing-art { opacity:.5; mix-blend-mode:screen; }
.dark .home-closing-art img { filter:invert(1); }
@media(max-width:639px) { .home-closing-art { height:90px; } }
.home-colophon { max-width:1120px; margin:20px auto 0; }
.closing-line { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:11px 0; border-top:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); font-size:12px; }
.closing-line a { padding:6px 0; color:var(--vp-c-brand-1); text-decoration:none; }
.closing-line a:is(:focus-visible,:hover) { text-decoration:underline; }
.closing-line i { margin-left:8px; font:italic 15px Georgia,serif; }
.home-colophon[data-index='paper'] .closing-line { font-family:'Seagull Academic Serif',SimSun,serif; letter-spacing:.04em; }
.home-colophon[data-index='pixel'] .closing-line { border:0; font-family:var(--vp-font-family-mono); }
.home-colophon[data-index='grace'] .closing-line { color:var(--vp-c-brand-1); font-family:var(--grace-serif); border:0; }
</style>
