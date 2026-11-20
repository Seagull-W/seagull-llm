<script setup lang="ts">
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
  check: 'm4 12 5 5L20 6', plus: 'M12 5v14m-7-7h14',
  comment: 'M4 4h16v12h-9l-5 4v-4H4z M8 8h8m-8 4h5',
} as const
defineProps<{ name: keyof typeof paths }>()
</script>
<template><svg class="reader-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path :d="paths[name]" /></svg></template>
<style scoped>.reader-icon { flex: none; vertical-align: middle; }</style>
