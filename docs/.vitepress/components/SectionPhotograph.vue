<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { useVisualStyle } from '../theme/visual-styles'
const props = defineProps<{ section: string }>()
const style = useVisualStyle()
const { isDark } = useData()
const photo = computed(() => style.value.sectionPhotos?.[props.section] || style.value.sectionPhotos?.tags)
</script>
<template>
  <span v-if="photo" class="section-photograph" aria-hidden="true"><img :src="withBase(isDark && photo.night ? photo.night : photo.src)" alt="" width="480" height="272" loading="lazy" decoding="async" /></span>
</template>
<style scoped>
.section-photograph { display:block; flex:none; width:148px; aspect-ratio:16 / 10; overflow:hidden; background:var(--vp-c-bg-soft); }
.section-photograph img { display:block; width:100%; height:100%; object-fit:cover; object-position:center; }
</style>
