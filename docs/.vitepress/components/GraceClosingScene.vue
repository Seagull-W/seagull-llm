<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { closingImageFor, heroMobileMedia, useVisualStyle } from '../theme/visual-styles'

const { isDark } = useData()
const style = useVisualStyle()
</script>

<template>
  <div class="grace-rest">
    <picture>
      <source :media="heroMobileMedia" :srcset="withBase(closingImageFor(style, isDark, true))" width="720" height="405" />
      <img :src="withBase(closingImageFor(style, isDark))" width="1608" height="536" loading="lazy" decoding="async"
        :alt="isDark ? '月光下，梅琳娜与战士壶亚历山大坐在遗迹石台上，赐福的金光映上她的脸、壶身和脚边的积水。' : '黄金树照亮远方城堡，梅琳娜与战士壶亚历山大相对而坐，在石台中央的赐福旁歇脚。'" />
    </picture>
    <span class="grace-reflection" />
    <svg class="grace-fire" viewBox="0 0 120 116" fill="none" aria-hidden="true" focusable="false">
      <g class="grace-tongue">
        <path fill="#ffd778" d="M60 98c1-12-3-20-2-31 0-12 7-21 5-39 8 18-1 29 0 40 0 13 3 20-3 30Z" />
        <path fill="#fff4c4" d="M60 96c2-15-1-19 0-29 1-5 3-12 3-19 4 11-1 19-1 25 0 9 2 16-2 23Z" />
      </g>
      <path class="grace-filament" stroke="#ffda7c" stroke-width=".95" stroke-linecap="round"
        d="M60 97c-8-9-16-14-14-22 1-5 9-12 6-19m9 37c3-13 17-20 16-31-.4-5-3-9-2-15" />
      <g fill="#ffdc86">
        <g class="grace-motes grace-motes-first">
          <ellipse cx="50" cy="81" rx=".9" ry="1.9" transform="rotate(-21 50 81)" />
          <circle cx="66" cy="59" r="1.15" />
          <circle cx="42" cy="87" r=".8" />
        </g>
        <g class="grace-motes grace-motes-second">
          <ellipse cx="69" cy="76" rx=".8" ry="1.65" transform="rotate(27 69 76)" />
          <circle cx="55" cy="63" r=".85" />
          <circle cx="76" cy="81" r="1.05" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.grace-rest {
  --grace-root-x: 48.62%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  aspect-ratio: 3;
  background: #545344;
  pointer-events: none;
}
.dark .grace-rest { background: #17202a; }
.grace-rest picture, .grace-rest img { display: block; width: 100%; height: 100%; }
.grace-rest img { object-fit: cover; }
.grace-fire, .grace-reflection { display: none; }

@media (prefers-reduced-motion: no-preference) {
  .grace-fire {
    position: absolute;
    display: block;
    left: var(--grace-root-x);
    top: 74.4%;
    height: 31%;
    width: auto;
    aspect-ratio: 120 / 116;
    transform: translate(-50%, -84.48%);
  }
  .grace-tongue, .grace-filament {
    transform-box: view-box;
    transform-origin: 60px 98px;
  }
  .grace-tongue { animation: grace-burn 2.8s ease-in-out infinite alternate; }
  .grace-filament { animation: grace-curl 3.8s ease-in-out infinite alternate; }
  .grace-motes { opacity: 0; animation: grace-lift 3.9s linear infinite; }
  .grace-motes-second { animation-delay: -2.2s; animation-duration: 4.6s; }
  .grace-reflection {
    position: absolute;
    display: block;
    left: var(--grace-root-x);
    top: 84.1%;
    width: 4%;
    height: 7%;
    margin-left: -2%;
    border-radius: 50%;
    background: radial-gradient(ellipse, #ffd78680 0%, #ffc65430 27%, transparent 70%);
    animation: grace-water 2.8s ease-in-out infinite alternate;
  }
  .grace-rest :is(.grace-tongue, .grace-filament, .grace-motes, .grace-reflection) {
    animation-play-state: paused;
  }
  .is-scene-active .grace-rest :is(.grace-tongue, .grace-filament, .grace-motes, .grace-reflection) {
    animation-play-state: running;
  }
}
@keyframes grace-burn {
  0% { opacity: .24; transform: skewX(-4deg) scale(.8, .77); }
  34% { opacity: .78; transform: skewX(3deg) scale(1.02, 1.04); }
  66% { opacity: .46; transform: skewX(-1deg) scale(.88, .91); }
  100% { opacity: .83; transform: skewX(5deg) scale(.96, 1.1); }
}
@keyframes grace-curl {
  from { opacity: .07; transform: skewX(-7deg) scale(.78, .79); }
  to { opacity: .56; transform: skewX(5deg) scale(1.05, 1.04); }
}
@keyframes grace-lift {
  0% { opacity: 0; transform: translate(0, 6px); }
  28% { opacity: .92; }
  75% { opacity: .7; }
  100% { opacity: 0; transform: translate(9px, -46px); }
}
@keyframes grace-water {
  from { opacity: .25; transform: scale(.8, .72); }
  to { opacity: .85; transform: scale(1.15, 1.1); }
}
@media (max-width: 639px) {
  .grace-rest { --grace-root-x: 47.67%; aspect-ratio: 16 / 9; }
}
</style>
