<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { sectionGlyphs, type SectionGlyph } from './section-glyphs'
import { useVisualStyle } from '../theme/visual-styles'
const props = defineProps<{ section: string }>()
const style = useVisualStyle()
const glyph = computed(() => sectionGlyphs[props.section as SectionGlyph] || sectionGlyphs.papers)
const pixelIcon = computed(() => style.value.icons?.[props.section] || style.value.icons?.papers)
</script>
<template>
  <img v-if="pixelIcon" class="section-icon pixel-icon" :src="withBase(pixelIcon)" alt="" aria-hidden="true" width="32" height="32" />
  <svg v-else class="section-icon" :data-icon-set="style.iconSet" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <path :d="glyph.paper" class="paper" />
    <path :d="glyph.ink" class="ink" />
  </svg>
</template>
<style scoped>
.section-icon { display:inline-block; width:32px; height:32px; flex:none; vertical-align:middle; }
.pixel-icon { image-rendering:pixelated; background:#26364a; }
.paper { fill:var(--illustration-paper,#d3e3e6); }
.ink { stroke:var(--illustration-ink,#397580); stroke-width:1.65; stroke-linecap:round; stroke-linejoin:round; }
</style>
