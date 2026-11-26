<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter, withBase } from 'vitepress'
import { pointer, select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { data, type GraphNode } from '../data/knowledge-graph.data'
import { fold, sections, type ContentEntry } from '../content-catalog'
import { useVisualStyle } from '../theme/visual-styles'

const props = withDefaults(defineProps<{
  pages: ContentEntry[]
  fullscreen?: boolean
  showFullscreenButton?: boolean
}>(), {
  fullscreen: false,
  showFullscreenButton: false,
})
const emit = defineEmits<{
  tag: [value: string]
  section: [value: string]
  close: []
  expand: []
}>()

const router = useRouter()
const visualStyle = useVisualStyle()
const kinds = { article: '文章', tag: '主题', section: '栏目' }
const byId = new Map(data.nodes.map(node => [node.id, node]))

const searchText = ref('')
const clusterSection = ref('')
const showAllLabels = ref(false)
const cosmicSurface = ref(true)

const activePages = computed(() => {
  if (!props.fullscreen || !clusterSection.value) return props.pages
  return props.pages.filter(page => page.section === clusterSection.value)
})

const graph = computed(() => {
  const urls = new Set(activePages.value.map(page => page.url))
  const articles = data.nodes.filter(node => node.kind === 'article' && urls.has(node.value))
  const visible = new Set(articles.map(node => node.id))
  const neighbors = new Map<string, Set<string>>(articles.map(node => [node.id, new Set()]))
  const links = data.links.filter(link => visible.has(link.source) || visible.has(link.target)).map(link => {
    const source = byId.get(link.source)!, target = byId.get(link.target)!
    for (const [from, to] of [[source, target], [target, source]]) {
      if (!neighbors.has(from.id)) neighbors.set(from.id, new Set())
      neighbors.get(from.id)!.add(to.id)
    }
    return { source, target }
  })
  const nodes = data.nodes.filter(node => neighbors.has(node.id))
  const tags = nodes.filter(node => node.kind === 'tag')
    .sort((a, b) => neighbors.get(b.id)!.size - neighbors.get(a.id)!.size)
  const core = new Set([
    ...nodes.filter(node => node.kind === 'section').map(node => node.id),
    ...tags.slice(0, props.fullscreen ? 10 : 6).map(tag => tag.id),
  ])
  const stats = {
    articles: articles.length,
    tags: tags.length,
    sections: nodes.filter(node => node.kind === 'section').length,
  }
  return { nodes, links, neighbors, core, stats }
})

const availableSections = computed(() => {
  const counts = new Map<string, number>()
  for (const page of props.pages) counts.set(page.section, (counts.get(page.section) || 0) + 1)
  return sections.filter(s => (counts.get(s.id) || 0) > 0).map(s => ({ ...s, count: counts.get(s.id) || 0 }))
})

const searchMatches = computed(() => {
  const q = fold(searchText.value.trim())
  if (!q) return new Set<string>()
  return new Set(graph.value.nodes.filter(node => fold(node.label).includes(q)).map(node => node.id))
})

const svg = ref<SVGSVGElement>()
const viewport = shallowRef({ width: 0, height: 0 })
const camera = shallowRef(zoomIdentity)
const fitScale = ref(1)
const unlocked = ref(props.fullscreen)
const hovered = ref(''), focused = ref(''), pinned = ref('')
const tabNode = ref('')
const active = computed(() => byId.get(hovered.value || focused.value || pinned.value))
const related = computed(() => graph.value.neighbors.get(active.value?.id || ''))
const hasSpotlight = computed(() => !!active.value || searchMatches.value.size > 0)
const markScale = computed(() => Math.min(1.4, Math.max(.55, camera.value.k)))
const nodeRadius = computed(() => props.fullscreen
  ? { article: 4.5, tag: 6, section: 10 }
  : { article: 4, tag: 5, section: 8 })
const keySteps: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
let releaseDrag: (() => void) | undefined
const behavior = zoom<SVGSVGElement, unknown>()
  .clickDistance(5).duration(0)
  .filter(event => event.type === 'touchstart' ? (props.fullscreen || unlocked.value) : !event.button && (!event.ctrlKey || event.type === 'wheel'))
  .on('start.graph', ({ sourceEvent }) => {
    if (sourceEvent?.type !== 'mousedown') return
    const view: Window = sourceEvent.view
    const release = select(view).on('mouseup.zoom')
    if (release) releaseDrag = () => release.call(view, new MouseEvent('mouseup', { view }), undefined)
  })
  .on('end.graph', () => { releaseDrag = undefined })
  .on('zoom.graph', event => { camera.value = event.transform })
let sizeObserver: ResizeObserver
let lastPointer = ''

function fit() {
  if (!svg.value || !graph.value.nodes.length) return
  const { width, height } = viewport.value
  const padX = props.fullscreen ? Math.min(110, width * 0.1) : 40
  const padY = props.fullscreen ? Math.min(130, height * 0.16) : 40
  const xs = graph.value.nodes.map(node => node.x), ys = graph.value.nodes.map(node => node.y)
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys)
  const scale = Math.min(props.fullscreen ? 2.4 : 2, (width - padX) / Math.max(1, right - left), (height - padY) / Math.max(1, bottom - top))
  if (scale <= 0) return
  fitScale.value = scale
  behavior.scaleExtent([scale / 2.2, Math.max(5, scale * 10)])
  const centered = zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-(left + right) / 2, -(top + bottom) / 2)
  select(svg.value).call(behavior.transform, centered)
}
function focusOnNode(node: GraphNode) {
  if (!svg.value) return
  const targetScale = Math.max(camera.value.k, Math.min(2.6, fitScale.value * 2.2))
  const { width, height } = viewport.value
  const next = zoomIdentity.translate(width / 2, height / 2).scale(targetScale).translate(-node.x, -node.y)
  select(svg.value).call(behavior.transform, next)
}
function resize() {
  if (!svg.value) return
  const { width, height } = svg.value.getBoundingClientRect()
  if (!width || !height || (width === viewport.value.width && height === viewport.value.height)) return
  viewport.value = { width, height }
  fit()
}
function scaleBy(factor: number) {
  if (svg.value) select(svg.value).call(behavior.scaleBy, factor)
}
function resetGraph() {
  hovered.value = pinned.value = ''
  if (!graph.value.neighbors.has(focused.value)) focused.value = ''
  tabNode.value = focused.value || graph.value.nodes[0]?.id || ''
  fit()
}
function clearFullscreenFilters() {
  searchText.value = ''
  clusterSection.value = ''
  resetGraph()
}
function selectCluster(id: string) {
  clusterSection.value = clusterSection.value === id ? '' : id
  nextTick(resetGraph)
}
function jumpFirstMatch() {
  const firstId = [...searchMatches.value][0]
  if (!firstId) return
  const node = byId.get(firstId)
  if (!node) return
  pinned.value = node.id
  hovered.value = ''
  focusOnNode(node)
}

watch(graph, resetGraph, { flush: 'post' })
watch(searchMatches, matches => {
  if (!props.fullscreen || !matches.size) return
  if (matches.size === 1) {
    const node = byId.get([...matches][0])
    if (node) {
      pinned.value = node.id
      focusOnNode(node)
    }
  }
})
onMounted(() => {
  select(svg.value!).call(behavior).on('dblclick.zoom', null)
  tabNode.value = graph.value.nodes[0]?.id || ''
  resize()
  sizeObserver = new ResizeObserver(resize)
  sizeObserver.observe(svg.value!)
})
onBeforeUnmount(() => {
  sizeObserver?.disconnect()
  releaseDrag?.()
  behavior.on('.graph', null)
  if (svg.value) select(svg.value).on('.zoom', null)
})

function hit(event: MouseEvent): GraphNode | undefined {
  const target = event.target instanceof Element ? event.target.closest<SVGGElement>('.graph-node') : null
  if (!target || !svg.value) return
  if (event.type === 'click' && !event.detail) return byId.get(target.dataset.id!)
  const [x, y] = camera.value.invert(pointer(event, svg.value))
  let best: GraphNode | undefined, distance = Infinity
  for (const node of graph.value.nodes) {
    const squared = (node.x - x) ** 2 + (node.y - y) ** 2
    if (squared < distance) { best = node; distance = squared }
  }
  return best
}
function hover(event: PointerEvent) {
  if (event.pointerType === 'mouse' && !event.buttons) hovered.value = hit(event)?.id || ''
}
function openNode(node: GraphNode) {
  if (node.kind === 'article') {
    if (props.fullscreen) emit('close')
    void router.go(withBase(node.value))
  } else if (props.fullscreen) {
    if (node.kind === 'section') {
      selectCluster(node.value)
    } else {
      pinned.value = node.id
      focusOnNode(node)
    }
  } else if (node.kind === 'tag') {
    emit('tag', node.value)
  } else {
    emit('section', node.value)
  }
}
function openInCatalog(node: GraphNode) {
  if (props.fullscreen) emit('close')
  if (node.kind === 'tag') {
    void router.go(withBase(`/tags#${encodeURIComponent(node.value)}`))
  } else if (node.kind === 'section') {
    void router.go(withBase(`/tags?section=${encodeURIComponent(node.value)}`))
  }
}
function clickNode(event: MouseEvent) {
  const node = hit(event)
  if (!node) { pinned.value = hovered.value = focused.value = ''; return }
  tabNode.value = node.id
  if ((lastPointer === 'touch' || window.matchMedia('(hover: none)').matches) && pinned.value !== node.id) {
    hovered.value = focused.value = ''
    pinned.value = node.id
  } else openNode(node)
}
function keyNode(event: KeyboardEvent, node: GraphNode) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openNode(node)
    return
  }
  const direction = keySteps[event.key]
  if (!direction || !svg.value) return
  event.preventDefault()
  const nodes = graph.value.nodes
  const next = nodes[(nodes.indexOf(node) + direction + nodes.length) % nodes.length]
  const [x, y] = camera.value.apply([next.x, next.y])
  if (x < 12 || y < 12 || x > viewport.value.width - 12 || y > viewport.value.height - 12)
    select(svg.value).call(behavior.translateTo, next.x, next.y)
  svg.value.querySelector<SVGGElement>(`[data-id="${CSS.escape(next.id)}"]`)?.focus({ preventScroll: true })
}
function focusNode(node: GraphNode) {
  hovered.value = ''
  focused.value = tabNode.value = node.id
}
function isNodeHighlighted(node: GraphNode) {
  if (active.value) return active.value === node || !!related.value?.has(node.id)
  if (searchMatches.value.size) return searchMatches.value.has(node.id)
  return false
}
function isNodeMuted(node: GraphNode) {
  if (!hasSpotlight.value) return false
  return !isNodeHighlighted(node)
}
function isEdgeRelated(source: GraphNode, target: GraphNode) {
  if (active.value) return active.value === source || active.value === target
  if (searchMatches.value.size) return searchMatches.value.has(source.id) || searchMatches.value.has(target.id)
  return false
}

const labels = computed(() => {
  const { nodes, core } = graph.value
  const { width, height } = viewport.value
  const expanded = showAllLabels.value || camera.value.k > Math.min(1.2, fitScale.value * 1.65)
  const priority = (node: GraphNode) =>
    node.id === active.value?.id ? 4
      : searchMatches.value.has(node.id) ? 3
        : core.has(node.id) ? 2
          : related.value?.has(node.id) ? 1 : 0
  const candidates = nodes
    .filter(node => expanded || priority(node) >= 2)
    .sort((a, b) => priority(b) - priority(a))
  const placed: { id: string; text: string; x: number; y: number; end: number; kind: GraphNode['kind'] }[] = []
  for (const node of candidates) {
    const [cx, cy] = camera.value.apply([node.x, node.y])
    if (cx < 0 || cx > width || cy < 8 || cy > height - 8) continue
    const maxLen = props.fullscreen ? 20 : 16
    const text = node.label.length > maxLen ? node.label.slice(0, maxLen - 1) + '…' : node.label
    const span = Array.from(text).reduce((sum, c) => sum + (c.charCodeAt(0) < 128 ? 7 : 12), 0)
    const gap = nodeRadius.value[node.kind] * markScale.value + 5
    const x = cx + gap + span <= width - 4 ? cx + gap : Math.max(4, cx - gap - span)
    if (placed.some(other => Math.abs(other.y - cy) < 16 && x < other.end + 5 && x + span + 5 > other.x)) continue
    placed.push({ id: node.id, text, x, y: cy, end: x + span, kind: node.kind })
  }
  return placed
})
</script>

<template>
  <section class="knowledge-graph"
    :class="{ 'is-fullscreen': fullscreen, 'is-cosmic': fullscreen && cosmicSurface }"
    :data-style="visualStyle.id"
    aria-label="知识图谱">
    <div v-if="fullscreen" class="cosmic-backdrop" aria-hidden="true">
      <div class="cosmic-nebula nebula-a"></div>
      <div class="cosmic-nebula nebula-b"></div>
      <div class="cosmic-grid"></div>
    </div>

    <!-- 顶部栏：全屏为悬浮玻璃 HUD，嵌入模式为简洁工具栏 -->
    <div class="graph-toolbar" :class="{ 'hud-top': fullscreen }">
      <div v-if="fullscreen" class="hud-brand">
        <span class="hud-badge" aria-hidden="true"></span>
        <div>
          <strong>知识星图 · Seagull Atlas</strong>
          <small>{{ graph.stats.articles }} 篇文章 · {{ graph.stats.tags }} 个主题 · {{ graph.stats.sections }} 个栏目</small>
        </div>
      </div>
      <div v-else class="graph-legend" aria-label="图例">
        <span v-for="(label, kind) in kinds" :key="kind"><i :class="kind" aria-hidden="true"></i>{{ label }}</span>
      </div>

      <form v-if="fullscreen" class="hud-search" role="search" @submit.prevent="jumpFirstMatch">
        <input v-model="searchText" type="search" aria-label="在星图中搜索节点" placeholder="搜索文章、主题或栏目，回车飞镜定位…" />
        <span v-if="searchText.trim()" class="hud-match-count">{{ searchMatches.size }} 匹配</span>
      </form>

      <div class="graph-tools">
        <button v-if="fullscreen" type="button" :aria-pressed="showAllLabels" title="切换显示全部标签" @click="showAllLabels = !showAllLabels">标签</button>
        <button v-if="fullscreen" type="button" :aria-pressed="cosmicSurface" title="切换星穹深色 / 跟随主题底色" @click="cosmicSurface = !cosmicSurface">{{ cosmicSurface ? '星穹' : '主题' }}</button>
        <button type="button" aria-label="缩小图谱" title="缩小图谱" @click="scaleBy(1 / 1.5)">−</button>
        <button type="button" aria-label="放大图谱" title="放大图谱" @click="scaleBy(1.5)">+</button>
        <button type="button" aria-label="复位图谱" title="复位图谱" @click="fullscreen ? clearFullscreenFilters() : resetGraph()">复位</button>
        <button v-if="!fullscreen && showFullscreenButton" type="button" class="graph-expand" aria-label="全屏探索知识图谱" title="全屏探索知识图谱" @click="emit('expand')">全屏</button>
        <button v-if="!fullscreen" type="button" class="graph-lock" :aria-pressed="unlocked" @click="unlocked = !unlocked">{{ unlocked ? '锁定交互' : '解锁交互' }}</button>
        <button v-if="fullscreen" type="button" class="hud-close" aria-label="关闭全屏图谱" title="关闭 (Esc)" @click="emit('close')">✕</button>
      </div>
    </div>

    <!-- 全屏栏目星团快速聚焦栏 -->
    <div v-if="fullscreen" class="hud-clusters" role="group" aria-label="按栏目聚焦星团">
      <button type="button" :aria-pressed="!clusterSection" @click="selectCluster('')">全站星图</button>
      <button v-for="sec in availableSections" :key="sec.id" type="button" :aria-pressed="clusterSection === sec.id" @click="selectCluster(sec.id)">
        {{ sec.title }}<span>{{ sec.count }}</span>
      </button>
    </div>

    <svg ref="svg" class="graph-canvas" :class="{ unlocked: fullscreen || unlocked }" role="group" aria-label="关系图。方向键浏览节点，回车打开。"
      :viewBox="viewport.width ? `0 0 ${viewport.width} ${viewport.height}` : undefined" @pointerdown.capture="lastPointer = $event.pointerType"
      @pointermove="hover" @pointerleave="hovered = ''" @click="clickNode">
      <defs v-if="fullscreen">
        <filter id="kg-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="kg-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--kg-accent)" stop-opacity="0.48" />
          <stop offset="65%" stop-color="var(--kg-accent)" stop-opacity="0.12" />
          <stop offset="100%" stop-color="var(--kg-accent)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <g class="graph-world" :transform="camera.toString()">
        <g aria-hidden="true">
          <line v-for="{source, target} in graph.links" :key="source.id + '|' + target.id" class="graph-edge"
            :data-source="source.id" :data-target="target.id" :x1="source.x" :y1="source.y" :x2="target.x" :y2="target.y"
            :class="{
              'is-related': isEdgeRelated(source, target),
              'is-muted': hasSpotlight && !isEdgeRelated(source, target)
            }" />
        </g>
        <g v-for="node in graph.nodes" :key="node.id" class="graph-node" :data-id="node.id" :data-kind="node.kind" :data-value="node.value"
          :class="{
            'is-active': active === node || searchMatches.has(node.id),
            'is-related': isNodeHighlighted(node),
            'is-muted': isNodeMuted(node)
          }"
          :transform="`translate(${node.x} ${node.y}) scale(${1 / camera.k})`" :tabindex="tabNode === node.id ? 0 : -1"
          :role="node.kind === 'article' ? 'link' : 'button'" :aria-label="`${kinds[node.kind]}，${node.label}`"
          @focus="focusNode(node)" @blur="focused = ''" @keydown="keyNode($event, node)">
          <circle r="11" class="graph-hit" />
          <g :transform="`scale(${markScale})`">
            <circle v-if="fullscreen && (active === node || searchMatches.has(node.id))" class="active-halo" :r="nodeRadius[node.kind] + 10" fill="url(#kg-halo)" />
            <circle v-if="fullscreen && node.kind === 'section'" class="section-orbit" :r="nodeRadius.section + 4.5" />
            <path v-if="node.kind === 'tag'" class="graph-mark tag" :d="fullscreen ? 'M0 -6.5 6.5 0 0 6.5 -6.5 0Z' : 'M0 -5 5 0 0 5 -5 0Z'" />
            <circle v-else :class="['graph-mark', node.kind]" :r="nodeRadius[node.kind]" />
          </g>
        </g>
      </g>
      <g class="graph-labels" aria-hidden="true">
        <text v-for="label in labels" :key="label.id" class="graph-label"
          :class="[`kind-${label.kind}`, { 'is-muted': hasSpotlight && !isNodeHighlighted(byId.get(label.id)!) }]"
          :x="label.x" :y="label.y" dominant-baseline="central">{{ label.text }}</text>
      </g>
    </svg>

    <div class="graph-info" :class="{ 'hud-bottom': fullscreen }">
      <template v-if="active">
        <div class="info-copy">
          <small>{{ kinds[active.kind] }} · {{ related?.size }} 个关联</small>
          <strong>{{ active.label }}</strong>
        </div>
        <div class="info-actions">
          <a v-if="active.kind === 'article'" class="info-primary" :href="withBase(active.value)" @click="fullscreen && emit('close')">前往阅读 →</a>
          <template v-else-if="fullscreen">
            <button type="button" class="info-primary" @click="openNode(active)">{{ active.kind === 'section' ? (clusterSection === active.value ? '返回全站星图' : '聚焦此星团') : '居中定位' }}</button>
            <button type="button" class="info-secondary" @click="openInCatalog(active)">在目录查看</button>
          </template>
          <button v-else type="button" class="info-primary" @click="openNode(active)">{{ active.kind === 'tag' ? '按此主题筛选' : '按此栏目筛选' }}</button>
        </div>
      </template>
      <template v-else>
        <div class="info-legend-inline" v-if="fullscreen">
          <span v-for="(label, kind) in kinds" :key="kind"><i :class="kind" aria-hidden="true"></i>{{ label }}</span>
        </div>
        <span class="graph-desktop-tip">{{ fullscreen ? '滚轮缩放、拖拽漫游、悬停点亮星轨，点击文章直达。' : '悬停查看关联，点击节点打开。' }}</span>
        <span class="graph-touch-tip">轻点查看关联，再点同一节点打开。</span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.knowledge-graph {
  --kg-accent: var(--vp-c-brand-1);
  --kg-accent-2: var(--vp-c-brand-2, var(--vp-c-brand-1));
  --kg-surface: var(--vp-c-bg);
  --kg-panel: var(--vp-c-bg);
  --kg-border: var(--vp-c-divider);
  --kg-text: var(--vp-c-text-1);
  --kg-muted: var(--vp-c-text-2);
  --kg-edge: var(--vp-c-divider);
  --kg-article: var(--vp-c-text-2);
  --kg-section-fill: var(--vp-c-bg);
  --kg-section-stroke: var(--vp-c-text-1);
  position: relative;
  min-width: 0;
  overflow: hidden;
  margin-block: 12px 24px;
  border: 1px solid var(--kg-border);
  border-radius: 8px;
  background: var(--kg-surface);
  color: var(--kg-text);
}

/* 全屏星图模式 */
.knowledge-graph.is-fullscreen {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  border-radius: 0;
  isolation: isolate;
}
.knowledge-graph.is-cosmic {
  --kg-surface: #070b14;
  --kg-panel: rgba(13, 19, 34, 0.72);
  --kg-border: rgba(148, 163, 184, 0.2);
  --kg-text: #f1f5f9;
  --kg-muted: #94a3b8;
  --kg-edge: rgba(148, 163, 184, 0.22);
  --kg-article: #cbd5e1;
  --kg-section-fill: #0b1326;
  --kg-section-stroke: #f8fafc;
  --kg-accent: #38bdf8;
  --kg-accent-2: #2dd4bf;
}
.knowledge-graph.is-cosmic[data-style='pixel-voyage'] {
  --kg-accent: #60a5fa;
  --kg-accent-2: #fbbf24;
}
.knowledge-graph.is-cosmic[data-style='along-the-way'] {
  --kg-accent: #5eead4;
  --kg-accent-2: #f59e0b;
}
.knowledge-graph.is-cosmic[data-style='grace-archive'] {
  --kg-surface: #0b0a08;
  --kg-panel: rgba(24, 20, 15, 0.76);
  --kg-border: rgba(214, 199, 160, 0.24);
  --kg-edge: rgba(214, 199, 160, 0.18);
  --kg-accent: #eab308;
  --kg-accent-2: #93c5fd;
  --kg-section-fill: #17130d;
  --kg-section-stroke: #fef08a;
}

.cosmic-backdrop { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.cosmic-nebula {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.22;
}
.knowledge-graph:not(.is-cosmic) .cosmic-nebula { opacity: 0.08; }
.nebula-a {
  width: 56vw; height: 56vw; max-width: 720px; max-height: 720px;
  top: -18%; left: -10%;
  background: radial-gradient(circle, var(--kg-accent) 0%, transparent 70%);
}
.nebula-b {
  width: 52vw; height: 52vw; max-width: 680px; max-height: 680px;
  right: -12%; bottom: -20%;
  background: radial-gradient(circle, var(--kg-accent-2) 0%, transparent 70%);
}
.cosmic-grid {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--kg-text) 14%, transparent) 1px, transparent 0);
  background-size: 32px 32px;
  opacity: 0.45;
  mask-image: radial-gradient(ellipse at center, #000 35%, transparent 90%);
}

.graph-toolbar, .graph-info {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px 12px; padding: 8px 12px;
}
.graph-toolbar { border-bottom: 1px solid var(--kg-border); }
.graph-toolbar.hud-top {
  position: absolute; top: 14px; left: 16px; right: 16px; z-index: 3;
  padding: 10px 14px; border: 1px solid var(--kg-border); border-radius: 14px;
  background: var(--kg-panel);
  backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.26);
}
.hud-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.hud-badge {
  width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: var(--kg-accent);
  box-shadow: 0 0 12px var(--kg-accent), 0 0 24px var(--kg-accent-2);
}
.hud-brand strong { display: block; font-size: 14px; letter-spacing: 0.02em; color: var(--kg-text); line-height: 1.3; }
.hud-brand small { display: block; font-size: 11px; color: var(--kg-muted); }

.hud-search {
  position: relative; flex: 1 1 220px; max-width: 380px; display: flex; align-items: center;
}
.hud-search input {
  width: 100%; min-height: 36px; padding: 6px 68px 6px 12px;
  border: 1px solid var(--kg-border); border-radius: 999px;
  background: color-mix(in srgb, var(--kg-surface) 72%, transparent);
  color: var(--kg-text); font-size: 13px;
}
.hud-search input::placeholder { color: var(--kg-muted); }
.hud-search input:focus { outline: none; border-color: var(--kg-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--kg-accent) 24%, transparent); }
.hud-match-count {
  position: absolute; right: 12px; font-size: 11px; color: var(--kg-accent); pointer-events: none;
}

.hud-clusters {
  position: absolute; top: 76px; left: 16px; right: 16px; z-index: 2;
  display: flex; align-items: center; gap: 6px;
  overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: none;
  pointer-events: none;
}
.hud-clusters::-webkit-scrollbar { display: none; }
.hud-clusters button {
  pointer-events: auto;
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; border: 1px solid var(--kg-border); border-radius: 999px;
  background: var(--kg-panel); backdrop-filter: blur(12px);
  color: var(--kg-muted); font-size: 12px; transition: border-color .16s, color .16s, background-color .16s;
}
.hud-clusters button span { font-size: 10px; opacity: 0.72; }
.hud-clusters button:hover { color: var(--kg-text); border-color: color-mix(in srgb, var(--kg-accent) 55%, var(--kg-border)); }
.hud-clusters button[aria-pressed='true'] {
  color: var(--kg-accent);
  border-color: var(--kg-accent);
  background: color-mix(in srgb, var(--kg-accent) 16%, var(--kg-panel));
  box-shadow: 0 0 14px color-mix(in srgb, var(--kg-accent) 24%, transparent);
}

.graph-legend, .graph-tools, .graph-legend span, .info-legend-inline, .info-legend-inline span {
  display: flex; align-items: center;
}
.graph-legend, .info-legend-inline { gap: 12px; font-size: 12px; color: var(--kg-muted); }
.graph-legend span, .info-legend-inline span { gap: 5px; white-space: nowrap; }
.graph-legend i, .info-legend-inline i { width: 7px; height: 7px; border-radius: 50%; background: var(--kg-article); }
.graph-legend .tag, .info-legend-inline .tag { border-radius: 0; transform: rotate(45deg); background: var(--kg-accent); }
.graph-legend .section, .info-legend-inline .section { width: 10px; height: 10px; border: 2px solid var(--kg-section-stroke); background: var(--kg-section-fill); }

.graph-tools { gap: 4px; margin-inline-start: auto; }
.graph-tools button {
  display: grid; place-items: center; min-width: 32px; min-height: 32px; padding-inline: 8px;
  border: 1px solid transparent; border-radius: 8px; color: var(--kg-muted); font-size: 12px;
  transition: color .15s, background-color .15s, border-color .15s;
}
.graph-tools button:hover, .graph-tools button[aria-pressed='true'] {
  color: var(--kg-accent);
  background: color-mix(in srgb, var(--kg-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--kg-accent) 30%, transparent);
}
.graph-tools button:focus-visible, .graph-info :is(button, a):focus-visible, .hud-clusters button:focus-visible {
  outline: 2px solid var(--kg-accent); outline-offset: 2px;
}
.graph-tools .graph-expand { color: var(--kg-accent); border-color: color-mix(in srgb, var(--kg-accent) 36%, transparent); }
.graph-tools .hud-close { font-size: 15px; color: var(--kg-text); margin-inline-start: 4px; }
.graph-tools .graph-lock { display: none; }

.graph-canvas {
  position: relative; z-index: 1;
  display: block; width: 100%; height: clamp(320px, 54vh, 540px);
  touch-action: pan-y pinch-zoom; cursor: grab;
}
.knowledge-graph.is-fullscreen .graph-canvas {
  flex: 1; height: 100%; touch-action: none;
}
.graph-canvas.unlocked { touch-action: none; }
.graph-canvas:active { cursor: grabbing; }

.graph-edge {
  stroke: var(--kg-edge); stroke-width: 1;
  vector-effect: non-scaling-stroke; pointer-events: none;
  transition: opacity .18s ease-out, stroke .18s ease-out;
}
.graph-edge.is-related {
  stroke: var(--kg-accent); stroke-width: 1.75;
}
.knowledge-graph.is-fullscreen .graph-edge.is-related {
  stroke-dasharray: 6 4;
  animation: kg-flow 1.4s linear infinite;
  filter: drop-shadow(0 0 4px var(--kg-accent));
}
.graph-edge.is-muted { opacity: .14; }

.graph-node { cursor: pointer; outline: none; transition: opacity .18s ease-out; }
.graph-hit { fill: none; pointer-events: all; }
.graph-node:focus-visible .graph-hit, .graph-node.is-active .graph-hit { stroke: var(--kg-accent); stroke-width: 1.5px; }
.graph-mark.article { fill: var(--kg-article); }
.graph-mark.tag { fill: var(--kg-accent); }
.graph-mark.section { fill: var(--kg-section-fill); stroke: var(--kg-section-stroke); stroke-width: 2px; }
.knowledge-graph.is-fullscreen .graph-mark.tag,
.knowledge-graph.is-fullscreen .graph-mark.section,
.knowledge-graph.is-fullscreen .graph-node.is-active .graph-mark {
  filter: url(#kg-glow);
}
.section-orbit {
  fill: none;
  stroke: color-mix(in srgb, var(--kg-accent-2) 65%, transparent);
  stroke-width: 1px;
  stroke-dasharray: 3 3;
  animation: kg-orbit 18s linear infinite;
}
.active-halo {
  pointer-events: none;
  animation: kg-pulse 2s ease-in-out infinite;
}
.graph-node.is-muted, .graph-label.is-muted { opacity: .18; }

.graph-labels { pointer-events: none; }
.graph-label {
  font-size: 11px; font-weight: 550; fill: var(--kg-text);
  stroke: var(--kg-surface); stroke-width: 3px; stroke-linejoin: round; paint-order: stroke;
  transition: opacity .18s ease-out;
}
.knowledge-graph.is-fullscreen .graph-label.kind-section {
  font-size: 12px; font-weight: 650; fill: var(--kg-section-stroke);
}

.graph-info {
  min-height: 58px; border-top: 1px solid var(--kg-border);
  color: var(--kg-muted); font-size: 13px;
}
.graph-info.hud-bottom {
  position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 3;
  max-width: 680px; margin-inline: auto;
  padding: 12px 16px; border: 1px solid var(--kg-border); border-radius: 14px;
  background: var(--kg-panel);
  backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
}
.info-copy { flex: 1 1 180px; min-width: 0; }
.info-copy strong, .info-copy small { display: block; }
.info-copy small { font-size: 11px; color: var(--kg-accent); }
.info-copy strong { color: var(--kg-text); font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
.info-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.info-primary {
  display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px;
  border-radius: 999px; font-size: 12px; font-weight: 600; text-decoration: none;
  color: var(--kg-accent);
  border: 1px solid color-mix(in srgb, var(--kg-accent) 48%, transparent);
  background: color-mix(in srgb, var(--kg-accent) 14%, transparent);
}
.info-primary:hover { background: color-mix(in srgb, var(--kg-accent) 24%, transparent); }
.info-secondary {
  display: inline-flex; align-items: center; min-height: 34px; padding: 0 10px;
  border-radius: 999px; font-size: 12px; color: var(--kg-muted);
  border: 1px solid var(--kg-border);
}
.info-secondary:hover { color: var(--kg-text); border-color: var(--kg-muted); }

.graph-touch-tip { display: none; }

@keyframes kg-flow {
  from { stroke-dashoffset: 20; }
  to { stroke-dashoffset: 0; }
}
@keyframes kg-orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes kg-pulse {
  0%, 100% { opacity: 0.72; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.16); }
}

@media (hover: none), (any-pointer: coarse) {
  .graph-tools .graph-lock { display: block; }
  .graph-tools button { min-height: 38px; min-width: 36px; }
  .graph-hit { r: 16px; }
  .graph-desktop-tip { display: none; }
  .graph-touch-tip { display: inline; }
}
@media (max-width: 720px) {
  .graph-toolbar.hud-top { top: 10px; left: 10px; right: 10px; padding: 8px 10px; }
  .hud-brand small { display: none; }
  .hud-search { order: 3; flex-basis: 100%; max-width: none; }
  .hud-clusters { top: 112px; left: 10px; right: 10px; }
  .graph-info.hud-bottom { left: 10px; right: 10px; bottom: 10px; padding: 10px 12px; }
  .info-legend-inline { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .graph-node, .graph-edge, .graph-label, .section-orbit, .active-halo {
    transition: none; animation: none !important;
  }
}
</style>
