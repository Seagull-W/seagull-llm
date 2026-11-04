<script setup lang="ts">
import { computed } from 'vue'
import { useVisualStyle } from '../theme/visual-styles'
import type { Heading } from './ContentsList.vue'
import SectionPhotograph from './SectionPhotograph.vue'
import GraceEmblem from './GraceEmblem.vue'

const props = defineProps<{ stops: Heading[]; index: number; section: string }>()
defineEmits<{ jump: [id: string] }>()
const style = useVisualStyle()
const current = computed(() => props.stops[props.index])
const previous = computed(() => props.stops[props.index - 1])
const next = computed(() => props.stops[props.index + 1])
</script>

<template>
  <div v-if="current" class="reader-position" role="group" aria-label="章节定位">
    <SectionPhotograph v-if="style.iconSet === 'cinema'" class="position-still" :section="section" />
    <div class="position-body">
      <div class="position-counter">
        <span>正在阅读</span>
        <span><span class="sr-only">第 {{ index + 1 }} 节，共 {{ stops.length }} 节</span><span aria-hidden="true">{{ index + 1 }} <i>/</i> {{ stops.length }}</span></span>
      </div>
      <div class="position-title">
        <GraceEmblem v-if="style.iconSet === 'grace'" :section="section" />
        <strong>{{ current.text }}</strong>
      </div>
      <span class="position-track" aria-hidden="true"><span :style="{ width: (index + 1) / stops.length * 100 + '%' }"></span></span>
      <div class="section-turns">
        <button type="button" :disabled="!previous" :title="previous?.text" @click="previous && $emit('jump', previous.id)"><span aria-hidden="true">←</span> 上一节</button>
        <button type="button" :disabled="!next" :title="next?.text" @click="next && $emit('jump', next.id)">下一节 <span aria-hidden="true">→</span></button>
      </div>
    </div>
  </div>
</template>
