<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { renderNoteMarkdown } from './note-markdown'
import 'katex/dist/katex.min.css'
const props = defineProps<{ modelValue: string; mode: 'read' | 'edit' | 'preview' }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; mode: [value: 'read' | 'edit' | 'preview'] }>()
const input = ref<HTMLTextAreaElement>()
const formatted = computed(() => renderNoteMarkdown(props.modelValue))
watch(() => props.mode, mode => {
  if (mode === 'edit') nextTick(() => input.value?.focus({ preventScroll: true }))
}, { immediate: true })
function insert(before: string, after = '', placeholder = '文字') {
  const start = input.value?.selectionStart ?? props.modelValue.length
  const end = input.value?.selectionEnd ?? start
  const text = props.modelValue.slice(start,end) || placeholder
  emit('update:modelValue',props.modelValue.slice(0,start)+before+text+after+props.modelValue.slice(end))
  nextTick(() => { input.value?.focus(); input.value?.setSelectionRange(start+before.length,start+before.length+text.length) })
}
</script>
<template>
  <div class="note-editor" :data-mode="mode">
    <template v-if="mode==='edit'">
      <textarea ref="input" aria-label="笔记内容" :value="modelValue" maxlength="100000" spellcheck="false" placeholder="写下你的理解或疑问…" @input="emit('update:modelValue',($event.target as HTMLTextAreaElement).value)" @keydown.esc.stop.prevent="emit('mode','read')" @keydown.ctrl.enter.prevent="emit('mode','read')" @keydown.meta.enter.prevent="emit('mode','read')" />
      <details class="note-format"><summary>Markdown / LaTeX 格式</summary>
        <div class="format-tools">
          <button @click="insert('## ')">标题</button><button @click="insert('**','**')">粗体</button><button @click="insert('- ')">列表</button>
          <button @click="insert('$','$','x^2')">行内公式</button><button @click="insert('\n$$\n','\n$$\n','\\frac{a}{b}')">独立公式</button>
          <button @click="insert('\n```\n','\n```\n','code')">代码块</button>
        </div>
      </details>
    </template>
    <div v-else-if="modelValue.trim()" class="note-rendered" v-html="formatted" />
    <p v-else-if="mode==='preview'" class="note-empty-body">暂无正文</p>
    <div v-if="mode!=='read'" class="editor-actions">
      <button v-if="mode==='edit'" @click="emit('mode','preview')">预览</button>
      <button v-else @click="emit('mode','edit')">继续编辑</button>
      <button class="note-done" @click="emit('mode','read')">完成</button>
    </div>
  </div>
</template>
<style>
.note-editor textarea { display:block; resize:vertical; width:100%; min-height:132px; padding:10px; border:1px solid var(--nw-line); border-radius:5px; background:var(--nw-bg); color:var(--nw-text); font:14px/1.75 var(--vp-font-family-base,sans-serif); }
.note-format { margin:6px 0; font-size:12px; color:var(--nw-muted); }
.note-format summary { cursor:pointer; width:fit-content; }
.format-tools,.editor-actions { display:flex; gap:4px; flex-wrap:wrap; }
.editor-actions { justify-content:flex-end; margin-top:6px; }
.notebook-panel .note-done { background:var(--nw-accent); color:var(--nw-on-accent); padding-inline:12px; }
.note-rendered { font-size:14px; line-height:1.8; overflow-wrap:anywhere; color:var(--nw-text); user-select:text; }
.note-rendered :is(h1,h2,h3,h4) { font-weight:650; line-height:1.45; margin:14px 0 6px; padding:0; border:0; letter-spacing:normal; }
.note-rendered h1 { font-size:1.32em; }.note-rendered h2 { font-size:1.18em; }.note-rendered h3 { font-size:1.05em; }
.note-rendered p { margin:6px 0; font:inherit; color:inherit; }
.note-rendered ul,.note-rendered ol { padding-left:1.5em; margin:6px 0; }.note-rendered ul { list-style:disc; }.note-rendered ol { list-style:decimal; }
.note-rendered a { color:var(--nw-accent); text-decoration:underline; }.note-rendered code { font-family:var(--vp-font-family-mono,monospace); font-size:.9em; background:var(--nw-soft); padding:2px 4px; border-radius:3px; }
.note-rendered pre { overflow:auto; background:var(--nw-soft); padding:10px; border-radius:4px; }.note-rendered pre code { padding:0; background:none; }
.note-rendered table { display:block; overflow:auto; border-collapse:collapse; font-size:13px; }.note-rendered :is(th,td) { border:1px solid var(--nw-line); padding:4px 8px; }
.note-rendered blockquote { margin:8px 0; padding-left:10px; border-left:2px solid var(--nw-line); }
.note-rendered .katex-display { overflow-x:auto; overflow-y:hidden; padding:5px 0; margin:8px 0; }.note-rendered .katex { font-size:1.08em; }
.note-rendered .note-math-error { white-space:pre-wrap; }.note-empty-body { color:var(--nw-muted); }
</style>
