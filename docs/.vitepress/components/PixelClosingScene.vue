<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { withBase } from 'vitepress'
import { chargeComplete, huntSheetPath, moonCast, moveIds, moves, sheets, stage, type Fighter, type MoveId } from './pixel-hunt/choreography'
import { paintHunt } from './pixel-hunt/render'

const props = defineProps<{ active: boolean }>()
const canvas = ref<HTMLCanvasElement>()
const atlasElements = ref<HTMLImageElement[]>([])
const painted = ref(false)
const current = shallowRef<MoveId | null>(null)
const queued = shallowRef<MoveId | null>(null)
const announcement = ref('')

let images: Record<Fighter, HTMLImageElement> | undefined
let brush: CanvasRenderingContext2D | null = null
let motion: MediaQueryList | undefined
let frame = 0
let previous: number | null = null
let lastPaint = 0
// This clock advances only while the footer is on screen and its tab is visible.
let clock = 0
let started = 0
let ringBorn = -Infinity
let nextGather = 7600
let gatherStart = -Infinity
let chargedUntil = -Infinity

function fallbackStyle(who: Fighter) {
  const a = sheets[who]
  return {
    left: (a.home - a.pivotX * a.scale) / stage.width * 100 + '%',
    top: (stage.ground - a.pivotY * a.scale) / stage.height * 100 + '%',
    width: a.width * a.scale / stage.width * 100 + '%',
    aspectRatio: a.width + '/' + a.height,
  }
}

function draw() {
  if (!brush || !images) return
  const move = current.value ? moves[current.value] : null
  const time = clock - started
  if (current.value === 'sacred' && time >= chargeComplete) chargedUntil = started + chargeComplete + 9000
  const gatherAge = clock - gatherStart
  paintHunt(brush, images, {
    move, time, clock, ringAge: clock - ringBorn, charged: clock < chargedUntil,
    gathering: gatherAge >= 0 && gatherAge < 1500 ? gatherAge : -1, still: !!motion?.matches,
  })
  painted.value = true
}

function begin(id: MoveId) {
  current.value = id
  queued.value = null
  started = clock
  gatherStart = -Infinity
  nextGather = clock + moves[id].duration + 9000
  if (id === 'moon') ringBorn = clock + moonCast
  if (motion?.matches) clock += moves[id].still
  announcement.value = moves[id].description
  draw()
}

function choose(id: MoveId) {
  if (!images) return
  if (motion?.matches && current.value === id) {
    reset()
    announcement.value = '猎人收刀，回到备战姿势。'
    draw()
  } else if (!motion?.matches && current.value) {
    queued.value = id
    announcement.value = '接下来施展' + moves[id].name
  } else {
    begin(id)
  }
}

function tick(timestamp: number) {
  clock += previous === null ? 0 : timestamp - previous
  previous = timestamp
  if (current.value && clock - started >= moves[current.value].duration) {
    if (queued.value) begin(queued.value)
    else current.value = null
  }
  if (!current.value && clock >= nextGather) {
    gatherStart = clock
    nextGather = clock + 23000
  }
  if (gatherStart !== -Infinity && clock >= gatherStart + 1500) {
    chargedUntil = gatherStart + 10500
    gatherStart = -Infinity
  }
  // Give the slash its full cadence. Idle poses and thunderbugs need fewer redraws.
  const interval = current.value || gatherStart !== -Infinity ? 1000 / 30 : 1000 / 12
  if (timestamp - lastPaint >= interval) {
    draw()
    lastPaint = timestamp - ((timestamp - lastPaint) % interval)
  }
  frame = requestAnimationFrame(tick)
}

function stop() {
  cancelAnimationFrame(frame)
  previous = null
}

function syncPlayback() {
  stop()
  if (!props.active || !images) return
  draw()
  if (!motion?.matches) frame = requestAnimationFrame(tick)
}

function reset() {
  current.value = queued.value = null
  ringBorn = gatherStart = chargedUntil = -Infinity
  nextGather = clock + 7600
  announcement.value = ''
}

function changeMotion() {
  reset()
  syncPlayback()
}

function prepare() {
  const hunter = atlasElements.value.find(el => el.dataset.sheet === 'hunter')
  const zinogre = atlasElements.value.find(el => el.dataset.sheet === 'zinogre')
  if (!hunter?.complete || !hunter.naturalWidth || !zinogre?.complete || !zinogre.naturalWidth) return
  brush = canvas.value?.getContext('2d') ?? null
  if (!brush) return
  images = { hunter, zinogre }
  syncPlayback()
}

watch(() => props.active, syncPlayback)
onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', changeMotion)
  prepare()
})
onBeforeUnmount(() => {
  motion?.removeEventListener('change', changeMotion)
  stop()
})
</script>

<template>
  <section class="hunt-outro" aria-label="像素山道遭遇战" :data-move="current ?? 'rest'">
    <div class="hunt-stage" role="img" aria-label="身穿紫金祸铠的太刀猎人在山道上迎战雷狼龙。">
      <div class="hunt-world" aria-hidden="true" :class="{ 'has-canvas': painted }">
        <div v-for="(sheet, who) in sheets" :key="who" class="hunt-fallback" :style="fallbackStyle(who)">
          <img ref="atlasElements" :data-sheet="who" :src="withBase(huntSheetPath(sheet))"
            :width="sheet.width * sheet.columns" :height="sheet.height * sheet.rows" :style="{ width: sheet.columns * 100 + '%' }"
            loading="lazy" decoding="async" alt="" @load="prepare" />
        </div>
        <canvas ref="canvas" :width="stage.width * 2" :height="stage.height * 2" />
      </div>
    </div>
    <div class="hunt-actions" role="group" aria-label="太刀招式">
      <button v-for="id in moveIds" :key="id" type="button" class="hunt-action" :disabled="!painted"
        :aria-label="'施展' + moves[id].name" :title="moves[id].name" :data-current="id === current" :data-next="id === queued" @click="choose(id)">
        <svg viewBox="0 0 24 24" width="25" height="25" aria-hidden="true" focusable="false">
          <g v-if="id === 'foresight'">
            <path fill="#f1deae" d="m5 19 3-4 1 1 3-3 2 1-4 4 1 1-4 3-1-1zM9 12l1-1 4 4-1 1z"/>
            <path fill="#d2ece1" d="M12 12 21 2l-1 5-7 7z"/>
            <path fill="#83b8b0" d="M2 10h2l4-5-1 4 3-1-4 4H2z"/>
          </g>
          <g v-else-if="id === 'iai'">
            <path fill="#cb8875" d="M2 16h5l5-3v3l-7 3H2z"/>
            <path fill="#f9e5c1" d="m9 13 1-3 2 1-1 4zM12 10l10-4-2 3-8 3z"/>
            <path fill="#9bc2be" d="M15 2h1v2h2v1h-2v2h-1V5h-2V4h2zM2 12l5-2v1l-5 2z"/>
          </g>
          <g v-else-if="id === 'helm'">
            <path fill="#9fbfbb" d="m2 15 5-6 1-5 2 1-2 6z"/>
            <path fill="#f8ddad" d="m15 1 2 1-2 4 3 1-1 2-2-1-4 13-1 2v-6l3-10-3-1 1-2 3 1z"/>
            <path fill="#d49477" d="m17 13 5-3-4 5zm-2 5 6-4-5 6z"/>
          </g>
          <g v-else-if="id === 'sacred'">
            <path fill="#c68587" d="M2 17 12 4l-5 10z"/>
            <path fill="#ffe4ba" d="M4 19 20 3l-8 12z"/>
            <path fill="#dfa17d" d="m7 20 16-10-8 8z"/>
            <path fill="#9dc3c0" d="M2 21h3v1H2zM14 4h1v2h-1z"/>
          </g>
          <g v-else>
            <path fill="none" stroke="#a9e6ce" stroke-width="1.6" d="M19 7c-3-3-10-1-14 4s-3 9 3 9c5 0 12-5 13-10"/>
            <path fill="#f6e3a9" d="M18 2h2v2h2v2h-2v2h-2V6h-2V4h2z"/>
            <path fill="#81b5b1" d="m5 16 4-5 4-3-3 4z"/>
          </g>
        </svg>
      </button>
    </div>
    <span class="hunt-sr" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
  </section>
</template>

<style scoped>
.hunt-outro { position:absolute; inset:0; }
.hunt-stage { position:relative; isolation:isolate; aspect-ratio:var(--hunt-ratio); overflow:hidden; }
.hunt-world { position:absolute; top:0; left:50%; height:100%; aspect-ratio:3.2; transform:translateX(-50%); pointer-events:none; }
.hunt-world canvas, .hunt-fallback img { display:block; image-rendering:pixelated; }
.hunt-world canvas { position:absolute; inset:0; width:100%; height:100%; }
.hunt-fallback { position:absolute; overflow:hidden; }
.hunt-fallback img { max-width:none; height:auto; }
.has-canvas .hunt-fallback { visibility:hidden; }
.hunt-actions {
  position:absolute; right:8px; bottom:4px; display:flex; width:max-content; max-width:100%; gap:0;
  padding:0 3px; background:#1b2b2deb; box-shadow:inset 0 1px #c2c2a466, inset 0 -2px #0c1d25;
}
.hunt-action {
  position:relative; display:grid; place-items:center; width:44px; height:44px; padding:0;
  border:0; color:#ecd3a3; background:transparent; touch-action:manipulation; cursor:pointer;
}
.hunt-action svg { pointer-events:none; shape-rendering:crispEdges; }
.hunt-action:enabled:is(:hover,:focus-visible), .hunt-action[data-current="true"] { background:#c9d4b518; }
.hunt-action:focus-visible { outline:2px solid #fae3b7; outline-offset:-3px; }
.hunt-action[data-current="true"]::after, .hunt-action[data-next="true"]::before {
  content:''; position:absolute; bottom:4px; width:12px; height:2px; background:#dfb578;
}
.hunt-action[data-next="true"]::before { bottom:auto; top:4px; width:4px; background:#a9decb; }
.hunt-action:disabled { opacity:.6; }
.hunt-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
@media (max-width:760px) {
  .hunt-actions { position:relative; inset:auto; width:100%; justify-content:center; padding:0; background:#263634; }
  .dark .hunt-actions { background:#1e2d38; }
}
</style>
