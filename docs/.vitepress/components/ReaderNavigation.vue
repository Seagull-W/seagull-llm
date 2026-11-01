<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { onContentUpdated, useData, useRoute, withBase } from 'vitepress'
import { data as pages } from '../data/tagged-pages.data'
import { normalizeContentPath } from '../public-content'
import { sectionFor } from '../content-catalog'
import { sidebar } from '../sidebar'
import ContentsList, { type Heading } from './ContentsList.vue'
const { frontmatter, page } = useData()
const route = useRoute()
const enabled = computed(() => frontmatter.value.layout !== 'page' && !String(frontmatter.value.pageClass || '').includes('chapter-index'))
const section = computed(() => sectionFor('/' + page.value.relativePath))
function pageHeadings(items: any[]): Heading[] {
  return items.flatMap(h => [{ id: h.slug, text: h.title, level: h.level }, ...pageHeadings(h.children || [])])
}
// Reserve the desktop outline in SSR, avoiding a lateral jump after hydration.
const headings = shallowRef<(Heading & { element?: HTMLElement })[]>(pageHeadings(page.value.headers || []))
const groups = computed(() => {
  const result: { heading: Heading; children: Heading[] }[] = []
  for (const h of headings.value) {
    if (h.level === 2 || !result.length) result.push({ heading: h, children: [] })
    else result.at(-1)!.children.push(h)
  }
  return result
})
const active = ref(''), expanded = ref(headings.value[0]?.id || ''), mode = ref<'toc' | 'collection'>('toc')
const drawer = ref<HTMLDialogElement>(), rail = ref<HTMLElement>()
const tocEnabled = computed(() => frontmatter.value.aside !== false && frontmatter.value.outline !== false && headings.value.length > 0)
const collection = computed(() => {
  const ordered: string[] = []
  function collect(items: any[]) { for (const item of items) { if (item.link) ordered.push(normalizeContentPath(item.link)); if (item.items) collect(item.items) } }
  collect(sidebar['/' + section.value?.id + '/'] || [])
  return pages.filter(p => p.section === section.value?.id).sort((a, b) => ordered.indexOf(normalizeContentPath(a.url)) - ordered.indexOf(normalizeContentPath(b.url)))
})
let frame = 0, trigger: HTMLElement | null = null, oldOverflow = '', locked = false
function update() {
  frame = 0
  let current = headings.value[0]?.id || ''
  for (const h of headings.value) {
    if (!h.element?.getClientRects().length) continue
    if (h.element.getBoundingClientRect().top <= 140) current = h.id
    else break
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) current = headings.value.filter(h => h.element?.getClientRects().length).at(-1)?.id || current
  active.value = current
}
function schedule() { if (!frame) frame = requestAnimationFrame(update) }
function refresh() {
  close()
  headings.value = Array.from(document.querySelectorAll<HTMLElement>('.vp-doc h2[id], .vp-doc h3[id], .vp-doc h4[id], .vp-doc h5[id], .vp-doc h6[id]')).map(element => {
    const label = element.cloneNode(true) as HTMLElement
    label.querySelectorAll('.header-anchor').forEach(a => a.remove())
    return { id: element.id, text: (label.textContent || '').trim(), level: Number(element.tagName[1]), element }
  })
  expanded.value = headings.value[0]?.id || ''; schedule()
}
onContentUpdated(refresh)
watch(active, async id => {
  const group = groups.value.find(g => g.heading.id === id || g.children.some(h => h.id === id))
  expanded.value = group?.heading.id || ''
  await nextTick()
  for (const root of [rail.value, drawer.value?.open && mode.value === 'toc' ? drawer.value : null]) {
    const link = root?.querySelector<HTMLElement>('[aria-current="location"]'), list = root?.querySelector<HTMLElement>('.reader-toc-list')
    if (link && list) {
      const y = link.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
      if (y < list.scrollTop || y + link.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = y - list.clientHeight / 2
    }
  }
})
function toggle(id: string) { expanded.value = expanded.value === id ? '' : id }
function open(event: MouseEvent, nextMode: 'toc' | 'collection') {
  mode.value = nextMode; trigger = event.currentTarget as HTMLElement
  oldOverflow = document.documentElement.style.overflow; locked = true
  drawer.value?.showModal(); document.documentElement.style.overflow = 'hidden'
}
function restore() { if (locked) { document.documentElement.style.overflow = oldOverflow; locked = false; trigger?.focus({ preventScroll: true }) } }
function close() { drawer.value?.close(); restore() }
function jump(id: string) {
  close()
  const target = document.getElementById(id)
  if (!target) return
  for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true
  history.pushState(history.state, '', '#' + encodeURIComponent(id))
  const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 120
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); active.value = id
}
watch(() => route.path, close)
onMounted(() => { window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); refresh() })
onUnmounted(() => { close(); cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) })
</script>
<template>
  <div v-if="enabled" class="reader-navigation" :class="{ 'has-toc': tocEnabled }">
    <nav class="reader-tools" aria-label="阅读导航">
      <button v-if="section" aria-haspopup="dialog" @click="open($event, 'collection')">栏目目录 <span aria-hidden="true">⌄</span></button>
      <button v-if="tocEnabled" class="toc-mobile" aria-haspopup="dialog" @click="open($event, 'toc')">本页目录 <span aria-hidden="true">☰</span></button>
    </nav>
    <aside v-if="tocEnabled" ref="rail" class="reader-toc" aria-label="本页目录"><h2>本页目录</h2><ContentsList :groups="groups" :active="active" :expanded="expanded" @jump="jump" @toggle="toggle" /></aside>
    <dialog ref="drawer" class="reader-drawer" aria-labelledby="reader-drawer-title" @close="restore" @click="($event.target === drawer) && close()">
      <header><h2 id="reader-drawer-title">{{ mode === 'toc' ? '本页目录' : section?.title }}</h2><button autofocus aria-label="关闭目录" @click="close">关闭</button></header>
      <ContentsList v-if="mode === 'toc'" :groups="groups" :active="active" :expanded="expanded" @jump="jump" @toggle="toggle" />
      <nav v-else class="reader-collection-list" aria-label="栏目文章"><a class="collection-home" :href="withBase('/' + section?.id + '/')" @click="close">查看栏目首页 →</a><a v-for="entry in collection" :key="entry.url" :href="withBase(entry.url)" :aria-current="normalizeContentPath('/' + page.relativePath) === normalizeContentPath(entry.url) ? 'page' : undefined" @click="close"><small>{{ entry.kind }}</small>{{ entry.title }}</a></nav>
    </dialog>
  </div>
</template>
