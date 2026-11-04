<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { useVisualStyle } from '../theme/visual-styles'
const style = useVisualStyle()
const { isDark } = useData()
</script>
<template>
  <div class="home-closing-art" aria-hidden="true"><img :src="withBase(isDark && style.assets.closingDark ? style.assets.closingDark : style.assets.closing)" alt="" width="1440" height="480" loading="lazy" decoding="async" /></div>
</template>
<style scoped>
.home-closing-art { max-width:1120px; height:150px; margin:12px auto 0; overflow:hidden; mask-image:radial-gradient(ellipse at center,#000 15%,transparent 72%); }
.home-closing-art img { display:block; width:100%; height:100%; object-fit:cover; object-position:center bottom; }
.dark .home-closing-art { opacity:.5; mix-blend-mode:screen; }
.dark .home-closing-art img { filter:invert(1); }
@media(max-width:639px) { .home-closing-art { height:90px; } }
</style>
