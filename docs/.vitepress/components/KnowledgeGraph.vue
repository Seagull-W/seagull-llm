<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { ContentEntry } from '../content-catalog'
import KnowledgeGraphEmbedded from './KnowledgeGraphEmbedded.vue'

// Only the immersive route downloads and mounts the animation engine.
const KnowledgeAtlas = defineAsyncComponent(() => import('./KnowledgeAtlas.vue'))

withDefaults(defineProps<{
  pages: ContentEntry[]
  fullscreen?: boolean
  showFullscreenButton?: boolean
}>(), {
  fullscreen: false,
  showFullscreenButton: false,
})
const emit = defineEmits<{
  tag: [value: string]
  section: [value: string]
  close: []
  expand: []
}>()
</script>

<template>
  <KnowledgeAtlas v-if="fullscreen" :pages="pages"
    @tag="emit('tag', $event)" @section="emit('section', $event)"
    @close="emit('close')" @expand="emit('expand')" />
  <KnowledgeGraphEmbedded v-else :pages="pages" :show-fullscreen-button="showFullscreenButton"
    @tag="emit('tag', $event)" @section="emit('section', $event)"
    @close="emit('close')" @expand="emit('expand')" />
</template>
