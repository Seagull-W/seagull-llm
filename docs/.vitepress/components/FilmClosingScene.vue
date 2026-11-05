<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { closingImageFor, heroMobileMedia, useVisualStyle } from '../theme/visual-styles'

const { isDark } = useData()
const style = useVisualStyle()
</script>

<template>
  <picture class="film-closing-scene" :class="{ 'film-closing-night': isDark }">
    <source
      :media="heroMobileMedia"
      :srcset="withBase(closingImageFor(style, isDark, true))"
    />
    <img
      :src="withBase(closingImageFor(style, isDark))"
      :alt="isDark ? '一个人背对镜头站在窗前，望着夜空里的烟花。' : '一辆车沿着乡间公路驶向远处的山丘。'"
      width="1680" height="959" loading="lazy" decoding="async"
    />
  </picture>
</template>

<style scoped>
.film-closing-scene {
  display:block;
  height:220px;
  margin:36px 0 0;
  overflow:hidden;
}
.film-closing-scene img {
  display:block;
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center 65%;
}
/* Keep both the fireworks and the figure's head in the panoramic crop. */
.film-closing-night { height:clamp(220px,24vw,292px); }
.film-closing-night img { object-position:center 18%; }
@media(max-width:639px) {
  .film-closing-scene { height:140px; margin-top:24px; }
  .film-closing-night { height:clamp(140px,43vw,210px); }
}
</style>
