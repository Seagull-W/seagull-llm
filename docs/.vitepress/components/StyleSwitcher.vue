<script setup lang="ts">
import { inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import { visualStyles, visualStyleControlsKey, useVisualStyle, type VisualStyleId } from '../theme/visual-styles'
import { changeAppearance } from '../theme/appearance-motion'
import PixelWordmark from './PixelWordmark.vue'

const controls = inject(visualStyleControlsKey)
const current = useVisualStyle()
const { isDark } = useData()
const route = useRoute()
const trigger = ref<HTMLButtonElement>()
const dialog = ref<HTMLDialogElement>()
const opened = ref(false)
const descriptions: Record<VisualStyleId, string> = {
  'paper-coast': '纸页、海风与留白',
  'pixel-voyage': '像素、海岛与探索',
  'along-the-way': '窗光、远方与生活',
}
let previousOverflow = ''
let scrollLocked = false

async function open(event: MouseEvent) {
  if (!dialog.value || opened.value) return
  opened.value = true
  await nextTick()
  if (!opened.value || !dialog.value) return
  previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
  scrollLocked = true
  dialog.value.showModal()
  // Keyboard users land on the current choice; pointer users get an unobscured preview.
  if (event.detail === 0) dialog.value.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
  else dialog.value.focus()
}
function restore() {
  if (scrollLocked) { document.documentElement.style.overflow = previousOverflow; scrollLocked = false }
  if (!opened.value) return
  opened.value = false
  trigger.value?.focus({ preventScroll: true })
}
function close() { dialog.value?.close(); restore() }
function dismissOutside(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const box = dialog.value.getBoundingClientRect()
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close()
}
function choose(id: VisualStyleId) {
  close()
  if (!controls || id === controls.selected.value) return
  changeAppearance(visualStyles[id].iconSet, () => controls.select(id))
}
function move(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const covers = [...(dialog.value?.querySelectorAll<HTMLButtonElement>('.style-cover') || [])]
  const active = covers.indexOf(document.activeElement as HTMLButtonElement)
  if (active < 0) return
  event.preventDefault()
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? covers.length - 1
    : (active + (event.key === 'ArrowRight' ? 1 : -1) + covers.length) % covers.length
  covers[index]?.focus()
}
watch(() => route.path, close)
onUnmounted(() => { dialog.value?.close(); if (scrollLocked) document.documentElement.style.overflow = previousOverflow })
</script>

<template>
  <div v-if="controls" class="style-switcher" :class="{ 'is-night': isDark }" :style="{ '--preview-pixel-filter': isDark ? 'none' : `url('#pixel-daylight')` }">
    <button ref="trigger" class="style-trigger" type="button" aria-label="切换视觉风格" aria-haspopup="dialog" :aria-expanded="opened" aria-controls="style-book" :title="`当前：${current.name} · 翻阅风格`" @click="open">
      <span class="style-miniatures" aria-hidden="true"><span class="miniature-back"></span><span class="miniature-front" :data-style="current.id"><img :src="withBase(current.assets.logo)" alt="" width="24" height="24" /></span></span>
      <span class="style-trigger-label">{{ current.name }}</span>
    </button>
    <span class="sr-only" role="status">当前视觉风格：{{ current.name }}</span>
    <dialog id="style-book" ref="dialog" class="style-book" tabindex="-1" aria-labelledby="style-book-title" aria-describedby="style-book-hint" @close="restore" @click="dismissOutside" @keydown="move">
      <template v-if="opened">
        <header class="style-book-heading"><div><h2 id="style-book-title">换一片风景</h2><p id="style-book-hint">点选封面，换一种阅读氛围</p></div><button class="style-book-close" type="button" aria-label="关闭风格选择" @click="close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
        <div class="style-covers" role="group" aria-label="可选风格">
          <button v-for="(style, id) in visualStyles" :key="id" class="style-cover" :data-style="id" type="button" :aria-label="`切换为${style.name}`" :aria-pressed="current.id === id" @click="choose(id)">
            <span class="cover-scene" aria-hidden="true">
              <img class="cover-art" :src="withBase(isDark ? style.assets.heroDark : style.assets.heroLight)" alt="" width="260" height="180" />
              <span class="cover-brand"><PixelWordmark v-if="id === 'pixel-voyage'" /><span v-else>Seagull</span></span>
              <span class="cover-horizon"></span>
            </span>
            <span class="cover-caption"><strong>{{ style.name }}</strong><span v-if="current.id === id" class="cover-current"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>使用中</span></span>
            <span class="cover-description">{{ descriptions[id] }}</span>
          </button>
        </div>
      </template>
    </dialog>
  </div>
</template>

<style scoped>
.style-switcher { --preview-paper:#eef3f2; --preview-ink:#285865; --preview-pixel:#ece9df; --preview-pixel-ink:#26364a; }
.style-switcher.is-night { --preview-paper:#203b44; --preview-ink:#d9e9e9; --preview-pixel:#26364a; --preview-pixel-ink:#f6f1e7; }
.style-trigger { display:flex; align-items:center; gap:9px; min-height:40px; padding:0 8px; border:0; border-radius:6px; color:var(--vp-c-text-1); background:transparent; cursor:pointer; }
.style-trigger:hover { background:var(--vp-c-bg-soft); }
.style-trigger-label { min-width:4em; font:13px/1.5 var(--vp-font-family-base); text-align:left; white-space:nowrap; }
.style-miniatures { position:relative; display:block; width:28px; height:30px; flex:none; perspective:120px; }
.miniature-back,.miniature-front { position:absolute; display:block; inset:4px 3px 3px 2px; border:1px solid var(--vp-c-divider); border-radius:2px; transform-origin:50% 85%; transition:transform .2s; }
.miniature-back { background:var(--vp-c-brand-1); opacity:.55; transform:translate(3px,-2px) rotate(12deg); }
.miniature-front { display:grid; place-items:center; background:var(--preview-paper); transform:rotate(-8deg); }
.miniature-front[data-style='pixel-voyage'] { background:var(--preview-pixel); }
.miniature-front img { width:20px; height:20px; }
.miniature-front[data-style='pixel-voyage'] img { image-rendering:pixelated; filter:var(--preview-pixel-filter); }
.style-trigger:is(:hover,:focus-visible) .miniature-back { transform:translate(6px,-3px) rotate(19deg); }
.style-trigger:is(:hover,:focus-visible) .miniature-front { transform:translate(-2px,0) rotate(-13deg); }
.style-book { position:fixed; inset:calc(var(--vp-nav-height) + 16px) 24px auto auto; width:480px; max-width:calc(100vw - 32px); max-height:calc(100dvh - var(--vp-nav-height) - 32px); margin:0; padding:24px 26px 28px; overflow:auto; overscroll-behavior:contain; border:1px solid var(--vp-c-divider); border-radius:12px; background:var(--vp-c-bg-alt); color:var(--vp-c-text-1); box-shadow:0 16px 64px #14223030; white-space:normal; }
.style-book::backdrop { background:#14223038; }
.style-book { width:670px; }
.style-book:focus { outline:none; }
.style-book-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:24px; }
.style-book-heading h2 { margin:0; font:600 19px/1.5 var(--vp-font-family-base); letter-spacing:.02em; }
.style-book-heading p { margin:4px 0 0; font:12px/1.7 var(--vp-font-family-base); color:var(--vp-c-text-2); }
.style-book-close { display:grid; place-items:center; flex:none; width:36px; height:36px; margin:-6px -8px 0 0; padding:0; border:0; border-radius:50%; color:var(--vp-c-text-2); background:transparent; }
.style-book-close:hover { background:var(--vp-c-bg-soft); color:var(--vp-c-text-1); }
.style-covers { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; perspective:800px; }
.style-cover { display:block; min-width:0; padding:6px 0 0; border:0; border-radius:4px; background:transparent; color:inherit; text-align:left; font-family:var(--vp-font-family-base); white-space:normal; cursor:pointer; }
.cover-scene { position:relative; display:block; height:166px; margin:0 4px 18px; overflow:hidden; isolation:isolate; border-radius:3px 8px 8px 3px; background:var(--preview-paper); box-shadow:1px 2px 0 var(--vp-c-divider),3px 4px 0 var(--vp-c-bg-soft),0 6px 12px #14223016; transform:rotate(-3deg); transform-origin:8px 85%; transition:transform .2s,box-shadow .2s; }
.cover-scene::after { content:''; position:absolute; inset:0 auto 0 7px; width:1px; background:#26364a1c; box-shadow:1px 0 #ffffff30; }
.style-cover[data-style='pixel-voyage'] .cover-scene { background:var(--preview-pixel); border-radius:2px; transform:rotate(3deg); }
.cover-art { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:70% center; }
.style-cover[data-style='along-the-way'] .cover-art { object-position:55% 60%; }
.style-cover[data-style='along-the-way'] .cover-scene { transform:rotate(-2deg); border-radius:2px; }
.style-cover[data-style='along-the-way'] .cover-scene::before { content:''; position:absolute; inset:0; background:linear-gradient(#111a1580,transparent 60%); z-index:1; }
.style-cover[data-style='along-the-way'] .cover-brand { color:#f1eee3; z-index:2; }
.style-cover[data-style='along-the-way'] .cover-horizon { background:#f1eee3; }
.style-cover[data-style='pixel-voyage'] .cover-art { inset:42px 6px 10px auto; width:76%; height:74%; object-fit:contain; image-rendering:pixelated; filter:var(--preview-pixel-filter); }
.cover-brand { position:absolute; top:18px; left:19px; color:var(--preview-ink); font:25px/1 Georgia,serif; }
.style-cover[data-style='pixel-voyage'] .cover-brand { top:22px; right:12px; color:var(--preview-pixel-ink); }
.style-cover .cover-brand .pixel-wordmark { display:block; width:123px; max-width:100%; height:auto; }
.cover-horizon { position:absolute; bottom:14px; left:18px; width:24px; height:1px; background:var(--preview-ink); opacity:.5; }
.style-cover[data-style='pixel-voyage'] .cover-horizon { height:2px; width:6px; background:var(--preview-pixel-ink); box-shadow:10px 0 currentColor,20px 0 currentColor; color:var(--preview-pixel-ink); }
.cover-caption { display:flex; flex-wrap:wrap; gap:4px 8px; align-items:center; justify-content:space-between; }
.cover-caption strong { font:600 15px/1.6 var(--vp-font-family-base); }
.cover-current { display:inline-flex; align-items:center; gap:3px; color:var(--vp-c-brand-1); font-size:10px; }
.cover-description { display:block; margin-top:4px; color:var(--vp-c-text-2); font-size:12px; line-height:1.7; }
.style-cover:is(:hover,:focus-visible) .cover-scene { transform:translateY(-5px) rotate(0); }
.style-book .style-cover:focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:7px; }
@media(max-width:639px) {
  .style-trigger { gap:6px; padding-inline:6px; }
  .style-trigger-label { font-size:12px; }
  .style-miniatures { width:24px; }
  .style-book { inset:auto 12px 16px; width:auto; max-width:none; max-height:calc(100dvh - 32px); padding:22px 20px 26px; }
  .style-covers { gap:18px; }
  .cover-scene { height:150px; margin-inline:2px; }
  .cover-caption strong { font-size:14px; }
  .cover-description { font-size:11px; }
  .cover-brand { left:16px; }
}
@media(max-width:359px) { .style-book { padding-inline:16px; } .cover-scene { height:132px; } .style-covers { gap:16px; } .cover-current { font-size:9px; } }
@media(max-width:639px) {
  .style-covers { grid-template-columns:1fr; gap:18px; }
  .style-cover { display:grid; grid-template-columns:112px minmax(0,1fr); column-gap:18px; padding:0; }
  .style-cover .cover-scene { grid-row:1 / 3; height:94px; margin:0 4px; }
  .cover-caption { align-self:end; }
  .cover-description { align-self:start; }
  .style-cover .cover-brand { top:12px; left:12px; font-size:20px; }
  .style-cover .cover-brand .pixel-wordmark { width:80px; }
  .style-cover[data-style='pixel-voyage'] .cover-brand { top:14px; }
  .style-cover[data-style='pixel-voyage'] .cover-art { top:22px; }
}
@media(prefers-reduced-motion:reduce) {
  .miniature-back,.miniature-front,.cover-scene { transition:none; }
  .style-cover:is(:hover,:focus-visible) .cover-scene { transform:none; }
}
</style>
