<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type Point = { step: number; value: number }
const props = defineProps<{ series: { label: string; color: string; points: Point[] }[]; metric: string }>()
const W = 800, H = 320, left = 72, right = 22, top = 20, bottom = 46
const cursor = ref<number | null>(null)
const all = computed(() => props.series.flatMap(s => s.points))
const bounds = computed(() => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of all.value) { x0 = Math.min(x0, p.step); x1 = Math.max(x1, p.step); y0 = Math.min(y0, p.value); y1 = Math.max(y1, p.value) }
  if (!all.value.length) return { x0: 0, x1: 1, y0: 0, y1: 1 }
  const pad = (y1 - y0 || Math.abs(y0) || 1) * .08
  return { x0, x1: x1 === x0 ? x0 + 1 : x1, y0: y0 - pad, y1: y1 + pad }
})
const x = (v: number) => left + (v - bounds.value.x0) / (bounds.value.x1 - bounds.value.x0) * (W - left - right)
const y = (v: number) => H - bottom - (v - bounds.value.y0) / (bounds.value.y1 - bounds.value.y0) * (H - top - bottom)
const fmt = (v: number) => v !== 0 && (Math.abs(v) < .001 || Math.abs(v) >= 10000) ? v.toExponential(3) : Number(v.toPrecision(6)).toString()
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => ({
  x: bounds.value.x0 + (bounds.value.x1 - bounds.value.x0) * i / 4,
  y: bounds.value.y0 + (bounds.value.y1 - bounds.value.y0) * i / 4
})))
function nearest(points: Point[], step: number): Point | undefined {
  let lo = 0, hi = points.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].step < step) lo = mid + 1; else hi = mid }
  const a = points[Math.max(0, lo - 1)], b = points[Math.min(lo, points.length - 1)]
  return !a ? b : !b ? a : Math.abs(a.step - step) <= Math.abs(b.step - step) ? a : b
}
const selected = computed(() => props.series.map(s => ({ ...s, point: cursor.value === null ? undefined : nearest(s.points, cursor.value) })))
const steps = computed(() => [...new Set(all.value.map(p => p.step))].sort((a, b) => a - b))
function move(event: PointerEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const pixel = (event.clientX - rect.left) / rect.width * W
  cursor.value = bounds.value.x0 + Math.max(0, Math.min(1, (pixel - left) / (W - left - right))) * (bounds.value.x1 - bounds.value.x0)
}
function key(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const current = nearest(steps.value.map(step => ({ step, value: 0 })), cursor.value ?? steps.value[0])
  const i = steps.value.indexOf(current?.step ?? 0)
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? steps.value.length - 1 : Math.max(0, Math.min(steps.value.length - 1, i + (event.key === 'ArrowRight' ? 1 : -1)))
  cursor.value = steps.value[index]
}
watch(() => [props.metric, props.series], () => { cursor.value = null })
</script>

<template>
  <div class="rm-plot">
    <svg v-if="all.length" :viewBox="`0 0 ${W} ${H}`" role="img" tabindex="0"
      :aria-label="`${metric} 训练曲线；使用左右方向键查看数据点`"
      @pointermove="move" @pointerdown="move" @pointerleave="cursor = null" @keydown="key" @focus="cursor = steps[0]">
      <title>{{ metric }}：bf16 与 f32 原始记录</title>
      <g v-for="(tick, i) in ticks" :key="i">
        <line :x1="left" :x2="W - right" :y1="y(tick.y)" :y2="y(tick.y)" class="grid" />
        <text :x="left - 10" :y="y(tick.y) + 4" text-anchor="end">{{ Number(tick.y.toPrecision(3)).toString() }}</text>
        <text :x="x(tick.x)" :y="H - bottom + 24" text-anchor="middle">{{ Math.round(tick.x) }}</text>
      </g>
      <text :x="(W + left - right) / 2" :y="H - 4" text-anchor="middle">Step</text>
      <g v-for="s in series" :key="s.label">
        <polyline :points="s.points.map(p => `${x(p.step)},${y(p.value)}`).join(' ')" fill="none" :stroke="s.color" stroke-width="2" vector-effect="non-scaling-stroke" />
        <circle v-if="s.points.length === 1" :cx="x(s.points[0].step)" :cy="y(s.points[0].value)" r="4" :fill="s.color" />
      </g>
      <line v-if="cursor !== null" :x1="x(cursor)" :x2="x(cursor)" :y1="top" :y2="H - bottom" class="cursor" />
      <template v-for="s in selected" :key="s.label">
        <circle v-if="s.point" :cx="x(s.point.step)" :cy="y(s.point.value)" r="5" :fill="s.color" stroke="var(--vp-c-bg)" stroke-width="2" />
      </template>
    </svg>
    <p v-else>所选运行没有此指标的记录。</p>
    <div class="readout" aria-live="polite">
      <template v-if="cursor !== null">
        <span v-for="s in selected" :key="s.label"><i :style="{ background: s.color }" />{{ s.label }} · {{ s.point ? `Step ${s.point.step} · ${fmt(s.point.value)}` : '无记录' }}</span>
      </template>
      <span v-else>移动鼠标或触摸曲线查看原始数值，也可聚焦图表后使用左右方向键。</span>
    </div>
  </div>
</template>

<style scoped>
svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; border-radius: 8px; }
svg:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; }
text { fill: var(--vp-c-text-2); font-size: 12px; font-variant-numeric: tabular-nums; }
.grid { stroke: var(--vp-c-divider); stroke-width: 1; }
.cursor { stroke: var(--vp-c-text-3); stroke-dasharray: 4 4; }
.readout { min-height: 52px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; font-size: 12px; color: var(--vp-c-text-2); font-variant-numeric: tabular-nums; }
i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
@media (max-width: 600px) { text { font-size: 19px; } }
</style>
