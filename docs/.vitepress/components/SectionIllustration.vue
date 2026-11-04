<script setup lang="ts">
import SectionIcon from './SectionIcon.vue'
import SectionArtwork from './SectionArtwork.vue'
import SectionPhotograph from './SectionPhotograph.vue'
import GraceEmblem from './GraceEmblem.vue'
import { sectionArtwork } from './section-artwork'
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { useVisualStyle } from '../theme/visual-styles'
const props = defineProps<{ section: string }>()
const style = useVisualStyle()
const banner = computed(() => style.value.iconSet === 'pixel'
  ? style.value.sectionArt?.[props.section] || style.value.sectionArt?.papers || style.value.assets.mobile
  : undefined)
const hasStudy = computed(() => Object.hasOwn(sectionArtwork, props.section))
</script>
<template>
  <div class="section-illustration" :class="{ 'pixel-section-art': banner, 'film-section-art': style.iconSet === 'cinema' }" aria-hidden="true">
    <SectionPhotograph v-if="style.iconSet === 'cinema'" :section="section" />
    <GraceEmblem v-else-if="style.iconSet === 'grace'" class="grace-section-emblem" :section="section" />
    <picture v-else-if="banner" class="pixel-banner"><source media="(max-width:639px)" :srcset="withBase(style.icons?.[section] || style.assets.mobile)" /><img :src="withBase(banner)" alt="" width="2304" height="768" /></picture>
    <SectionArtwork v-else-if="hasStudy" :section="section" />
    <svg v-else class="paper-landscape" viewBox="0 0 200 130" fill="none">
      <path d="M10 100Q60 56 105 88T195 80L186 125H14Z" fill="var(--illustration-mist)" />
      <path d="M25 104Q79 116 130 73T194 64" stroke="var(--illustration-ink)" stroke-width="1" stroke-dasharray="3 6" opacity=".5" />
      <path d="m143 19 28-7-12 24-23 3Z" fill="var(--illustration-paper)" />
      <circle cx="34" cy="54" r="3" fill="var(--illustration-ink)" opacity=".55" />
    </svg>
    <SectionIcon v-if="style.iconSet !== 'cinema' && style.iconSet !== 'grace' && !banner && !hasStudy" :section="section" />
  </div>
</template>
<style scoped>
.section-illustration { position:absolute; right:0; top:0; width:180px; height:130px; pointer-events:none; }
.paper-landscape { width:100%; height:100%; }
.section-illustration .section-artwork { width:180px; height:130px; }
.grace-section-emblem { display:block; width:100%; height:100%; color:var(--vp-c-brand-1); }
.section-icon { position:absolute; width:76px; height:76px; top:23px; left:54px; transform:rotate(-7deg); }
@media(max-width:639px) {
  .section-illustration { width:54px; height:54px; top:0; }
  .paper-landscape { display:none; }
  .section-illustration .section-artwork { width:54px; height:40px; }
  .section-icon { width:44px; height:44px; top:0; left:5px; transform:none; }
}
</style>
