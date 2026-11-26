<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import AnnotationNotebook from './AnnotationNotebook.vue'
import ReaderIcon from './ReaderIcon.vue'
defineProps<{ document: string; title: string; docked?: boolean }>()
const emit=defineEmits<{ author: [value: boolean] }>()
const launcher = ref<HTMLButtonElement>()
const panelId = useId()
const target = ref<HTMLElement>()
const wide = ref(false)
let desktop: MediaQueryList
function updateDock() { wide.value = desktop.matches }
const open = ref(false)
const boxMode = defineModel<boolean>('boxMode', { default: false })
async function openNotebook() {
  open.value = true
  await nextTick()
  document.getElementById(panelId)?.querySelector<HTMLButtonElement>('.notebook-close')?.focus({ preventScroll: true })
}
async function restoreLauncherFocus() {
  await nextTick()
  launcher.value?.focus({ preventScroll: true })
}
onMounted(() => {
  desktop = matchMedia('(min-width:1100px)')
  updateDock()
  desktop.addEventListener('change', updateDock)
  target.value = document.querySelector<HTMLElement>('.vp-doc .native-document') || document.querySelector<HTMLElement>('.vp-doc') || undefined
})
onBeforeUnmount(() => desktop?.removeEventListener('change', updateDock))
</script>
<template>
  <Teleport to="body">
    <button v-if="target" v-show="!open" ref="launcher" type="button" class="html-notebook-launch"
      aria-label="阅读笔记" title="阅读笔记" :aria-expanded="open" :aria-controls="panelId" @click="openNotebook">
      <ReaderIcon name="notes" /><span>阅读笔记</span>
    </button>
  </Teleport>
  <Teleport to="body" :disabled="docked && wide">
    <AnnotationNotebook v-if="target" :id="panelId" v-model:open="open" :target="target" :document="document" :title="title" :docked="docked" :wide-dock="docked && wide"
      @close="restoreLauncherFocus" @author="emit('author',$event)" :box-active="boxMode" @box-mode="boxMode=$event" kind="html" />
  </Teleport>
</template>
