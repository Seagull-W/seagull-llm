<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'
import { closingImageFor, useVisualStyle } from '../theme/visual-styles'

const { isDark } = useData()
const style = useVisualStyle()
const folder = '/images/pixel-voyage/closing/'
const phase = ref<'rest' | 'counter' | 'result'>('rest')
const still = ref(false)
const actionLabel = computed(() => {
  if (phase.value === 'counter') return '正在施展太刀见切'
  if (phase.value === 'result') return still.value ? '收刀' : '再次施展太刀见切'
  return '施展太刀见切'
})

function counter() {
  if (phase.value === 'counter') return
  still.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still.value) phase.value = phase.value === 'result' ? 'rest' : 'result'
  else phase.value = 'counter'
}

function finish(event: AnimationEvent) {
  if (phase.value !== 'counter' || event.target !== event.currentTarget) return
  still.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  phase.value = 'result'
}
</script>

<template>
  <section class="hunt-outro" aria-label="像素山道遭遇战" :data-phase="phase" :class="{ 'hunt-still': still }">
    <div class="hunt-stage" role="img" aria-label="山道上，身穿紫金祸铠的猎人横持太刀。对面的雷狼龙低下双角，白鬃间跃动着电光。">
      <img class="hunt-land" :src="withBase(closingImageFor(style, isDark))" width="512" height="160" alt="" loading="lazy" decoding="async" />
      <div class="hunt-fighter hunt-hunter" aria-hidden="true" @animationend="finish" @animationcancel="finish">
        <span class="hunt-cel">
          <img class="hunt-strip hunter-strip" :src="withBase(folder + 'hunter.webp')" width="516" height="124" loading="lazy" decoding="async" alt="" />
        </span>
        <svg class="hunt-cut" viewBox="0 0 172 124" aria-hidden="true" focusable="false">
          <path fill="#b2e2ce" d="M106 74Q139 55 166 3Q155 37 135 56Q121 68 106 74Z" />
          <path fill="#fff3c8" d="M127 61Q151 40 165 6Q156 36 143 48Z" />
          <path fill="#ddebd8" d="M137 61l6-7-3 6zM149 48l5-9-2 7z" />
        </svg>
      </div>
      <div class="hunt-fighter hunt-wyvern" aria-hidden="true">
        <span class="hunt-cel">
          <img class="hunt-strip wyvern-strip" :src="withBase(folder + 'zinogre.webp')" width="960" height="120" loading="lazy" decoding="async" alt="" />
        </span>
        <svg class="hunt-mane" viewBox="0 0 320 120" aria-hidden="true" focusable="false">
          <path d="M91 20h5v-5h5V9h5V6h-8v6h-4v4h-3z M124 27h4v4h4v-7h4v-5h4v-3h-7v6h-5v5z M152 36h6v3h4v-5h5v-4h-7v4h-8z"/>
        </svg>
      </div>
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" class="hunt-impact" aria-hidden="true" focusable="false">
        <g class="hunt-lightning" fill="#b6fcdd">
          <path d="m125 30-20 16 2-7-25 16 2-6-21 13 2-5-24 13 18-14-2 6 24-17-2 6 31-19-3 8z" />
          <path d="m102 43-4-5-5 1-3-5 5 3 5-1 4 4zm-20 9 7 3 6-2-5 4-8-2z" />
        </g>
      </svg>
      <span class="hunt-fireflies" aria-hidden="true"><i></i><i></i><i></i></span>
    </div>
    <button type="button" class="hunt-action" :aria-label="actionLabel" :aria-disabled="phase === 'counter'" @click="counter">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
        <path fill="#c0ded3" d="M21 1h1v4h-1v3h-2v2h-2v2h-2v2h-2v2h-2v-2h1v-2h2v-2h2V8h2V6h2V3h1z"/>
        <path fill="#fff4d7" d="M21 1h1v3h-1v2h-1v2h-2v2h-2v2h-2v2h-2v-1h1v-2h2V9h2V7h2V5h1V3h1z"/>
        <path fill="#e8b975" d="M7 12h2v1h1v1h2v2h1v1h1v2h-2v-1h-1v-1H9v-2H8v-1H7zM8 15h2v2H8v2H6v2H4v1H2v-2h2v-2h2v-2h2z"/>
        <path fill="#a77e5e" d="M4 19h2v2H4zm3-3h2v2H7z"/>
      </svg>
    </button>
    <span class="hunt-sr" role="status" aria-live="polite" aria-atomic="true">{{ phase === 'result' ? '猎人避过雷击，挥刀反击。' : '' }}</span>
  </section>
</template>

<style scoped>
.hunt-outro { position:relative; margin:32px auto 0; }
.hunt-stage { --hunt-play:paused; position:relative; isolation:isolate; aspect-ratio:3.2; overflow:hidden; background:#789793; }
.dark .hunt-stage { background:#273950; }
.hunt-land, .hunt-fighter, .hunt-impact, .hunt-fireflies { position:absolute; pointer-events:none; }
.hunt-land { inset:0; width:100%; height:100%; object-fit:cover; object-position:center; }
.hunt-land, .hunt-strip { display:block; image-rendering:pixelated; }
.hunt-hunter { left:26%; bottom:17%; width:16%; }
.hunt-wyvern { right:11%; bottom:17%; width:40%; }
.hunt-fighter::before {
  content:""; position:absolute; bottom:2%; height:6%; left:11%; width:61%; background:#182c3280;
  clip-path:polygon(0 38%,12% 38%,12% 13%,31% 13%,31% 0,72% 0,72% 13%,90% 13%,90% 40%,100% 40%,100% 70%,89% 70%,89% 88%,64% 88%,64% 100%,21% 100%,21% 80%,0 80%);
}
.hunt-hunter::before { left:17%; width:58%; bottom:2%; }
.hunt-cel { display:block; overflow:hidden; transform-origin:45% 95%; }
.hunt-strip { width:300%; max-width:none; height:auto; }
.hunt-mane { position:absolute; inset:0; width:100%; height:100%; fill:#a9f5e9; opacity:0; shape-rendering:crispEdges; }
.hunt-impact { left:32%; bottom:18%; width:34%; height:58%; overflow:visible; shape-rendering:crispEdges; }
.hunt-lightning, .hunt-cut { opacity:0; }
.hunt-cut { position:absolute; inset:0; width:100%; height:100%; shape-rendering:crispEdges; }
.hunt-fireflies { left:53%; top:38%; width:12%; height:22%; color:#e6e6a6; }
.hunt-fireflies i { position:absolute; width:3px; height:3px; background:currentColor; box-shadow:2px -1px #e8f7c37a; }
.hunt-fireflies i:nth-child(1) { left:12%; top:23%; }
.hunt-fireflies i:nth-child(2) { left:67%; top:49%; }
.hunt-fireflies i:nth-child(3) { left:37%; top:91%; }
.hunt-action {
  position:absolute; right:clamp(3px,1vw,12px); bottom:clamp(3px,1vw,12px);
  display:grid; place-items:center; width:44px; height:44px; padding:0; border:0;
  background:transparent; touch-action:manipulation; cursor:pointer;
}
.hunt-action::before {
  content:''; position:absolute; inset:5px; background:#213138e6; border:1px solid #c5d4b6;
  clip-path:polygon(4px 0,calc(100% - 4px) 0,calc(100% - 4px) 2px,100% 2px,100% calc(100% - 4px),calc(100% - 2px) calc(100% - 4px),calc(100% - 2px) 100%,4px 100%,4px calc(100% - 2px),0 calc(100% - 2px),0 4px,4px 4px);
}
.hunt-action svg { position:relative; shape-rendering:crispEdges; }
.hunt-action:is(:hover,:focus-visible)::before { background:#18282e; border-color:#fff2be; }
.hunt-action:focus-visible { outline:2px solid #fff2be; outline-offset:-1px; box-shadow:0 0 0 1px #24333c; }
.hunt-action[aria-disabled='true'] svg { opacity:.65; }
.hunt-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }

@keyframes hunt-drift { 0%,100% { opacity:.25; transform:translate(0,2px); } 50% { opacity:.85; transform:translate(3px,-3px); } }
@keyframes hunt-breathe { 0%,100% { transform:scaleY(1); } 52% { transform:scaleY(.984); } }
@keyframes hunt-static-charge { 0%,72%,75%,82%,100% { opacity:0; } 73%,78% { opacity:.84; } }
@keyframes hunt-guard-cels {
  0%,15% { transform:translateX(0); } 16%,53% { transform:translateX(-33.333333%); }
  54%,82% { transform:translateX(-66.666667%); } 83%,100% { transform:translateX(0); }
}
@keyframes hunt-wyvern-cels {
  0%,11%,86%,100% { transform:translateX(0); }
  12%,36%,67%,85% { transform:translateX(-33.333333%); }
  37%,66% { transform:translateX(-66.666667%); }
}
@keyframes hunt-footwork { 0%,13%,100% { transform:translateX(0); } 30%,48% { transform:translateX(-11%); } 59%,76% { transform:translateX(34%); } }
@keyframes hunt-pounce { 0%,20%,100% { transform:translateX(0); } 29% { transform:translateX(2%); } 44%,56% { transform:translateX(-14%); } 75% { transform:translateX(-2%); } }
@keyframes hunt-bolt { 0%,35%,53%,100% { opacity:0; } 36%,48% { opacity:1; } }
@keyframes hunt-swing { 0%,51%,74%,100% { opacity:0; } 52%,64% { opacity:1; } 69% { opacity:.4; } }

@media (prefers-reduced-motion: no-preference) {
  .is-scene-active .hunt-stage { --hunt-play:running; }
  .hunt-fireflies i { animation:hunt-drift 4.8s steps(4,end) infinite var(--hunt-play); }
  .hunt-fireflies i:nth-child(2) { animation-delay:-1.6s; }
  .hunt-fireflies i:nth-child(3) { animation-delay:-3.4s; }
  .hunt-cel { animation:hunt-breathe 3.6s steps(2,end) infinite var(--hunt-play); }
  .hunt-wyvern .hunt-cel { animation-duration:4.8s; }
  .hunt-mane { animation:hunt-static-charge 5.5s step-end infinite var(--hunt-play); }
  [data-phase='counter'] :is(.hunt-cel,.hunt-mane) { animation:none; }
  [data-phase='counter'] .hunter-strip { animation:hunt-guard-cels 1.16s steps(1,end) both var(--hunt-play); }
  [data-phase='counter'] .wyvern-strip { animation:hunt-wyvern-cels 1.16s steps(1,end) both var(--hunt-play); }
  [data-phase='counter'] .hunt-hunter { animation:hunt-footwork 1.16s steps(5,end) both var(--hunt-play); }
  [data-phase='counter'] .hunt-wyvern { animation:hunt-pounce 1.16s steps(4,end) both var(--hunt-play); }
  [data-phase='counter'] .hunt-lightning { animation:hunt-bolt 1.16s steps(1,end) both var(--hunt-play); }
  [data-phase='counter'] .hunt-cut { animation:hunt-swing 1.16s steps(2,end) both var(--hunt-play); }
}
@media (prefers-reduced-motion: reduce) {
  .hunt-still[data-phase='result'] :is(.hunter-strip,.wyvern-strip) { transform:translateX(-66.666667%); }
  .hunt-still[data-phase='result'] .hunt-hunter { transform:translateX(34%); }
  .hunt-still[data-phase='result'] .hunt-wyvern { transform:translateX(-14%); }
  .hunt-still[data-phase='result'] .hunt-cut { opacity:.7; }
}
@media (max-width:639px) {
  .hunt-outro { margin-top:22px; }
  .hunt-stage { aspect-ratio:2.05; }
  .hunt-hunter { left:14%; width:23%; }
  .hunt-wyvern { right:2%; width:52%; }
  .hunt-impact { left:28%; bottom:19%; width:40%; }
}
</style>
