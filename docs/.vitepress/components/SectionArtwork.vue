<script setup lang="ts">
import { computed } from 'vue'
import { useVisualStyle } from '../theme/visual-styles'
import { paperSectionArtwork, pixelSectionArtwork } from './section-artwork'
import SectionPhotograph from './SectionPhotograph.vue'

const props = defineProps<{ section: string }>()
const style = useVisualStyle()
const isPixel = computed(() => style.value.iconSet === 'pixel')
const layers = computed(() => {
  const studies = isPixel.value ? pixelSectionArtwork : paperSectionArtwork
  return studies[props.section] || studies.papers
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
  --study-paper:#8aaed9; --study-ground:var(--vp-c-bg-soft);
  --study-ink:#243e67; --study-light:var(--pixel-paper);
  --study-shade:#426799; --study-accent:var(--pixel-signal);
}
.dark .section-artwork.is-pixel,
.pixel-mountain-home .section-artwork.is-pixel {
  --study-paper:#a0c4ef; --study-shade:#698ab7;
}
.pixel-mountain-home .section-artwork.is-pixel {
  --study-ground:#243e5b; --study-light:#e4effd; --study-accent:#f2c588;
}
.paper { fill:var(--study-paper); }
.ground { fill:var(--study-ground); }
.ink { fill:var(--study-ink); }
.light { fill:var(--study-light); }
.shade { fill:var(--study-shade); }
.accent { fill:var(--study-accent); }
.line { fill:none; stroke:var(--study-ink); stroke-width:1; stroke-linecap:round; stroke-linejoin:round; opacity:.65; }
</style>
