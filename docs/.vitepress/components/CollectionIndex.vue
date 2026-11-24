<script setup lang="ts">
import { ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { textSections } from '../content-catalog'
import SectionPhotograph from './SectionPhotograph.vue'

const number = (n: number) => String(n + 1).padStart(2, '0')
const indexUrl = (id: string) => withBase('/' + id + '/')

const strip = ref<HTMLElement>()
const atStart = ref(true), atEnd = ref(false)
function checkStrip() {
  if (!strip.value) return
  const { scrollLeft, scrollWidth, clientWidth } = strip.value
  atStart.value = scrollLeft < 2
  atEnd.value = scrollLeft + clientWidth >= scrollWidth - 2
}
watch(strip, (el, _, cleanup) => {
  if (!el) return
  const resize = new ResizeObserver(checkStrip)
  resize.observe(el)
  checkStrip()
  cleanup(() => resize.disconnect())
}, { flush: 'post' })
function advance(direction: number) {
  const el = strip.value
  if (!el || el.children.length < 2) return
  const step = el.children[1].getBoundingClientRect().left - el.children[0].getBoundingClientRect().left
  el.scrollBy({ left: direction * step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}
</script>

<template>
  <div class="reel-index">
    <nav id="collection-contact-strip" ref="strip" class="contact-strip" aria-label="栏目镜头" @scroll.passive="checkStrip">
      <a v-for="(s, i) in textSections" :key="s.id" :href="indexUrl(s.id)">
        <SectionPhotograph :section="s.id" />
        <div class="shot-caption"><span>{{ number(i) }}</span><div><h3>{{ s.title }}</h3><p>{{ s.description }}</p></div></div>
      </a>
    </nav>
    <div class="reel-transport"><span>{{ textSections.length }} 个栏目</span>
      <button type="button" aria-controls="collection-contact-strip" aria-label="上一个栏目镜头" :disabled="atStart" @click="advance(-1)">←</button>
      <button type="button" aria-controls="collection-contact-strip" aria-label="下一个栏目镜头" :disabled="atEnd" @click="advance(1)">→</button>
    </div>
  </div>
</template>

<style scoped>
.reel-index a { text-decoration:none; font-weight:inherit; }
.reel-index h3 { margin:0; padding:0; border:0; }

.contact-strip { --strip-gap:clamp(14px,2.5vw,28px); display:flex; align-items:start; gap:var(--strip-gap); overflow-x:auto; padding:3px 0 15px; scroll-snap-type:x proximity; overscroll-behavior-x:contain; scrollbar-width:thin; scrollbar-color:var(--vp-c-border-hover) transparent; }
.contact-strip a { display:block; flex:0 0 calc((100% - 2 * var(--strip-gap)) / 3); min-width:0; scroll-snap-align:start; color:var(--vp-c-text-1); }
.contact-strip .section-photograph { width:100%; aspect-ratio:1.85; }
.contact-strip a:focus-visible { outline-offset:-2px; }
.shot-caption { display:flex; gap:13px; align-items:baseline; padding:12px 0 4px; }
.shot-caption > span { font:italic 17px/1 Georgia,serif; color:var(--vp-c-brand-1); }
.shot-caption h3 { font:500 19px/1.5 'Seagull Academic Serif',SimSun,serif; }
.shot-caption p { color:var(--vp-c-text-2); margin:3px 0 0; font-size:12px; line-height:1.7; }
.reel-transport { display:flex; gap:4px; align-items:center; margin-top:5px; border-top:1px solid var(--vp-c-divider); }
.reel-transport span { margin-right:auto; color:var(--vp-c-text-2); font-size:12px; }
.reel-transport button { width:44px; height:40px; font-size:20px; color:var(--vp-c-brand-1); }
.reel-transport button:disabled { opacity:.35; cursor:default; }
@media(max-width:899px) {
  .contact-strip a { flex-basis:calc((100% - var(--strip-gap)) / 2); }
}
@media(max-width:540px) {
  .contact-strip a { flex-basis:83%; }
  .shot-caption h3 { font-size:17px; }
}
</style>
