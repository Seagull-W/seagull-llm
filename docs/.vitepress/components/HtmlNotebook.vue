<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AnnotationNotebook from './AnnotationNotebook.vue'
import ReaderIcon from './ReaderIcon.vue'
defineProps<{ document: string; title: string; docked?: boolean; id?: string }>()
const emit=defineEmits<{author:[value:boolean]}>()
const target = ref<HTMLElement>()
const wide = ref(false)
let desktop: MediaQueryList
function updateDock() { wide.value = desktop.matches }
const open = defineModel<boolean>('open', { default: false })
const boxMode = defineModel<boolean>('boxMode', { default: false })
onMounted(() => {
  desktop = matchMedia('(min-width:1100px)')
  updateDock()
  desktop.addEventListener('change', updateDock)
  target.value = document.querySelector<HTMLElement>('.vp-doc .native-document') || document.querySelector<HTMLElement>('.vp-doc') || undefined
})
onBeforeUnmount(() => desktop?.removeEventListener('change', updateDock))
</script>
<template>
  <button v-if="target && !docked" class="html-notebook-launch" :aria-expanded="open" @click="open=!open"><ReaderIcon name="notes" />阅读笔记</button>
  <Teleport to="body" :disabled="docked && wide">
    <AnnotationNotebook v-if="target" :id="id" v-model:open="open" :target="target" :document="document" :title="title" :docked="docked" :wide-dock="docked && wide"
      @author="emit('author',$event)" :box-active="boxMode" @box-mode="boxMode=$event" kind="html" />
  </Teleport>
</template>
