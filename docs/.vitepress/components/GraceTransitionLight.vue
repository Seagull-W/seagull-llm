<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createGraceDust, warmGraceDust } from '../theme/grace-dust'
import { graceSweepMask } from '../theme/grace-sweep'

const canvas = ref<HTMLCanvasElement>()
const reveals = { moonlight: 'grace-moon-reveal', blessing: 'grace-day-reveal' } as const
let observer: MutationObserver | undefined
let frame: number | undefined
let idle: number | undefined

function stop() {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
  // A later snapshot must start clear, even when the last sweep was interrupted.
  if (canvas.value && canvas.value.width !== 0) canvas.value.width = 0
}

function followReveal() {
  stop()
  const root = document.documentElement
  const kind = root.dataset.appearanceMotion
  const surface = canvas.value
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  if ((kind !== 'moonlight' && kind !== 'blessing') || !surface || reduced.matches) return

  let reveal: Animation | undefined
  let draw: ((progress: number) => void) | undefined
  let lastProgress: number | undefined
  const tick = () => {
    if (root.dataset.appearanceMotion !== kind || reduced.matches) return stop()
    // The root pseudo-element only exists once the new snapshot is ready.
    // The fallback picture uses the same named CSS animation.
    if (!reveal) reveal = document.getAnimations().find(animation =>
      'animationName' in animation && animation.animationName === reveals[kind])
    if (reveal?.effect) {
      if (reveal.playState === 'idle') return stop()
      const progress = reveal.effect.getComputedTiming().progress
      if (progress !== null && progress !== lastProgress) {
        draw ??= createGraceDust(surface, kind)
        draw(progress)
        lastProgress = progress
      }
      if (reveal.playState === 'finished') return stop()
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

onMounted(() => {
  const root = document.documentElement
  for (const kind of ['moonlight', 'blessing'] as const) {
    root.style.setProperty(`--${kind}-mask`, graceSweepMask(kind))
  }
  if (window.requestIdleCallback && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const next = root.classList.contains('dark') ? 'blessing' : 'moonlight'
    idle = requestIdleCallback(() => {
      warmGraceDust(next)
      idle = requestIdleCallback(() => warmGraceDust(next === 'moonlight' ? 'blessing' : 'moonlight'))
    })
  }
  observer = new MutationObserver(followReveal)
  observer.observe(root, { attributes: true, attributeFilter: ['data-appearance-motion'] })
  followReveal()
})

onUnmounted(() => {
  observer?.disconnect()
  if (idle !== undefined) cancelIdleCallback(idle)
  stop()
  for (const kind of ['moonlight', 'blessing'] as const) {
    document.documentElement.style.removeProperty(`--${kind}-mask`)
  }
})
</script>

<template>
  <div class="grace-transition-light" aria-hidden="true" inert><canvas ref="canvas" /></div>
</template>

<style scoped>
canvas { display: block; width: 100%; height: 100%; }
</style>
