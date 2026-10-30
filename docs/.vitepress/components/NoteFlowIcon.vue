<script setup lang="ts">
// Small, static, server-rendered diagrams. Articles choose by meaning, never position.
import { flowGlyphs, type FlowGlyph } from './flow-glyphs'

const props = defineProps<{ kind: FlowGlyph }>()
const glyphs: Record<FlowGlyph, { d: string; soft?: boolean }[]> = flowGlyphs
</script>

<template>
  <svg class="note-flow-icon" viewBox="0 0 150 64" aria-hidden="true" focusable="false">
    <path v-for="(part, index) in glyphs[props.kind]" :key="index" :d="part.d" :class="{ 'note-flow-icon-soft': part.soft }" />
  </svg>
</template>
