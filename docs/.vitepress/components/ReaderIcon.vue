<script setup lang="ts">
import { useVisualStyle } from '../theme/visual-styles'

const style = useVisualStyle()
const paths = {
  outline: 'M4 5h2m4 0h10M4 12h2m4 0h10M4 19h2m4 0h10',
  notes: 'M4 4h16v16H4z M14 4v16 M7 8h4m-4 4h4',
  expand: 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',
  box: 'M4 8V4h4m3 0h3m3 0h3v4m0 3v3m0 3v3h-4m-3 0h-3m-3 0H4v-4m0-3v-3',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
  previous: 'm14 6-6 6 6 6', next: 'm10 6 6 6-6 6',
  fit: 'M3 5v14m18-14v14M6 12h12m-9-3-3 3 3 3m6-6 3 3-3 3',
  close: 'm6 6 12 12M18 6 6 18', more: 'M4 12h1m6 0h1m6 0h1',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
  mark: 'm5 15 8-10 6 5-8 10H6l-2-2z M4 21h11',
  edit: 'M4 20h4L20 8l-4-4L4 16z M13 7l4 4',
  copy: 'M9 8h11v13H9z M15 5V3H4v13h2',
  star: 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.5l-5.7 3.1 1.1-6.4-4.6-4.5 6.4-.9z',
  check: 'm4 12 5 5L20 6', plus: 'M12 5v14m-7-7h14', minus: 'M5 12h14',
  comment: 'M4 4h16v12h-9l-5 4v-4H4z M8 8h8m-8 4h5',
} as const
const pixels: Record<keyof typeof paths, string> = {
  outline: 'M1 2h3v3H1z M6 2h9v2H6z M1 7h3v3H1z M6 7h9v2H6z M1 12h3v3H1z M6 12h7v2H6z',
  notes: 'M2 1h12v14H2z M4 3v10h5V3z M11 3v10h1V3z M5 5h3v1H5z M5 8h3v1H5z',
  expand: 'M1 1h5v2H3v3H1z M10 1h5v5h-2V3h-3z M1 10h2v3h3v2H1z M13 10h2v5h-5v-2h3z',
  box: 'M1 1h4v2H3v2H1z M7 1h2v2H7z M11 1h4v4h-2V3h-2z M1 7h2v2H1z M13 7h2v2h-2z M1 11h2v2h2v2H1z M7 13h2v2H7z M13 11h2v4h-4v-2h2z',
  bookmark: 'M3 1h10v14h-2v-2H9v-2H7v2H5v2H3z M5 3v7h2V9h2v1h2V3z',
  previous: 'M9 2h3v2H9z M7 4h3v2H7z M5 6h3v2H5z M3 8h3v1H3z M5 9h3v2H5z M7 11h3v2H7z M9 13h3v2H9z',
  next: 'M4 2h3v2H4z M6 4h3v2H6z M8 6h3v2H8z M10 8h3v1h-3z M8 9h3v2H8z M6 11h3v2H6z M4 13h3v2H4z',
  fit: 'M1 3h2v10H1z M13 3h2v10h-2z M6 5h1v2h2V5h1v1h1v1h1v2h-1v1h-1v1H9V9H7v2H6v-1H5V9H4V7h1V6h1z',
  close: 'M2 2h2v2H2z M12 2h2v2h-2z M4 4h2v2H4z M10 4h2v2h-2z M6 6h4v4H6z M4 10h2v2H4z M10 10h2v2h-2z M2 12h2v2H2z M12 12h2v2h-2z',
  more: 'M1 7h3v3H1z M7 7h3v3H7z M13 7h3v3h-3z',
  download: 'M7 1h2v6h3v2h-2v2H9v1H7v-1H6V9H4V7h3z M1 11h2v2h10v-2h2v4H1z',
  mark: 'M9 1h3v1h1v1h2v3h-2v2h-2v2H9v2H7v1H3V9h1V7h2V5h2V3h1z M10 4v1H9v1h2V5h1V4z M1 14h10v2H1z',
  edit: 'M11 1h2v1h1v1h1v2h-2v2h-2v2H9v2H7v2H5v1H1v-4h1V8h2V6h2V4h2V2h3z M9 4v1h1v1h1V5h-1V4z M3 10v2h2v-1H4v-1z',
  copy: 'M1 1h10v2H3v8H1z M5 5h10v10H5z M7 7v6h6V7z',
  star: 'M7 1h2v2h1v2h1v1h5v2h-2v2h-2v2h1v3h-2v-1H9v-1H7v1H5v1H3v-3h1v-2H2V8H0V6h5V5h1V3h1z',
  check: 'M13 2h2v2h-2z M11 4h3v2h-3z M9 6h3v2H9z M7 8h3v2H7z M1 7h2v2H1z M3 9h2v2H3z M5 10h3v2H5z',
  plus: 'M7 2h2v5h5v2H9v5H7V9H2V7h5z',
  minus: 'M2 7h12v2H2z',
  comment: 'M1 2h14v10H8v1H6v1H4v1H3v-3H1z M3 4v6h2v2h1v-1h1v-1h6V4z M5 6h6v2H5z',
}
defineProps<{ name: keyof typeof paths }>()
</script>
<template>
  <svg v-if="style.iconSet === 'pixel'" class="reader-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path :d="pixels[name]" /></svg>
  <svg v-else class="reader-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name]" /></svg>
</template>
<style scoped>.reader-icon { flex: none; vertical-align: middle; }</style>
