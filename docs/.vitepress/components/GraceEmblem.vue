<script setup lang="ts">
import { computed } from 'vue'
import { graceEtchings } from './grace-etchings'

const props = defineProps<{ section: string }>()
const etching = computed(() => graceEtchings[props.section] || graceEtchings.papers)
</script>

<template>
  <svg class="grace-emblem" viewBox="0 0 96 80" width="78" height="65" aria-hidden="true" focusable="false">
    <path :d="etching.outline" class="etch-outline" fill-rule="evenodd" />
    <path :d="etching.shade" class="etch-shade" />
    <path :d="etching.engraved" class="etch-cut" />
  </svg>
</template>

<style scoped>
.grace-emblem { display:block; flex:none; color:var(--grace-emblem-ink,var(--vp-c-brand-1)); }
.etch-outline, .etch-cut { stroke:currentColor; stroke-linecap:round; stroke-linejoin:round; }
.etch-outline { fill:currentColor; fill-opacity:.17; stroke-width:1.65; }
.etch-shade { fill:currentColor; opacity:.65; }
.etch-cut { fill:none; stroke-width:1; opacity:.88; }
</style>
