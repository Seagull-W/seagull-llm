<script setup lang="ts">
// An original 5 × 7 letter grid, used only for the brand, never for reading text.
const letters: Record<string, string[]> = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
}
const cells = [...'SEAGULL'].flatMap((letter, index) => letters[letter].flatMap((row, y) =>
  [...row].flatMap((bit, x) => bit === '1' ? [{ x: index * 6 + x, y }] : []),
))
</script>

<template>
  <svg class="pixel-wordmark" viewBox="0 0 41 7" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <rect v-for="cell in cells" :key="`${cell.x}-${cell.y}`" :x="cell.x" :y="cell.y" width="1" height="1" />
  </svg>
</template>
