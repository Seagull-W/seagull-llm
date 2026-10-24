<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { onContentUpdated, useData, useRoute } from 'vitepress'
import { useSidebar } from 'vitepress/dist/client/theme-default/composables/sidebar'
import VPSidebarItem from 'vitepress/dist/client/theme-default/components/VPSidebarItem.vue'

const { frontmatter } = useData()
const route = useRoute()
const { sidebar, hasSidebar } = useSidebar()
const enabled = computed(() => frontmatter.value.layout !== 'page')
const headings = shallowRef<{ id: string; text: string; level: number; element: HTMLElement }[]>([])
const active = ref('')
const collapsed = ref(false)
const collectionCollapsed = ref(false)
const mode = ref<'collection' | 'toc'>('toc')
const drawer = ref<HTMLDialogElement>()
const drawerOpen = ref(false)
const rail = ref<HTMLElement>()
const tocEnabled = computed(() => frontmatter.value.aside !== false && frontmatter.value.outline !== false && headings.value.length > 0)
let frame = 0
let trigger: HTMLElement | null = null
let oldOverflow = ''
let locked = false
function update() {
  frame = 0
  const readingLine = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vp-nav-height')) || 64) + 80
  let current = headings.value[0]?.id || ''
  for (const h of headings.value) {
    if (!h.element.getClientRects().length) continue
    if (h.element.getBoundingClientRect().top <= Math.max(readingLine, (parseFloat(getComputedStyle(h.element).scrollMarginTop) || 92) + 8)) current = h.id
    else break
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
    current = headings.value.filter(h => h.element.getClientRects().length).at(-1)?.id || current
  }
  active.value = current
}
function schedule() { if (!frame) frame = requestAnimationFrame(update) }
onContentUpdated(() => {
  close()
  headings.value = Array.from(document.querySelectorAll<HTMLElement>('.vp-doc h2[id], .vp-doc h3[id], .vp-doc h4[id]')).map(element => {
    const label = element.cloneNode(true) as HTMLElement
    label.querySelectorAll('.header-anchor').forEach(anchor => anchor.remove())
    return { id: element.id, text: (label.textContent || '').trim(), level: Number(element.tagName[1]), element }
  })
  schedule()
})
watch([active, collapsed, drawerOpen], async () => {
  await nextTick()
  for (const root of [rail.value, drawer.value?.open ? drawer.value : null]) {
    const link = root?.querySelector<HTMLElement>('[aria-current="location"]')
    const list = link?.closest<HTMLElement>('.reader-toc-list')
    if (link && list) {
      const y = link.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
      if (y < list.scrollTop || y + link.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = y - list.clientHeight / 2
    }
  }
})
function open(which: 'collection' | 'toc', event: MouseEvent) {
  mode.value = which
  trigger = event.currentTarget as HTMLElement
  oldOverflow = document.documentElement.style.overflow
  locked = true
  drawer.value?.showModal()
  drawerOpen.value = true
  document.documentElement.style.overflow = 'hidden'
}
function restore() {
  drawerOpen.value = false
  if (!locked) return
  document.documentElement.style.overflow = oldOverflow
  locked = false
  trigger?.focus({ preventScroll: true })
}
function close() { drawer.value?.close(); restore() }
function jump(id: string) {
  close()
  const target = document.getElementById(id)
  if (!target) return
  history.pushState(null, '', '#' + encodeURIComponent(id))
  const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 92
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  active.value = id
}
function resize() { close(); schedule() }
watch(collectionCollapsed, value => document.body.classList.toggle('reader-collection-collapsed', value))
watch(() => route.path, close)
onMounted(() => {
  document.body.classList.remove('vp-sidebar-collapsed')
  document.documentElement.style.setProperty('--vp-sidebar-width', '248px')
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', resize)
  schedule()
})
onUnmounted(() => {
  close()
  cancelAnimationFrame(frame)
  document.body.classList.remove('reader-collection-collapsed')
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div v-if="enabled" class="reader-navigation" :class="{ 'toc-is-collapsed': collapsed, 'has-toc': tocEnabled }">
    <nav class="reader-tools" aria-label="阅读导航">
      <button v-if="hasSidebar" class="collection-desktop" :aria-expanded="!collectionCollapsed" @click="collectionCollapsed = !collectionCollapsed">{{ collectionCollapsed ? '展开栏目' : '收起栏目' }}</button>
      <button v-if="hasSidebar" class="collection-mobile" aria-haspopup="dialog" @click="open('collection', $event)">栏目目录</button>
      <button v-if="tocEnabled" class="toc-mobile" aria-haspopup="dialog" @click="open('toc', $event)">本页目录</button>
      <button v-if="tocEnabled" class="toc-desktop" :aria-expanded="!collapsed" aria-controls="reader-toc" @click="collapsed = !collapsed">{{ collapsed ? '展开本页目录' : '收起本页目录' }}</button>
    </nav>
    <aside v-if="tocEnabled" id="reader-toc" ref="rail" class="reader-toc" aria-label="本页目录" :hidden="collapsed">
      <h2>本页目录</h2>
      <nav class="reader-toc-list">
        <a v-for="h in headings" :key="h.id" :href="'#' + encodeURIComponent(h.id)" :style="{ '--depth': h.level - 2 }" :aria-current="active === h.id ? 'location' : undefined" @click.prevent="jump(h.id)">{{ h.text }}</a>
      </nav>
    </aside>
    <dialog ref="drawer" class="reader-drawer" aria-labelledby="reader-drawer-title" @close="restore" @click="($event.target === drawer) && close()">
      <header><h2 id="reader-drawer-title">{{ mode === 'toc' ? '本页目录' : '栏目目录' }}</h2><button autofocus aria-label="关闭目录" @click="close">关闭</button></header>
      <nav v-if="mode === 'toc'" class="reader-toc-list" aria-label="本页标题">
        <a v-for="h in headings" :key="h.id" :href="'#' + encodeURIComponent(h.id)" :style="{ '--depth': h.level - 2 }" :aria-current="active === h.id ? 'location' : undefined" @click.prevent="jump(h.id)">{{ h.text }}</a>
      </nav>
      <nav v-else class="reader-collection-list" aria-label="栏目文章" @click="($event.target as HTMLElement).closest('a') && close()">
        <VPSidebarItem v-for="(item, i) in sidebar" :key="i" :item="item" :depth="0" />
      </nav>
    </dialog>
  </div>
</template>
