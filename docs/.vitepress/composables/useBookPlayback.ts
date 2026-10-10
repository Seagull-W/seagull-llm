import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

/** A finite, reader-started sequence. Manual navigation always stops playback. */
export function useBookPlayback(lastStage: number) {
  const stage = shallowRef(0)
  const playing = shallowRef(false)
  const reducedMotion = shallowRef(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let cleanup = () => {}

  function pause() {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    playing.value = false
  }

  function goTo(value: number) {
    pause()
    stage.value = Math.max(0, Math.min(lastStage, value))
  }

  function togglePlay() {
    if (playing.value) return pause()
    if (reducedMotion.value) return
    if (stage.value === lastStage) stage.value = 0
    playing.value = true
    timer = setInterval(() => {
      stage.value += 1
      if (stage.value >= lastStage) pause()
    }, 2400)
  }

  onMounted(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => {
      reducedMotion.value = media.matches
      if (media.matches) pause()
    }
    const handleVisibility = () => { if (document.hidden) pause() }
    updateMotion()
    media.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', handleVisibility)
    cleanup = () => {
      media.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  })

  onBeforeUnmount(() => { pause(); cleanup() })

  return {
    stage, playing, reducedMotion, pause, goTo, togglePlay,
    next: () => goTo(stage.value + 1),
    previous: () => goTo(stage.value - 1),
    reset: () => goTo(0)
  }
}
