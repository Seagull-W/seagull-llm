<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter, withBase } from 'vitepress'
import { pointer, select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { data, type GraphNode } from '../data/knowledge-graph.data'
import type { ContentEntry } from '../content-catalog'

const props = defineProps<{ pages: ContentEntry[] }>()
const emit = defineEmits<{ tag: [value: string]; section: [value: string] }>()
const router = useRouter()
const kinds = { article: '文章', tag: '主题', section: '栏目' }
const byId = new Map(data.nodes.map(node => [node.id, node]))
const graph = computed(() => {
  const urls = new Set(props.pages.map(page => page.url))
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
  const core = new Set(tags.slice(0, 6).map(tag => tag.id))
  return { nodes, links, neighbors, core }
})

const svg = ref<SVGSVGElement>()
const viewport = shallowRef({ width: 0, height: 0 })
const camera = shallowRef(zoomIdentity)
const fitScale = ref(1)
const unlocked = ref(false)
const hovered = ref(''), focused = ref(''), pinned = ref('')
const tabNode = ref('')
const active = computed(() => byId.get(hovered.value || focused.value || pinned.value))
const related = computed(() => graph.value.neighbors.get(active.value?.id || ''))
const markScale = computed(() => Math.min(1.3, Math.max(.55, camera.value.k)))
const nodeRadius = { article: 4, tag: 5, section: 8 }
const keySteps: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
let releaseDrag: (() => void) | undefined
const behavior = zoom<SVGSVGElement, unknown>()
  .clickDistance(5).duration(0)
  .filter(event => event.type === 'touchstart' ? unlocked.value : !event.button && (!event.ctrlKey || event.type === 'wheel'))
  .on('start.graph', ({ sourceEvent }) => {
    if (sourceEvent?.type !== 'mousedown') return
    // D3 tracks mouse drags on the window until mouseup, even if the graph is unmounted.
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
  const xs = graph.value.nodes.map(node => node.x), ys = graph.value.nodes.map(node => node.y)
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys)
  const scale = Math.min(2, (width - 40) / Math.max(1, right - left), (height - 40) / Math.max(1, bottom - top))
  if (scale <= 0) return
  fitScale.value = scale
  behavior.scaleExtent([scale / 2, Math.max(4, scale * 8)])
  const centered = zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-(left + right) / 2, -(top + bottom) / 2)
  select(svg.value).call(behavior.transform, centered)
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
watch(graph, resetGraph, { flush: 'post' })
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

// Hit areas can overlap in the overview. Resolve a hit to the closest drawn mark.
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
  if (node.kind === 'article') void router.go(withBase(node.value))
  else if (node.kind === 'tag') emit('tag', node.value)
  else emit('section', node.value)
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
const labels = computed(() => {
  const { nodes, core } = graph.value
  const { width, height } = viewport.value
  const expanded = camera.value.k > Math.min(1.2, fitScale.value * 1.7)
  const priority = (node: GraphNode) => node.id === active.value?.id ? 3 : core.has(node.id) ? 2 : related.value?.has(node.id) ? 1 : 0
  const candidates = nodes.filter(node => expanded || priority(node) >= 2).sort((a, b) => priority(b) - priority(a))
  const placed: { id: string; text: string; x: number; y: number; end: number }[] = []
  for (const node of candidates) {
    const [cx, cy] = camera.value.apply([node.x, node.y])
    if (cx < 0 || cx > width || cy < 8 || cy > height - 8) continue
    const text = node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label
    const span = Array.from(text).reduce((sum, c) => sum + (c.charCodeAt(0) < 128 ? 7 : 12), 0)
    const gap = nodeRadius[node.kind] * markScale.value + 4
    const x = cx + gap + span <= width - 3 ? cx + gap : Math.max(3, cx - gap - span)
    if (placed.some(other => Math.abs(other.y - cy) < 16 && x < other.end + 5 && x + span + 5 > other.x)) continue
    placed.push({ id: node.id, text, x, y: cy, end: x + span })
  }
  return placed
})
</script>

<template>
  <section class="knowledge-graph" aria-label="知识图谱">
    <div class="graph-toolbar">
      <div class="graph-legend" aria-label="图例">
        <span v-for="(label, kind) in kinds" :key="kind"><i :class="kind" aria-hidden="true"></i>{{ label }}</span>
      </div>
      <div class="graph-tools">
        <button type="button" aria-label="缩小图谱" title="缩小图谱" @click="scaleBy(1 / 1.5)">−</button>
        <button type="button" aria-label="放大图谱" title="放大图谱" @click="scaleBy(1.5)">+</button>
        <button type="button" aria-label="复位图谱" title="复位图谱" @click="resetGraph">复位</button>
        <button type="button" class="graph-lock" :aria-pressed="unlocked" @click="unlocked = !unlocked">{{ unlocked ? '锁定交互' : '解锁交互' }}</button>
      </div>
    </div>
    <svg ref="svg" class="graph-canvas" :class="{ unlocked }" role="group" aria-label="关系图。方向键浏览节点，回车打开。"
      :viewBox="viewport.width ? `0 0 ${viewport.width} ${viewport.height}` : undefined" @pointerdown.capture="lastPointer = $event.pointerType"
      @pointermove="hover" @pointerleave="hovered = ''" @click="clickNode">
      <g class="graph-world" :transform="camera.toString()">
        <g aria-hidden="true">
          <line v-for="{source, target} in graph.links" :key="source.id + '|' + target.id" class="graph-edge"
            :data-source="source.id" :data-target="target.id" :x1="source.x" :y1="source.y" :x2="target.x" :y2="target.y"
            :class="{ 'is-related': active && (active === source || active === target), 'is-muted': active && active !== source && active !== target }" />
        </g>
        <g v-for="node in graph.nodes" :key="node.id" class="graph-node" :data-id="node.id" :data-kind="node.kind" :data-value="node.value"
          :class="{ 'is-active': active === node, 'is-related': active === node || related?.has(node.id), 'is-muted': active && active !== node && !related?.has(node.id) }"
          :transform="`translate(${node.x} ${node.y}) scale(${1 / camera.k})`" :tabindex="tabNode === node.id ? 0 : -1"
          :role="node.kind === 'article' ? 'link' : 'button'" :aria-label="`${kinds[node.kind]}，${node.label}`"
          @focus="focusNode(node)" @blur="focused = ''" @keydown="keyNode($event, node)">
          <circle r="11" class="graph-hit" />
          <g :transform="`scale(${markScale})`">
            <path v-if="node.kind === 'tag'" class="graph-mark tag" d="M0 -5 5 0 0 5 -5 0Z" />
            <circle v-else :class="['graph-mark', node.kind]" :r="nodeRadius[node.kind]" />
          </g>
        </g>
      </g>
      <g class="graph-labels" aria-hidden="true">
        <text v-for="label in labels" :key="label.id" class="graph-label" :class="{ 'is-muted': active && active.id !== label.id && !related?.has(label.id) }"
          :x="label.x" :y="label.y" dominant-baseline="central">{{ label.text }}</text>
      </g>
    </svg>
    <div class="graph-info">
      <template v-if="active">
        <div><small>{{ kinds[active.kind] }} · {{ related?.size }} 个关联</small><strong>{{ active.label }}</strong></div>
        <a v-if="active.kind === 'article'" :href="withBase(active.value)">前往阅读</a>
        <button v-else type="button" @click="openNode(active)">{{ active.kind === 'tag' ? '按此主题筛选' : '按此栏目筛选' }}</button>
      </template>
      <template v-else><span class="graph-desktop-tip">悬停查看关联，点击节点打开。</span><span class="graph-touch-tip">轻点查看关联，再点同一节点打开。</span></template>
    </div>
  </section>
</template>

<style scoped>
.knowledge-graph { min-width:0; overflow:hidden; margin-block:12px 24px; border:1px solid var(--vp-c-divider); border-radius:8px; background:var(--vp-c-bg); }
.graph-toolbar,.graph-info { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px 12px; padding:8px 12px; }
.graph-toolbar { border-bottom:1px solid var(--vp-c-divider); }
.graph-legend,.graph-tools,.graph-legend span { display:flex; align-items:center; }
.graph-legend { gap:12px; font-size:12px; color:var(--vp-c-text-2); }
.graph-legend span { gap:5px; white-space:nowrap; }
.graph-legend i { width:7px; height:7px; border-radius:50%; background:var(--vp-c-text-2); }
.graph-legend .tag { border-radius:0; transform:rotate(45deg); background:var(--vp-c-brand-1); }
.graph-legend .section { width:10px; height:10px; border:2px solid var(--vp-c-text-1); background:var(--vp-c-bg); }
.graph-tools { gap:2px; margin-inline-start:auto; }
.graph-tools button { display:grid; place-items:center; min-width:32px; min-height:32px; border-radius:4px; color:var(--vp-c-text-2); font-size:13px; }
.graph-tools button:nth-child(-n+2) { font-size:18px; }
.graph-tools button:hover,.graph-tools button[aria-pressed='true'] { color:var(--vp-c-brand-1); background:var(--vp-c-bg-soft); }
.graph-tools button:focus-visible,.graph-info :is(button,a):focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:1px; }
.graph-tools .graph-lock { display:none; padding-inline:7px; font-size:12px; }
.graph-canvas { display:block; width:100%; height:clamp(320px,54vh,540px); touch-action:pan-y pinch-zoom; cursor:grab; }
.graph-canvas.unlocked { touch-action:none; }
.graph-canvas:active { cursor:grabbing; }
.graph-edge { stroke:var(--vp-c-divider); stroke-width:1; vector-effect:non-scaling-stroke; pointer-events:none; }
.graph-edge.is-related { stroke:var(--vp-c-brand-1); stroke-width:1.5; }
.graph-edge.is-muted { opacity:.22; }
.graph-node { cursor:pointer; outline:none; }
.graph-node,.graph-edge { transition:opacity .12s ease-out; }
.graph-hit { fill:none; pointer-events:all; }
.graph-node:focus-visible .graph-hit,.graph-node.is-active .graph-hit { stroke:var(--vp-c-brand-1); stroke-width:1.5px; }
.graph-mark.article { fill:var(--vp-c-text-2); }
.graph-mark.tag { fill:var(--vp-c-brand-1); }
.graph-mark.section { fill:var(--vp-c-bg); stroke:var(--vp-c-text-1); stroke-width:2px; }
.graph-node.is-muted,.graph-label.is-muted { opacity:.24; }
.graph-labels { pointer-events:none; }
.graph-label { font-size:11px; font-weight:550; fill:var(--vp-c-text-1); stroke:var(--vp-c-bg); stroke-width:3px; stroke-linejoin:round; paint-order:stroke; }
.graph-info { min-height:58px; border-top:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); font-size:13px; }
.graph-info div { flex:1 1 150px; min-width:0; }
.graph-info strong,.graph-info small { display:block; }
.graph-info small { font-size:11px; }
.graph-info strong { color:var(--vp-c-text-1); font-size:14px; line-height:1.5; overflow-wrap:anywhere; }
.graph-info :is(a,button) { display:inline-flex; align-items:center; min-height:36px; font-size:13px; color:var(--vp-c-brand-1); text-decoration:underline; text-underline-offset:3px; }
.graph-touch-tip { display:none; }
@media(hover:none),(any-pointer:coarse) {
  .graph-tools .graph-lock { display:block; }
  .graph-tools button { min-height:40px; min-width:36px; }
  .graph-hit { r:16px; }
  .graph-desktop-tip { display:none; }
  .graph-touch-tip { display:inline; }
}
@media(prefers-reduced-motion:reduce) { .graph-node,.graph-edge { transition:none; } }
</style>
