<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const progress = ref(0)
let raf = 0

function update() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const el = document.documentElement
    const total = el.scrollHeight - el.clientHeight
    progress.value = total > 0 ? Math.min(1, el.scrollTop / total) : 0
  })
}

onMounted(() => {
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  update()
})

onUnmounted(() => {
  window.removeEventListener('scroll', update)
  window.removeEventListener('resize', update)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="reading-progress" :style="{ transform: `scaleX(${progress})` }"></div>
</template>
