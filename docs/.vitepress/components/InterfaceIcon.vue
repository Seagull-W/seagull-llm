<script setup lang="ts">
import { useVisualStyle } from '../theme/visual-styles'
defineProps<{ name: 'search' | 'sun' | 'moon' | 'chevron' | 'collection' | 'contents' }>()
const style = useVisualStyle()
const pixels = {
  search: 'M4 1h5v1h2v2h1v5h-1v2H9v1H4v-1H2V9H1V4h1V2h2Zm0 2v1H3v5h1v1h5V9h1V4H9V3Zm7 8h2v2h2v2h-2v-2h-2Z',
  sun: 'M7 0h2v3H7ZM7 13h2v3H7ZM0 7h3v2H0ZM13 7h3v2h-3ZM2 2h2v2H2ZM12 2h2v2h-2ZM2 12h2v2H2ZM12 12h2v2h-2ZM6 4h4v1h1v1h1v4h-1v1h-1v1H6v-1H5v-1H4V6h1V5h1Zm0 2v4h4V6Z',
  moon: 'M6 1h4v2H8v5h1v1h1v1h5v2h-1v1h-1v1h-2v1H5v-1H3v-2H2v-2H1V6h1V4h2V2h2Zm0 3H4v2H3v4h1v2h2v1h5v-1h1v-1H9v-1H7V8H6Z',
  chevron: 'M2 5h2v2H2ZM4 7h2v2H4ZM6 9h4v2H6ZM10 7h2v2h-2ZM12 5h2v2h-2Z',
  collection: 'M1 2h4v12H1Zm1 2v1h2V4ZM7 2h3v12H7ZM12 4h2v3h1v7h-2V8h-1Z',
  contents: 'M1 3h2v2H1ZM5 3h10v2H5ZM1 7h2v2H1ZM5 7h10v2H5ZM1 11h2v2H1ZM5 11h7v2H5Z',
}
</script>

<template>
  <svg v-if="style.iconSet === 'pixel'" class="interface-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path :d="pixels[name]" /></svg>
  <svg v-else class="interface-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'search'"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></template>
    <path v-else-if="name === 'moon'" d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />
    <template v-else-if="name === 'sun'"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></template>
    <path v-else-if="name === 'chevron'" d="m6 9 6 6 6-6" />
    <path v-else-if="name === 'collection'" d="M3 3h5v18H3ZM11 3h3v18h-3Zm6 3 3-1 3 15-3 1Z" />
    <path v-else d="M3 5h1m4 0h13M3 12h1m4 0h13M3 19h1m4 0h9" />
  </svg>
</template>

<style scoped>
.interface-icon { flex:none; }
</style>
