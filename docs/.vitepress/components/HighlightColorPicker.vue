<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isHighlightColor } from './annotations'

const props = defineProps<{ color?: string }>()
const emit = defineEmits<{ color: [value: string | undefined]; close: [] }>()
const choices = [
  { label: '主题默认', value: undefined },
  { label: '柠檬黄', value: '#f4cc52' },
  { label: '薄荷绿', value: '#77c99d' },
  { label: '天空蓝', value: '#74b9e8' },
  { label: '玫瑰粉', value: '#ed94ae' },
  { label: '紫藤', value: '#b39add' }
]
const root = ref<HTMLElement>()
const hex = ref(props.color || '')
const custom = computed(() => hex.value.trim())
watch(() => props.color, value => { hex.value = value || '' })
function apply(value: string) {
  if (isHighlightColor(value)) emit('color', value.toLowerCase())
}
function focusChoice() {
  const chosen = root.value?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
  const control = chosen ?? root.value?.querySelector('input')
  control?.focus({ preventScroll: true })
}
defineExpose({ focusChoice })
</script>
<template>
  <div ref="root" class="highlight-color-picker" role="group" aria-label="选择高亮颜色" @keydown.esc.stop.prevent="emit('close')">
    <div class="color-presets">
      <button v-for="choice in choices" :key="choice.label" type="button" :aria-pressed="color?.toLowerCase() === choice.value"
        @click="emit('color', choice.value)">
        <i aria-hidden="true" :style="{ backgroundColor: choice.value }"></i>{{ choice.label }}
      </button>
    </div>
    <div class="color-custom">
      <label>自选色<input type="color" aria-label="自选高亮颜色" :value="color || '#f4cc52'" @pointerdown.stop @mousedown.stop
        @change="apply(($event.target as HTMLInputElement).value)" /></label>
      <label>HEX<input v-model="hex" type="text" aria-label="高亮颜色 HEX" placeholder="#RRGGBB" maxlength="7"
        autocomplete="off" spellcheck="false" :aria-invalid="!!custom && !isHighlightColor(custom)"
        @pointerdown.stop @mousedown.stop @keydown.enter.stop.prevent="apply(custom)" /></label>
      <button type="button" :disabled="!isHighlightColor(custom)" @click="apply(custom)">应用</button>
    </div>
  </div>
</template>
<style scoped>
.highlight-color-picker { display:grid; gap:6px; min-width:0; padding-block:6px; border-block-start:1px solid var(--nw-line); }
.color-presets { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(74px,100%),1fr)); gap:3px; }
.color-presets button,.color-custom button { min-height:30px; padding:3px 5px; font-size:12px; }
.color-presets button { justify-content:flex-start; white-space:nowrap; }
.color-presets button[aria-pressed='true'] { background:var(--nw-soft); outline:1px solid var(--nw-accent); outline-offset:-1px; }
.color-presets i { flex:none; width:12px; height:12px; border:1px solid var(--nw-muted); border-radius:50%; background:var(--nw-accent); }
.color-custom,.color-custom label { display:flex; align-items:center; gap:4px; }
.color-custom { flex-wrap:wrap; gap:4px 8px; }
.color-custom label { color:var(--nw-muted); font-size:12px; }
.color-custom input { box-sizing:border-box; min-height:28px; border:1px solid var(--nw-line); border-radius:4px; color:var(--nw-text); background:var(--nw-bg); }
.color-custom input[type='color'] { width:31px; padding:2px; cursor:pointer; }
.color-custom input[type='text'] { width:9ch; padding:2px 4px; font:12px/1.4 monospace; }
.color-custom button:disabled { opacity:.55; cursor:default; }
</style>
