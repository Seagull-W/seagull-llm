<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import ReaderIcon from './ReaderIcon.vue'
import { copyTex, formatTex } from './math-tex-clipboard'

const props = defineProps<{ boxMode: boolean }>()
const selector = '.math-block[data-tex], .math-inline[data-tex]'
const active = shallowRef<HTMLElement | null>(null)
const capsule = ref<HTMLElement>()
const primary = ref<HTMLButtonElement>()
const feedback = ref('')
const position = ref<{ left: string; top: string }>()
let root: HTMLElement | null
let events: AbortController
let hoverTimer = 0, leaveTimer = 0, feedbackTimer = 0, frame = 0
let pointerType = '', blockedPress = false

function formula(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>(selector) : null
}
function blocked() {
  return props.boxMode || window.getSelection()?.isCollapsed === false
}
function dismiss() {
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
  clearTimeout(feedbackTimer)
  active.value = null
  feedback.value = ''
  position.value = undefined
}

function place() {
  const el = active.value, pill = capsule.value
  if (!el || !pill || !root) return
  if (blocked() || !root.contains(el)) return dismiss()
  // The MathJax host is the scrollport. Its SVG can extend well beyond the visible column.
  const rect = el.getBoundingClientRect()
  const view = window.visualViewport
  const left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0
  const right = left + (view?.width ?? document.documentElement.clientWidth)
  const bottom = top + (view?.height ?? window.innerHeight)
  const header = document.querySelector('.VPNav')?.getBoundingClientRect()
  const toolbar = root.closest('.VPDoc')?.querySelector('.reader-navigation')?.getBoundingClientRect()
  const upperEdge = Math.max(top, header?.bottom ?? 0, toolbar?.bottom ?? 0)
  const column = (el.closest('.reader-table, .table-scroll, .note-table, .survey-equation') ?? root).getBoundingClientRect()
  let anchorRight = Math.min(rect.right, column.right, right)
  if (anchorRight <= Math.max(rect.left, column.left, left) || rect.bottom <= upperEdge || rect.top >= bottom) return dismiss()
  const sibling = el.nextElementSibling
  const number = sibling?.matches('[class$="-equation-number"]') ? sibling.getBoundingClientRect() : null
  const gap = 3, width = pill.offsetWidth, height = pill.offsetHeight
  if (bottom - upperEdge < height + gap) return dismiss()
  const above = rect.top - height - gap
  const below = Math.max(rect.bottom, number?.bottom ?? rect.bottom) + gap
  const y = above >= upperEdge ? above : Math.max(upperEdge, Math.min(below, bottom - height - gap))
  if (number && number.top < y + height && number.bottom > y) anchorRight = Math.min(anchorRight, number.left - gap)
  position.value = {
    left: Math.max(left + gap, Math.min(anchorRight - width, right - width - gap)) + 'px',
    top: y + 'px'
  }
}
function schedulePlace() {
  if (active.value && !frame) frame = requestAnimationFrame(() => { frame = 0; place() })
}
function show(el: HTMLElement) {
  if (blocked() || !root?.contains(el) || !el.dataset.tex?.trim()) return
  if (active.value !== el) dismiss()
  clearTimeout(leaveTimer)
  active.value = el
  nextTick(place)
}
function leave() {
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
  // Allow the pointer to cross the small gap from the formula to the floating controls.
  leaveTimer = window.setTimeout(() => {
    if (!hasKeyboardFocus()) dismiss()
  }, 180)
}
function hasKeyboardFocus() {
  return active.value?.matches(':focus-visible') || capsule.value?.querySelector(':focus-visible')
}
function keepOpen() {
  clearTimeout(leaveTimer)
}
function onOver(event: PointerEvent) {
  const el = formula(event.target)
  if (!el || el === formula(event.relatedTarget) || event.pointerType !== 'mouse' || event.buttons || blocked()) return
  if (active.value !== el) {
    if (hasKeyboardFocus()) return
    dismiss()
  }
  if (el.classList.contains('math-block') || el === active.value) show(el)
  else hoverTimer = window.setTimeout(() => show(el), 400)
}
function onOut(event: PointerEvent) {
  const el = formula(event.target)
  if (event.pointerType === 'mouse' && el && el !== formula(event.relatedTarget)) leave()
}
function onDown(event: PointerEvent) {
  // Snapshot before native focus or the annotation handler can collapse the selection.
  pointerType = event.pointerType
  blockedPress = blocked() || event.shiftKey
  if (blockedPress || !capsule.value?.contains(event.target as Node)) dismiss()
}
function onClick(event: MouseEvent) {
  const el = formula(event.target)
  if (!el || event.defaultPrevented || blockedPress || blocked() || event.button !== 0) return
  if (event.ctrlKey || event.metaKey || event.shiftKey || el.closest('a[href], button')) return
  if (el.classList.contains('math-block') || pointerType === 'touch' || pointerType === 'pen') show(el)
  else if (event.altKey && el.classList.contains('math-inline')) {
    event.preventDefault()
    show(el)
    void copy(false)
  }
}
async function copy(delimited: boolean) {
  const el = active.value
  if (!el) return
  const allowed = () => el === active.value && !!root?.contains(el) && !blocked()
  const text = formatTex(el.dataset.tex ?? '', el.classList.contains('math-block'), delimited)
  const ok = await copyTex(text, allowed)
  if (!allowed()) return
  feedback.value = ok ? '已复制 TeX' : '复制失败'
  clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => { feedback.value = ''; nextTick(place) }, 1400)
  nextTick(place)
}
function onFocus(event: FocusEvent) {
  const el = formula(event.target)
  if (el?.matches(':focus-visible')) show(el)
}
function onBlur(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && (active.value?.contains(next) || capsule.value?.contains(next))) return
  dismiss()
}
function onKey(event: KeyboardEvent) {
  if (blocked() || event.defaultPrevented) return
  const el = active.value
  if (!el) return
  const inCapsule = capsule.value?.contains(event.target as Node)
  if (event.key === 'Escape') {
    if (inCapsule) el.focus({ preventScroll: true })
    dismiss()
  } else if (event.key === 'Tab' && event.target === el && !event.shiftKey) {
    event.preventDefault()
    primary.value?.focus({ preventScroll: true })
  } else if (event.key === 'Tab' && inCapsule) {
    // Leave the Teleport at the formula's position in the article's tab order.
    const first = event.target === primary.value
    if ((first && !event.shiftKey) || (!first && event.shiftKey)) return
    if (event.shiftKey) event.preventDefault()
    el.focus({ preventScroll: true })
  }
}
watch(() => props.boxMode, mode => { if (mode) dismiss() }, { flush: 'sync' })
onMounted(() => {
  root = document.querySelector<HTMLElement>('.academic-reading .VPDoc .vp-doc')
  if (!root) return
  // Only attributes are added. All formula events share the article's listeners.
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0
  }
  events = new AbortController()
  const { signal } = events
  root.addEventListener('pointerover', onOver, { signal })
  root.addEventListener('pointerout', onOut, { signal })
  root.addEventListener('click', onClick, { signal })
  root.addEventListener('focusin', onFocus, { signal })
  root.addEventListener('focusout', onBlur, { signal })
  document.addEventListener('keydown', onKey, { signal })
  document.addEventListener('selectionchange', () => { if (blocked()) dismiss() }, { signal })
  window.addEventListener('pointerdown', onDown, { signal, capture: true, passive: true })
  window.addEventListener('scroll', schedulePlace, { signal, capture: true, passive: true })
  window.addEventListener('resize', schedulePlace, { signal })
  window.visualViewport?.addEventListener('resize', schedulePlace, { signal })
  window.visualViewport?.addEventListener('scroll', schedulePlace, { signal })
})
onBeforeUnmount(() => {
  events?.abort()
  cancelAnimationFrame(frame)
  dismiss()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="active" ref="capsule" class="math-tex-copy" role="group" aria-label="公式复制"
      :style="position ?? { visibility: 'hidden' }" @pointerenter="keepOpen"
      @pointerleave="$event.pointerType === 'mouse' && leave()" @focusout="onBlur">
      <button ref="primary" type="button" aria-label="复制 TeX 源码" title="复制 TeX 源码" @click="copy(false)">
        <ReaderIcon name="copy" />
        <span v-if="!feedback && active.classList.contains('math-block')">TeX</span>
        <span role="status" aria-live="polite">{{ feedback }}</span>
      </button>
      <button type="button" aria-label="复制带定界符的 TeX" title="复制带定界符的 TeX" @click="copy(true)">$…$</button>
    </div>
  </Teleport>
</template>

<style scoped>
.math-tex-copy {
  position: fixed;
  z-index: 19;
  display: inline-flex;
  align-items: stretch;
  padding: 2px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font: 500 12px/1.4 system-ui, sans-serif;
}
.math-tex-copy button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 26px;
  padding-inline: 6px;
  border-radius: inherit;
  transition: background-color .12s, color .12s;
}
.math-tex-copy button span:not(:empty) { margin-inline-start: 4px; }
.math-tex-copy button:is(:hover, :focus-visible) { background: var(--vp-c-bg-soft); color: var(--vp-c-brand-1); }
.math-tex-copy button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -2px; }
@media (pointer: coarse) { .math-tex-copy button { min-width: 44px; min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .math-tex-copy button { transition: none; } }
@media print { .math-tex-copy { display: none; } }
</style>
