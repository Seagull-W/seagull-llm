<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'
import { data, type GraphNode } from '../data/knowledge-graph.data'
import { fold, sections, type ContentEntry } from '../content-catalog'
import { useVisualStyle } from '../theme/visual-styles'
import { createAtlasEngine, type AtlasEngine } from './atlas/atlas-engine'

const props = defineProps<{ pages: ContentEntry[] }>()
const emit = defineEmits<{ tag: [value: string]; section: [value: string]; close: []; expand: [] }>()
const router = useRouter()
const { isDark } = useData()
const visualStyle = useVisualStyle()
const uid = useId()
const kinds = { section: '栏目', tag: '主题', article: '文章' }
const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const nebula = ref<HTMLCanvasElement>()
const command = ref<HTMLElement>()
const search = ref<HTMLInputElement>()
const navigator = ref<HTMLElement>()
const commandOpen = ref(false)
const idle = ref(false)
const hintVisible = ref(true)
const query = ref('')
const resultIndex = ref(0)
const selected = ref('')
const hovered = ref('')
const cluster = ref('')
const labelMode = ref<'quiet' | 'auto' | 'all'>('auto')
const cosmic = ref(true)
const renderError = ref(false)
const keyboardMode = ref(false)
let engine: AtlasEngine | undefined
let idleTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let cardHeld = false
let lastPointerY = 0

const graph = computed(() => {
  const urls = new Set(props.pages.map(page => page.url))
  const articles = new Set(data.nodes.filter(node => node.kind === 'article' && urls.has(node.value)).map(node => node.id))
  const links = data.links.filter(link => articles.has(link.source) || articles.has(link.target))
  const neighbors = new Map<string, Set<string>>()
  for (const { source, target } of links) {
    if (!neighbors.has(source)) neighbors.set(source, new Set())
    if (!neighbors.has(target)) neighbors.set(target, new Set())
    neighbors.get(source)!.add(target)
    neighbors.get(target)!.add(source)
  }
  const nodes = data.nodes.filter(node => neighbors.has(node.id) || articles.has(node.id))
  return { nodes, links, neighbors, byId: new Map(nodes.map(node => [node.id, node])) }
})
const active = computed(() => graph.value.byId.get(hovered.value || selected.value))
const degree = computed(() => graph.value.neighbors.get(active.value?.id || '')?.size || 0)
const sectionNodes = computed(() => sections.flatMap(section => {
  const node = graph.value.nodes.find(node => node.kind === 'section' && node.value === section.id)
  return node ? [node] : []
}))
const directory = computed(() => (['section', 'tag', 'article'] as const).map(kind => ({
  kind, nodes: graph.value.nodes.filter(node => node.kind === kind),
})))
const matches = computed(() => {
  const term = fold(query.value.trim())
  return term ? graph.value.nodes.filter(node => fold(node.label).includes(term)) : []
})
const visibleMatches = computed(() => matches.value.slice(0, 24))
const matchedIds = computed(() => new Set(matches.value.map(node => node.id)))
const labelName = computed(() => ({ quiet: '只见星光', auto: '随镜头浮现', all: '更多星名' })[labelMode.value])
const announcement = computed(() => active.value
  ? `${kinds[active.value.kind]}，${active.value.label}，${degree.value} 个关联。${active.value.kind === 'article' ? '回车前往阅读。' : '回车聚焦星团。'}`
  : `${graph.value.nodes.length} 颗知识星体。方向键探索，或按斜杠搜索。`)

function wake() {
  idle.value = false
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => { idle.value = true; hintVisible.value = false }, 4200)
}
function cancelHide() { clearTimeout(hideTimer) }
function scheduleHide() {
  cancelHide()
  if (!commandOpen.value) return
  hideTimer = setTimeout(() => {
    if (!command.value?.contains(document.activeElement) && lastPointerY > 140) dismissCommand(false)
  }, 1100)
}
async function revealCommand(focusSearch = false) {
  wake()
  cancelHide()
  commandOpen.value = true
  if (focusSearch) {
    await nextTick()
    search.value?.focus({ preventScroll: true })
  }
}
function dismissCommand(returnFocus = true) {
  const heldFocus = command.value?.contains(document.activeElement)
  commandOpen.value = false
  query.value = ''
  cancelHide()
  if (returnFocus && heldFocus) navigator.value?.focus({ preventScroll: true })
}
function stagePointer(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  lastPointerY = event.clientY - (root.value?.getBoundingClientRect().top || 0)
  wake()
  if (lastPointerY < 28) void revealCommand()
  else if (!command.value?.contains(event.target as Node)) scheduleHide()
}
function onHover(id: string) {
  clearTimeout(hoverTimer)
  if (id) { hovered.value = id; keyboardMode.value = false }
  else hoverTimer = setTimeout(() => { if (!cardHeld) hovered.value = '' }, 480)
}
function holdCard() { cardHeld = true; clearTimeout(hoverTimer) }
function releaseCard() { cardHeld = false; onHover('') }
function pin(node: GraphNode) {
  clearTimeout(hoverTimer)
  hovered.value = ''
  selected.value = node.id
}
function focusNode(node: GraphNode) {
  pin(node)
  cluster.value = node.kind === 'section' ? node.value : ''
  engine?.focus(node.id, node.kind !== 'article')
}
function activate(node: GraphNode) {
  if (node.kind === 'article') {
    emit('close')
    void router.go(withBase(node.value))
  } else focusNode(node)
}
function onSelect(id: string) {
  keyboardMode.value = false
  const node = graph.value.byId.get(id)
  if (!node) { selected.value = hovered.value = ''; cluster.value = ''; return }
  const repeat = selected.value === id
  pin(node)
  if (node.kind !== 'article') focusNode(node)
  else if (repeat) activate(node)
}
function reset() {
  query.value = cluster.value = hovered.value = selected.value = ''
  engine?.fit()
}
function chooseCluster(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  const node = sectionNodes.value.find(node => node.value === id)
  if (node) focusNode(node)
  else reset()
}
function chooseDirectory(event: Event) {
  const node = graph.value.byId.get((event.target as HTMLSelectElement).value)
  if (node) focusNode(node)
}
function chooseResult(node = visibleMatches.value[resultIndex.value]) {
  if (!node) return
  focusNode(node)
  dismissCommand()
  navigator.value?.focus({ preventScroll: true })
}
function searchKey(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !visibleMatches.value.length) return
  event.preventDefault()
  resultIndex.value = (resultIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + visibleMatches.value.length) % visibleMatches.value.length
  nextTick(() => document.getElementById(`${uid}-result-${resultIndex.value}`)?.scrollIntoView({ block: 'nearest' }))
}
function cycleLabels() {
  labelMode.value = labelMode.value === 'auto' ? 'all' : labelMode.value === 'all' ? 'quiet' : 'auto'
}
function catalogUrl(node: GraphNode) {
  return withBase(node.kind === 'tag' ? `/tags#${encodeURIComponent(node.value)}` : `/tags?section=${encodeURIComponent(node.value)}`)
}
function navigateStars(event: KeyboardEvent) {
  const nodes = graph.value.nodes
  if (!nodes.length) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const node = active.value || sectionNodes.value[0] || nodes[0]
    activate(node)
    return
  }
  if (event.key === '+' || event.key === '=' || event.key === '-') {
    event.preventDefault()
    engine?.zoom(event.key === '-' ? 1 / 1.4 : 1.4)
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  keyboardMode.value = true
  const origin = active.value
  let next: GraphNode | undefined
  if (event.key === 'Home' || !origin) next = sectionNodes.value[0] || nodes[0]
  else if (event.key === 'End') next = nodes[nodes.length - 1]
  else {
    const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    let best = Infinity
    for (const node of nodes) {
      const x = node.x - origin.x, y = node.y - origin.y
      const forward = x * dx + y * dy
      if (forward <= 0) continue
      const sideways = Math.abs(x * dy - y * dx)
      const score = Math.hypot(x, y) + sideways * 1.8
      if (score < best) { best = score; next = node }
    }
    // At the edge, continue through the catalog so every node remains reachable.
    next ||= nodes[(nodes.indexOf(origin) + 1) % nodes.length]
  }
  if (next) { pin(next); engine?.focus(next.id) }
}
function keyboardShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return
  const target = event.target as HTMLElement | null
  const editing = !!target?.closest('input, textarea, select, [contenteditable="true"]')
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (commandOpen.value) dismissCommand()
    else emit('close')
  } else if (!editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (event.key === '/') { event.preventDefault(); void revealCommand(true) }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset() }
  }
}

watch(active, node => engine?.setActive(node?.id || ''))
watch(matchedIds, ids => { resultIndex.value = 0; engine?.setMatches(ids) })
watch(labelMode, mode => engine?.setLabels(mode))
watch([visualStyle, cosmic, isDark], () => engine?.setPalette(visualStyle.value.id, cosmic.value, isDark.value))
watch(graph, current => {
  if (!current.byId.has(selected.value)) selected.value = ''
  if (!current.byId.has(hovered.value)) hovered.value = ''
  engine?.setGraph(current.nodes, current.links)
  engine?.setMatches(matchedIds.value)
})
onMounted(() => {
  try {
    engine = createAtlasEngine({ canvas: canvas.value!, nebula: nebula.value!, nodes: graph.value.nodes, links: graph.value.links, onHover, onSelect })
    engine.setPalette(visualStyle.value.id, cosmic.value, isDark.value)
  } catch (error) {
    console.warn('Seagull Atlas: Canvas unavailable; using the accessible catalog.', error)
    renderError.value = true
    commandOpen.value = true
  }
  wake()
  window.addEventListener('keydown', keyboardShortcut, true)
})
onBeforeUnmount(() => {
  engine?.dispose()
  clearTimeout(idleTimer)
  clearTimeout(hideTimer)
  clearTimeout(hoverTimer)
  window.removeEventListener('keydown', keyboardShortcut, true)
})
</script>

<template>
  <section ref="root" class="knowledge-atlas" :class="{ 'is-idle': idle, 'theme-surface': !cosmic, 'keyboard-mode': keyboardMode }"
    :data-style="visualStyle.id" aria-label="知识星图 · Seagull Atlas" @pointermove="stagePointer">
    <canvas ref="nebula" class="atlas-nebula" aria-hidden="true"></canvas>
    <canvas ref="canvas" class="atlas-stars" aria-hidden="true" @pointerdown="dismissCommand(false)"></canvas>
    <div ref="navigator" class="atlas-navigator" tabindex="0" role="group" aria-label="探索知识星图"
      :aria-describedby="`${uid}-instructions ${uid}-current`" @keydown="navigateStars" @focus="keyboardMode = true"></div>
    <p :id="`${uid}-instructions`" class="atlas-sr-only">方向键选择星体，回车打开文章或聚焦星团，加减号缩放，R 复位，斜杠搜索，Esc 关闭。指挥栏的星体目录可浏览所有节点。</p>
    <p :id="`${uid}-current`" class="atlas-sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <div class="atlas-corners" @pointerenter="wake">
      <button type="button" class="atlas-corner" aria-label="打开星图指挥栏与搜索" :aria-expanded="commandOpen"
        :aria-controls="`${uid}-command`" title="搜索与星图指挥栏 (/)" @click="commandOpen ? dismissCommand() : revealCommand(true)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></svg>
      </button>
      <button type="button" class="atlas-corner" aria-label="关闭全屏图谱" title="关闭 (Esc)" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>
      </button>
    </div>

    <Transition name="atlas-mist">
      <aside v-if="commandOpen" :id="`${uid}-command`" ref="command" class="atlas-command" aria-label="星图指挥栏"
        @pointerenter="cancelHide" @pointerleave="scheduleHide" @focusin="cancelHide" @focusout="scheduleHide">
        <div class="atlas-command-heading"><span>知识星图 <i>Seagull Atlas</i></span><button type="button" aria-label="收起指挥栏" @click="dismissCommand()">收起</button></div>
        <form class="atlas-search" role="search" @submit.prevent="chooseResult()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></svg>
          <input ref="search" v-model="query" type="search" placeholder="寻找一颗知识星辰" aria-label="搜索文章、主题或栏目" role="combobox"
            autocomplete="off" :aria-expanded="!!query.trim()" :aria-controls="`${uid}-results`" aria-autocomplete="list"
            :aria-activedescendant="visibleMatches.length ? `${uid}-result-${resultIndex}` : undefined" @keydown="searchKey" />
          <kbd>/</kbd>
        </form>
        <template v-if="query.trim()">
          <p class="atlas-result-count" role="status">{{ matches.length ? `${matches.length} 颗星体${matches.length > 24 ? '，显示前 24 项；可继续输入缩小范围' : ''}` : '没有找到，试试文章名或主题词。' }}</p>
          <ul :id="`${uid}-results`" class="atlas-results" role="listbox" aria-label="搜索结果">
            <li v-for="(node, index) in visibleMatches" :id="`${uid}-result-${index}`" :key="node.id" role="option" :aria-selected="index === resultIndex"
              @pointermove="resultIndex = index" @mousedown.prevent @click="chooseResult(node)"><span>{{ node.label }}</span><small>{{ kinds[node.kind] }}</small></li>
          </ul>
        </template>
        <div class="atlas-command-controls">
          <label class="atlas-cluster"><span>星团</span><select :value="cluster" aria-label="按栏目聚焦星团" @change="chooseCluster"><option value="">全站星图</option><option v-for="node in sectionNodes" :key="node.id" :value="node.value">{{ node.label }}</option></select></label>
          <button type="button" :aria-label="`标签密度：${labelName}`" @click="cycleLabels">{{ labelName }}</button>
          <button type="button" :aria-pressed="!cosmic" aria-label="切换星穹或主题底色" @click="cosmic = !cosmic">{{ cosmic ? '星穹底色' : '主题底色' }}</button>
          <button type="button" title="复位视图 (R)" @click="reset">复位</button>
        </div>
        <details class="atlas-directory">
          <summary>星体目录 <span>{{ graph.nodes.length }}</span></summary>
          <label><span class="atlas-sr-only">选择任意星体</span><select :value="selected" aria-label="星体目录" @change="chooseDirectory"><option value="" disabled>选择星体并定位</option><optgroup v-for="group in directory" :key="group.kind" :label="kinds[group.kind]"><option v-for="node in group.nodes" :key="node.id" :value="node.id">{{ node.label }}</option></optgroup></select></label>
          <button v-if="active" type="button" @click="activate(active)">{{ active.kind === 'article' ? '前往阅读' : '聚焦星团' }}</button>
        </details>
        <p v-if="renderError" class="atlas-fallback">当前浏览器无法绘制星空，可通过搜索或星体目录继续阅读。</p>
      </aside>
    </Transition>

    <Transition name="atlas-card">
      <aside v-if="active" class="atlas-card" aria-label="星体详情" @pointerenter="holdCard" @pointerleave="releaseCard" @focusin="holdCard" @focusout="releaseCard">
        <div class="atlas-card-copy"><small>{{ kinds[active.kind] }} <span>·</span> {{ degree }} 个关联</small><strong>{{ active.label }}</strong></div>
        <div class="atlas-card-actions">
          <a v-if="active.kind === 'article'" :href="withBase(active.value)" @click="emit('close')">前往阅读 <span aria-hidden="true">↗</span></a>
          <template v-else><button type="button" @click="focusNode(active)">聚焦星团</button><a :href="catalogUrl(active)" @click="emit('close')">目录查看 <span aria-hidden="true">↗</span></a></template>
          <button v-if="selected" class="atlas-unpin" type="button" aria-label="取消选中星体" @click="selected = hovered = ''">×</button>
        </div>
      </aside>
    </Transition>
    <p v-if="!active && !commandOpen" class="atlas-whisper" :class="{ 'has-faded': !hintVisible }" aria-hidden="true"><span class="atlas-desktop-hint">拖动漫游 · 滚动靠近 · / 寻星</span><span class="atlas-touch-hint">轻触星辰 · 双指靠近</span></p>
    <p v-if="!graph.nodes.length" class="atlas-empty" role="status">这里还没有知识星体。</p>
  </section>
</template>

<style scoped>
.knowledge-atlas { --atlas-ink: #d9e4e6; --atlas-muted: #a6b9bf; --atlas-panel: rgb(9 17 24 / .78); --atlas-glint: #b5d4ce; position: relative; isolation: isolate; width: 100%; height: 100%; overflow: hidden; background: #050a10; color: var(--atlas-ink); font-family: var(--vp-font-family-base); }
.knowledge-atlas[data-style='pixel-voyage'] { --atlas-glint: #bdcedf; --atlas-panel: rgb(10 15 25 / .8); }
.knowledge-atlas[data-style='along-the-way'] { --atlas-glint: #d7c6ae; --atlas-panel: rgb(19 19 17 / .8); }
.knowledge-atlas[data-style='grace-archive'] { --atlas-glint: #d5c8a5; --atlas-panel: rgb(18 18 17 / .8); }
.knowledge-atlas.theme-surface { --atlas-ink: var(--vp-c-text-1); --atlas-muted: var(--vp-c-text-2); --atlas-glint: var(--vp-c-brand-1); --atlas-panel: color-mix(in srgb, var(--vp-c-bg) 88%, transparent); background: var(--vp-c-bg); }
.atlas-nebula, .atlas-stars, .atlas-navigator { position: absolute; inset: 0; width: 100%; height: 100%; }
.atlas-nebula { pointer-events: none; }
.atlas-stars { touch-action: none; cursor: grab; }
.atlas-stars:active { cursor: grabbing; }
.atlas-navigator { pointer-events: none; outline: none; }
.atlas-navigator:focus-visible { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--atlas-glint) 45%, transparent); }
.atlas-corners { position: absolute; top: max(18px, env(safe-area-inset-top)); right: max(20px, env(safe-area-inset-right)); display: flex; gap: 4px; z-index: 3; }
.atlas-corner { width: 44px; height: 44px; display: grid; place-items: center; color: var(--atlas-ink); opacity: .55; border-radius: 50%; transition: opacity 1.6s, background .3s; }
.is-idle .atlas-corner { opacity: .16; }
.atlas-corner:hover, .atlas-corner:focus-visible { opacity: 1; background: color-mix(in srgb, var(--atlas-ink) 8%, transparent); }
.atlas-corner svg, .atlas-search svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: 1.15; fill: none; }
.atlas-command { position: absolute; top: max(24px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); width: min(590px, calc(100% - 160px)); max-height: calc(100dvh - 120px); overflow-y: auto; overscroll-behavior: contain; z-index: 4; padding: 22px 26px 14px; border-radius: 12px; background: var(--atlas-panel); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); box-shadow: 0 20px 70px rgb(0 0 0 / .12); }
.atlas-command-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--atlas-muted); }
.atlas-command-heading i { margin-left: 8px; font-family: Georgia, 'Times New Roman', serif; font-weight: 400; }
.atlas-command-heading button { font-size: 11px; padding: 7px 0 7px 12px; }
.atlas-search { display: flex; align-items: center; gap: 12px; margin-top: 13px; padding-bottom: 13px; border-bottom: 1px solid color-mix(in srgb, var(--atlas-muted) 20%, transparent); }
.atlas-search svg { flex: none; color: var(--atlas-muted); }
.atlas-search input { min-width: 0; flex: 1; width: 100%; height: 36px; background: transparent; color: var(--atlas-ink); border: 0; border-radius: 0; font-size: 16px; }
.atlas-search input::placeholder { color: var(--atlas-muted); opacity: .8; }
.atlas-search kbd { color: var(--atlas-muted); font-size: 12px; font-family: inherit; }
.atlas-command-controls { display: flex; align-items: center; flex-wrap: wrap; column-gap: 18px; row-gap: 2px; margin-top: 8px; font-size: 12px; color: var(--atlas-muted); }
.atlas-command-controls button { padding: 10px 0; min-height: 42px; }
.atlas-command-controls button:hover, .atlas-command-heading button:hover { color: var(--atlas-ink); }
.atlas-cluster { display: flex; align-items: center; gap: 8px; }
.atlas-cluster > span { opacity: .7; }
.atlas-cluster select { max-width: 165px; min-height: 42px; padding-right: 2px; background: transparent; color: var(--atlas-ink); border: 0; font: inherit; }
.atlas-command select option, .atlas-command select optgroup { background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.atlas-result-count { margin: 12px 0 6px; font-size: 11px; color: var(--atlas-muted); }
.atlas-results { list-style: none; margin: 0; padding: 0; max-height: min(38dvh, 280px); overflow-y: auto; overscroll-behavior: contain; }
.atlas-results li { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 10px 8px; min-height: 44px; font-size: 13px; cursor: pointer; border-radius: 4px; line-height: 1.55; }
.atlas-results li[aria-selected='true'] { background: color-mix(in srgb, var(--atlas-glint) 10%, transparent); color: var(--atlas-glint); }
.atlas-results small { font-size: 10px; flex: none; color: var(--atlas-muted); }
.atlas-directory { margin-top: 3px; color: var(--atlas-muted); font-size: 11px; }
.atlas-directory summary { cursor: pointer; padding: 9px 0; width: fit-content; }
.atlas-directory summary span { margin-left: 6px; opacity: .65; }
.atlas-directory select { padding: 8px; max-width: 100%; width: 100%; background: transparent; color: var(--atlas-ink); border: 1px solid color-mix(in srgb, var(--atlas-muted) 20%, transparent); border-radius: 4px; font-size: 13px; }
.atlas-directory button { padding: 10px 0; color: var(--atlas-glint); }
.atlas-fallback { font-size: 12px; line-height: 1.7; }
.atlas-card { position: absolute; bottom: max(36px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); width: max-content; max-width: min(480px, calc(100% - 40px)); z-index: 2; padding: 15px 22px 11px; border-radius: 9px; background: var(--atlas-panel); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
.atlas-card-copy small { display: block; color: var(--atlas-muted); font-size: 10px; line-height: 1.6; margin-bottom: 5px; }
.atlas-card-copy small span { padding: 0 5px; }
.atlas-card-copy strong { display: block; font-weight: 400; font-size: 14px; line-height: 1.65; overflow-wrap: anywhere; }
.atlas-card-actions { display: flex; align-items: center; gap: 20px; margin-top: 3px; }
.atlas-card-actions a, .atlas-card-actions button { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; font-size: 11px; text-decoration: none; color: var(--atlas-glint); }
.atlas-card-actions a:hover, .atlas-card-actions button:hover { color: var(--atlas-ink); }
.atlas-card-actions .atlas-unpin { margin-left: auto; padding-left: 8px; font-size: 18px; color: var(--atlas-muted); }
.atlas-whisper { pointer-events: none; position: absolute; left: 0; right: 0; bottom: max(26px, env(safe-area-inset-bottom)); margin: 0; text-align: center; font-size: 10px; letter-spacing: .08em; color: var(--atlas-muted); opacity: .55; transition: opacity 2.4s ease; }
.atlas-whisper.has-faded { opacity: 0; }
.atlas-touch-hint { display: none; }
.atlas-empty { position: absolute; inset: 45% 20px auto; text-align: center; color: var(--atlas-muted); font-size: 13px; }
.atlas-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.knowledge-atlas button:focus-visible, .knowledge-atlas a:focus-visible, .knowledge-atlas input:focus-visible, .knowledge-atlas select:focus-visible, .knowledge-atlas summary:focus-visible { outline: 1px solid var(--atlas-glint); outline-offset: 4px; }
.atlas-mist-enter-active, .atlas-mist-leave-active { transition: opacity .4s ease, translate .4s ease, filter .4s ease; }
.atlas-mist-enter-from, .atlas-mist-leave-to { opacity: 0; translate: 0 -8px; filter: blur(5px); }
.atlas-card-enter-active, .atlas-card-leave-active { transition: opacity .3s ease, translate .3s ease; }
.atlas-card-enter-from, .atlas-card-leave-to { opacity: 0; translate: 0 6px; }
@media (max-width: 680px) { .atlas-corners { top: max(10px, env(safe-area-inset-top)); right: max(10px, env(safe-area-inset-right)); } .atlas-command { top: max(65px, calc(env(safe-area-inset-top) + 55px)); width: calc(100% - 24px); padding: 16px 18px 12px; max-height: calc(100dvh - 95px); } .atlas-command-controls { column-gap: 16px; } .atlas-card { bottom: max(24px, env(safe-area-inset-bottom)); padding: 13px 18px 9px; } .atlas-card-actions a, .atlas-card-actions button { min-height: 44px; } }
@media (pointer: coarse) { .atlas-touch-hint { display: inline; } .atlas-desktop-hint { display: none; } .is-idle .atlas-corner { opacity: .32; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
</style>
