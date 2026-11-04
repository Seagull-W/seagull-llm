<script setup lang="ts">
import { computed } from 'vue'
import { useVisualStyle } from '../theme/visual-styles'
import { sectionArtwork } from './section-artwork'
import SectionPhotograph from './SectionPhotograph.vue'

const props = defineProps<{ section: string }>()
const style = useVisualStyle()
const isPixel = computed(() => style.value.iconSet === 'pixel')
const layers = computed(() => {
  const study = sectionArtwork[props.section] || sectionArtwork.papers
  return isPixel.value ? study.pixel : study.paper
})
</script>

<template>
  <SectionPhotograph v-if="style.iconSet === 'cinema'" :section="section" />
  <svg v-else class="section-artwork" :class="{ 'is-pixel': isPixel }" :viewBox="isPixel ? '0 0 60 44' : '0 0 120 88'" fill="none" aria-hidden="true" focusable="false">
    <path v-for="(layer, index) in layers" :key="index" :class="layer.tone" :d="layer.d" />
  </svg>
</template>

<style scoped>
.section-artwork {
  display:block; width:108px; height:80px; flex:none;
  --study-paper:var(--illustration-paper); --study-ground:var(--illustration-mist);
  --study-ink:var(--illustration-ink); --study-light:var(--illustration-light);
  --study-shade:var(--illustration-shade); --study-accent:var(--illustration-accent);
}
.section-artwork.is-pixel {
  width:120px; height:88px; shape-rendering:crispEdges;
  --study-paper:color-mix(in srgb,var(--pixel-edge) 72%,#f6f1e7); --study-ground:var(--vp-c-bg-soft);
  --study-ink:#26364a; --study-light:var(--pixel-paper);
  --study-shade:var(--pixel-edge); --study-accent:var(--pixel-signal);
}
.paper { fill:var(--study-paper); }
.ground { fill:var(--study-ground); }
.ink { fill:var(--study-ink); }
.light { fill:var(--study-light); }
.shade { fill:var(--study-shade); }
.accent { fill:var(--study-accent); }
.line { fill:none; stroke:var(--study-ink); stroke-width:1; stroke-linecap:round; stroke-linejoin:round; opacity:.65; }
</style>
