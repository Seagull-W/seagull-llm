<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import ReaderIcon from './ReaderIcon.vue'
import { renderNoteMarkdown } from './note-markdown'
import 'katex/dist/katex.min.css'
const props = defineProps<{ modelValue: string; mode: 'read' | 'edit'; kind?: 'annotation' | 'paper' }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; mode: [value: 'read'] }>()
const id = useId()
const limit = 100_000
const input = ref<HTMLTextAreaElement>()
const showPreview = ref(true)
const showFormats = ref(false)
const previewing = computed(() => props.mode === 'edit' && showPreview.value)
const previewText = ref(props.modelValue)
const formatted = computed(() => renderNoteMarkdown(previewing.value ? previewText.value : props.modelValue))
const body = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})
let selection: [number, number] = [0, 0]

watch([() => props.modelValue, previewing], ([text, visible], [, wasVisible], onCleanup) => {
  if (!visible) return
  if (!wasVisible) {
    previewText.value = text
    return
  }
  // Render after a brief typing pause. Draft updates still reach the notebook immediately.
  const timer = setTimeout(() => { previewText.value = text }, 120)
  onCleanup(() => clearTimeout(timer))
})

watch(() => props.mode, mode => {
  if (mode === 'edit') {
    nextTick(() => {
      input.value?.focus({ preventScroll: true })
      input.value?.setSelectionRange(...selection)
    })
  } else if (input.value) {
    selection = [input.value.selectionStart, input.value.selectionEnd]
    showFormats.value = false
  }
}, { immediate: true })

function togglePreview(event: MouseEvent) {
  showPreview.value = !showPreview.value
  if (event.detail) input.value?.focus({ preventScroll: true })
}

function shortcut(event: KeyboardEvent) {
  if (event.key !== 'Escape' && !(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) return
  event.stopPropagation()
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  emit('mode', 'read')
}

function insert(before: string, after = '', placeholder = '文字') {
  const field = input.value
  if (!field) return
  const { selectionStart: start, selectionEnd: end, value } = field
  const text = value.slice(start, end) || placeholder
  const replacement = before + text + after
  field.focus({ preventScroll: true })
  if (value.length - (end - start) + replacement.length > limit) {
    field.setCustomValidity('笔记已达到字数上限，请缩短正文后再插入格式。')
    field.reportValidity()
    field.setCustomValidity('')
    return
  }
  field.setRangeText(replacement, start, end)
  field.setSelectionRange(start + before.length, start + before.length + text.length)
  body.value = field.value
}
</script>
<template>
  <div class="note-editor" :data-mode="mode">
    <template v-if="mode === 'edit'">
      <div class="note-writing-head">
        <label :for="id + '-body'">{{ kind === 'paper' ? '整篇笔记' : '我的批注' }}</label>
        <button type="button" class="note-preview-toggle" role="switch" :aria-checked="showPreview" :aria-controls="id + '-proof'" @click="togglePreview">
          <span class="note-switch-track" aria-hidden="true"></span>实时预览
        </button>
      </div>
      <textarea :id="id + '-body'" ref="input" v-model="body" rows="3" :maxlength="limit" spellcheck="false" placeholder="写下你的理解或疑问…" @keydown="shortcut" />
      <section v-show="showPreview" :id="id + '-proof'" class="note-proof" aria-label="排版预览">
        <div class="note-proof-label" aria-hidden="true">排版预览</div>
        <div v-if="showPreview && modelValue.trim()" class="note-rendered" v-html="formatted" />
        <p v-else class="note-empty-body">输入后在这里预览文字和公式。</p>
      </section>
      <div class="editor-actions">
        <button type="button" class="note-formula" title="插入行内公式" @click="insert('$', '$', 'x')"><span aria-hidden="true">ƒ<sub>x</sub></span>插入公式</button>
        <button type="button" class="note-format" aria-label="更多格式" title="更多格式" :aria-expanded="showFormats" :aria-controls="id + '-formats'" @click="showFormats = !showFormats"><ReaderIcon name="more" /></button>
        <button type="button" class="note-done" title="完成（Ctrl / ⌘ + Enter）" @click="emit('mode', 'read')"><ReaderIcon name="check" />{{ kind === 'paper' ? '完成笔记' : '完成批注' }}</button>
      </div>
      <div v-show="showFormats" :id="id + '-formats'" class="format-tools" role="group" aria-label="Markdown 与 LaTeX 格式">
        <button type="button" @click="insert('## ')">标题</button>
        <button type="button" @click="insert('**', '**')">粗体</button>
        <button type="button" @click="insert('- ')">列表</button>
        <button type="button" @click="insert('\n$$\n', '\n$$\n', '\\frac{a}{b}')">独立公式</button>
        <button type="button" @click="insert('\n```\n', '\n```\n', 'code')">代码块</button>
      </div>
    </template>
    <div v-else-if="modelValue.trim()" class="note-rendered" v-html="formatted" />
  </div>
</template>
<style>
.note-editor { min-width:0; }
.note-editor[data-mode="edit"] { margin-top:12px; padding-top:8px; border-top:1px solid var(--nw-line); }
.note-writing-head,.editor-actions,.format-tools { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; }
.note-writing-head { justify-content:space-between; }
.note-writing-head label,.note-proof-label { font:600 12px/1.5 var(--vp-font-family-base,sans-serif); color:var(--nw-muted); }
.note-editor .note-preview-toggle { gap:7px; padding-inline:3px; color:var(--nw-muted); font-size:12px; }
.note-switch-track { display:flex; align-items:center; width:26px; height:15px; border-radius:12px; padding:3px; background:var(--nw-muted); }
.note-switch-track::after { content:""; width:9px; height:9px; border-radius:50%; background:var(--nw-paper,var(--nw-bg)); transition:transform .15s ease; }
.note-preview-toggle[aria-checked="true"] .note-switch-track { background:var(--nw-accent); }
.note-preview-toggle[aria-checked="true"] .note-switch-track::after { transform:translateX(11px); background:var(--nw-on-accent); }
.note-editor textarea {
  display:block; width:100%; min-height:5.5em; max-height:16em; resize:vertical; field-sizing:content;
  margin:4px 0 0; padding:5px 2px 8px; border:0; border-radius:0; background:transparent; color:var(--nw-text);
  caret-color:var(--nw-accent); font:16px/1.7 var(--vp-font-family-base,sans-serif);
}
.note-editor textarea::placeholder { color:var(--nw-muted); }
.note-editor textarea:focus { outline:0; box-shadow:inset 0 -2px var(--nw-accent); }
.note-proof { margin:12px 0 0; }
.note-proof-label { display:flex; align-items:center; gap:9px; }
.note-proof-label::after { content:""; flex:1; height:1px; background:var(--nw-line); }
.editor-actions { margin-top:10px; }
.note-editor .editor-actions button,.note-editor .format-tools button { min-height:34px; font-size:12px; }
.note-editor .note-formula { padding-left:0; color:var(--nw-accent); }
.note-formula span { font:italic 21px/1 Georgia,serif; }
.note-formula sub { font-size:12px; bottom:-.12em; }
.note-editor .note-format[aria-expanded="true"] { color:var(--nw-accent); background:var(--nw-tint); }
.note-editor .note-done { margin-left:auto; padding-inline:13px; border-radius:100px; background:var(--nw-accent); color:var(--nw-on-accent); font-weight:600; }
.note-editor .note-done:hover { background:color-mix(in srgb,var(--nw-accent) 90%,var(--nw-text)); color:var(--nw-on-accent); }
.note-editor .note-done:focus-visible { outline-color:var(--nw-on-accent); outline-offset:-4px; }
.format-tools { margin-top:6px; padding-top:5px; border-top:1px solid var(--nw-line); }
.note-rendered { font:400 15px/1.8 var(--nw-serif,serif); overflow-wrap:anywhere; color:var(--nw-text); user-select:text; }
.note-rendered :is(h1,h2,h3,h4) { font-weight:650; line-height:1.45; margin:14px 0 6px; padding:0; border:0; letter-spacing:normal; }
.note-rendered h1 { font-size:1.32em; }.note-rendered h2 { font-size:1.18em; }.note-rendered h3 { font-size:1.05em; }
.note-rendered p { margin:6px 0; font:inherit; color:inherit; }
.note-rendered ul,.note-rendered ol { padding-left:1.5em; margin:6px 0; }.note-rendered ul { list-style:disc; }.note-rendered ol { list-style:decimal; }
.note-rendered a { color:var(--nw-accent); text-decoration:underline; }.note-rendered code { font-family:var(--vp-font-family-mono,monospace); font-size:.9em; background:var(--nw-soft); padding:2px 4px; border-radius:3px; }
.note-rendered pre { overflow:auto; background:var(--nw-soft); padding:10px; border-radius:4px; }.note-rendered pre code { padding:0; background:none; }
.note-rendered table { display:block; overflow:auto; border-collapse:collapse; font-size:13px; }.note-rendered :is(th,td) { border:1px solid var(--nw-line); padding:4px 8px; }
.note-rendered blockquote { margin:8px 0; padding-left:10px; border-left:2px solid var(--nw-line); }
.note-rendered .katex-display { overflow-x:auto; overflow-y:hidden; padding:5px 0; margin:8px 0; }.note-rendered .katex { font-size:1.08em; }
.note-rendered .note-math-error { white-space:pre-wrap; }
.note-editor .note-empty-body { margin:6px 0; color:var(--nw-muted); font:13px/1.7 var(--vp-font-family-base,sans-serif); }
@media(pointer:coarse) {
  .note-editor .editor-actions button,.note-editor .format-tools button,.note-editor .note-preview-toggle { min-height:44px; }
  .note-editor .note-format { min-width:44px; }
}
@media(prefers-reduced-motion:reduce) { .note-switch-track::after { transition:none; } }
</style>
