<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { textSections, type ContentEntry } from '../content-catalog'
import { useVisualStyle } from '../theme/visual-styles'
import SectionArtwork from './SectionArtwork.vue'
import SectionPhotograph from './SectionPhotograph.vue'

const props = defineProps<{ pages: ContentEntry[] }>()
const style = useVisualStyle()
const collections = computed(() => textSections.map(s => ({
  ...s, articles: props.pages.filter(p => p.section === s.id)
})))
const number = (n: number) => String(n + 1).padStart(2, '0')
const indexUrl = (id: string) => withBase('/' + id + '/')

// Readers may keep one harbour on this device as a shortcut back to a collection.
const storageKey = 'seagull-pixel-waypoint'
const bookmark = ref('')
const bookmarked = computed(() => collections.value.find(s => s.id === bookmark.value))
onMounted(() => {
  try { bookmark.value = localStorage.getItem(storageKey) || '' } catch { /* Storage is optional. */ }
})
function mark(id: string) {
  bookmark.value = bookmark.value === id ? '' : id
  try {
    if (bookmark.value) localStorage.setItem(storageKey, bookmark.value)
    else localStorage.removeItem(storageKey)
  } catch { /* The choice still lasts for this visit. */ }
}
const routeLine = computed(() => collections.value.map((_, i) => {
  if (!i) return 'M50 25'
  return `H${i * 100}V${i % 2 ? 49 : 25}H${i * 100 + 50}`
}).join(' '))

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
  <nav v-if="style.iconSet === 'paper'" class="folio-index" aria-label="分册目录">
    <article v-for="(s, i) in collections" :key="s.id" class="folio-leaf" :class="{ 'folio-cover': i === 0 }">
      <a class="folio-link" :href="indexUrl(s.id)">
        <span class="folio-imprint"><span>分册 {{ number(i) }}</span><span>{{ s.articles.length }} 篇</span></span>
        <SectionArtwork :section="s.id" />
        <h3>{{ s.title }}</h3><p>{{ s.description }}</p>
      </a>
      <div v-if="i === 0" class="folio-contents">
        <a v-for="page in s.articles.slice(0, 3)" :key="page.url" :href="withBase(page.url)">{{ page.title }}</a>
      </div>
      <details v-else-if="s.articles.length" class="folio-peek">
        <summary>翻看片目</summary>
        <div class="folio-contents"><a v-for="page in s.articles.slice(0, 2)" :key="page.url" :href="withBase(page.url)">{{ page.title }}</a></div>
      </details>
    </article>
  </nav>

  <nav v-else-if="style.iconSet === 'pixel'" class="waypoint-index" aria-label="栏目航线">
    <div class="waypoint-chart">
      <svg class="waypoint-track" :viewBox="`0 0 ${100 * collections.length} 80`" preserveAspectRatio="none" aria-hidden="true">
        <path :d="routeLine" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 5" vector-effect="non-scaling-stroke" />
      </svg>
      <ol class="waypoints" :style="{ '--stops': collections.length }">
        <li v-for="(s,i) in collections" :key="s.id" :class="{ 'is-marked': bookmark === s.id }">
          <a class="waypoint-destination" :href="indexUrl(s.id)">
            <SectionArtwork :section="s.id" /><span class="waypoint-code">PORT {{ number(i) }}</span>
            <h3>{{ s.title }}</h3><p>{{ s.description }}</p><span class="waypoint-count">{{ s.articles.length }} 篇</span>
          </a>
          <button type="button" :aria-pressed="bookmark === s.id" :aria-label="`${bookmark === s.id ? '取消标记' : '标记航点'}：${s.title}`" @click="mark(s.id)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h2v2h8v6H5v6H3z" /></svg>
          </button>
        </li>
      </ol>
    </div>
    <div class="waypoint-log" aria-live="polite"><span>返航航点</span>
      <a v-if="bookmarked" :href="indexUrl(bookmarked.id)">{{ bookmarked.title }} →</a>
      <small v-else>点旗标记常读的栏目</small>
    </div>
  </nav>

  <div v-else class="reel-index">
    <nav id="collection-contact-strip" ref="strip" class="contact-strip" aria-label="栏目镜头" @scroll.passive="checkStrip">
      <a v-for="(s, i) in collections" :key="s.id" :href="indexUrl(s.id)">
        <SectionPhotograph :section="s.id" />
        <div class="shot-caption"><span>{{ number(i) }}</span><div><h3>{{ s.title }}</h3><p>{{ s.description }}</p></div></div>
      </a>
    </nav>
    <div class="reel-transport"><span>{{ collections.length }} 个栏目</span>
      <button type="button" aria-controls="collection-contact-strip" aria-label="上一个栏目镜头" :disabled="atStart" @click="advance(-1)">←</button>
      <button type="button" aria-controls="collection-contact-strip" aria-label="下一个栏目镜头" :disabled="atEnd" @click="advance(1)">→</button>
    </div>
  </div>
</template>

<style scoped>
.folio-index a,.waypoint-index a,.reel-index a { text-decoration:none; font-weight:inherit; }
.folio-index h3,.waypoint-index h3,.reel-index h3 { margin:0; padding:0; border:0; }
.folio-index { display:grid; grid-template-columns:minmax(0,1.28fr) repeat(2,minmax(0,1fr)); gap:0 clamp(16px,2.7vw,36px); align-items:start; }
.folio-leaf { border-top:1px solid var(--vp-c-divider); padding:12px 0 6px; min-width:0; }
.folio-link { display:grid; grid-template-columns:minmax(0,1fr) 56px; gap:3px 8px; color:var(--vp-c-text-1); }
.folio-imprint { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; color:var(--vp-c-text-2); font:11px/1.65 var(--vp-font-family-base); letter-spacing:.07em; }
.folio-link .section-artwork { width:56px; height:42px; align-self:center; grid-column:2; grid-row:2/4; }
.folio-index h3 { grid-column:1; grid-row:2; color:var(--vp-c-text-1); font:600 17px/1.55 'Seagull Academic Serif',SimSun,serif; }
.folio-index p { grid-column:1; grid-row:3; margin:0; color:var(--vp-c-text-2); font-size:12px; line-height:1.7; }
.folio-cover { grid-row:span 3; align-self:stretch; padding:20px clamp(16px,2.5vw,32px); background:var(--vp-c-bg-alt); border:1px solid var(--vp-c-divider); box-shadow:3px 3px 0 var(--vp-c-bg),4px 4px 0 var(--vp-c-divider); position:relative; }
.folio-cover::before { content:''; position:absolute; width:18px; height:26px; top:-1px; left:24px; background:var(--illustration-shade); clip-path:polygon(0 0,100% 0,100% 100%,50% 75%,0 100%); }
.folio-cover .folio-link { display:block; }
.folio-cover .folio-imprint { padding-left:28px; }
.folio-cover .section-artwork { width:clamp(100px,12vw,150px); height:auto; margin:14px auto; }
.folio-cover h3 { font-size:clamp(22px,2.4vw,32px); }
.folio-cover p { margin-top:6px; }
.folio-peek summary { width:fit-content; padding:7px 0; color:var(--vp-c-brand-1); font-size:12px; }
.folio-contents { margin-top:8px; }
.folio-contents a { display:block; padding:8px 0; border-top:1px solid var(--vp-c-divider); font-size:12px; line-height:1.7; color:var(--vp-c-text-1); }
.folio-index a:is(:focus-visible,:hover) h3,.folio-contents a:hover { color:var(--vp-c-brand-1); text-decoration:underline; text-underline-offset:3px; }

.waypoint-chart { position:relative; padding:16px 10px 8px; background-color:var(--pixel-panel); background-image:radial-gradient(var(--vp-c-divider) 1px,transparent 1px); background-size:14px 14px; border-block:2px solid var(--pixel-edge); }
.waypoint-track { position:absolute; inset:17px 10px auto; width:calc(100% - 20px); height:80px; color:var(--pixel-edge); pointer-events:none; }
.waypoints { display:grid; grid-template-columns:repeat(var(--stops),minmax(0,1fr)); list-style:none; margin:0; padding:0; }
.waypoints li { margin:0; padding:0 2px; text-align:center; min-width:0; }
.waypoints li:nth-child(even) { padding-top:24px; }
.waypoint-destination { display:block; }
.waypoints .section-artwork { display:block; width:min(100%,88px); height:54px; margin:auto; }
.waypoint-code { color:var(--vp-c-text-2); font:10px/1.6 var(--vp-font-family-mono); letter-spacing:.08em; }
.waypoints h3 { color:var(--vp-c-text-1); font-size:14px; line-height:1.6; }
.waypoints p { margin:4px auto 3px; max-width:14em; color:var(--vp-c-text-2); font-size:12px; line-height:1.65; }
.waypoint-count { color:var(--vp-c-text-2); font-size:12px; }
.waypoints button { display:inline-grid; place-items:center; width:38px; height:38px; color:var(--vp-c-text-2); }
.waypoints button svg { width:15px; height:15px; fill:transparent; stroke:currentColor; stroke-width:1.4; shape-rendering:crispEdges; }
.waypoints .is-marked button { color:var(--vp-c-brand-1); }
.waypoints .is-marked button svg { fill:var(--pixel-signal); }
.waypoint-log { display:flex; justify-content:space-between; gap:14px; align-items:center; padding:11px 14px; border-bottom:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); font-size:12px; }
.waypoint-log a { color:var(--vp-c-brand-1); }
.waypoint-log small { font-size:12px; }

.contact-strip { display:flex; align-items:start; gap:clamp(14px,2.5vw,28px); overflow-x:auto; padding:3px 3px 15px; scroll-snap-type:x proximity; overscroll-behavior-x:contain; scrollbar-width:thin; scrollbar-color:var(--vp-c-border-hover) transparent; }
.contact-strip a { display:block; flex:0 0 clamp(220px,34%,405px); min-width:0; scroll-snap-align:start; color:var(--vp-c-text-1); }
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
@media(max-width:820px) {
  .folio-index { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .folio-cover { grid-row:span 2; }
  .waypoint-chart { overflow-x:auto; scrollbar-width:thin; }
  .waypoints { min-width:680px; }
  .waypoint-track { min-width:680px; }
}
@media(max-width:540px) {
  .folio-index { display:block; }
  .folio-cover { margin:0 4px 20px 0; }
  .folio-cover .folio-link { display:grid; grid-template-columns:minmax(0,1fr) 80px; }
  .folio-cover .section-artwork { margin:0; width:80px; }
  .folio-cover .folio-contents a { padding:7px 0; }
  .folio-link .section-artwork { grid-row:2/4; }
  .folio-peek summary { padding-block:10px; }
  .contact-strip a { flex-basis:83%; }
  .shot-caption h3 { font-size:17px; }
  .waypoint-chart { overflow:visible; padding:10px; }
  .waypoint-track { display:none; }
  .waypoints { min-width:0; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px 12px; }
  .waypoints li,.waypoints li:nth-child(even) { padding:5px 0; border-bottom:1px dashed var(--vp-c-divider); }
  .waypoint-destination { display:grid; grid-template-columns:35px 1fr; gap:0 5px; align-items:center; text-align:left; }
  .waypoints .section-artwork { width:35px; height:32px; grid-row:1/3; }
  .waypoint-code { font-size:9px; }
  .waypoints h3 { font-size:13px; }
  .waypoints p { grid-column:1/-1; max-width:none; margin:4px 0; }
  .waypoint-count { grid-column:1/-1; }
  .waypoints li { position:relative; }
  .waypoints button { position:absolute; bottom:0; right:0; width:32px; height:32px; }
}
</style>
