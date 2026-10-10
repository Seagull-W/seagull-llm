<script setup lang="ts">
defineProps<{
  src: string
  title: string
  previewPages: string[]
}>()
</script>

<template>
  <section class="pdf-viewer" :aria-label="title">
    <a v-for="(page, index) in previewPages" :key="page" class="pdf-page" :href="src" target="_blank" rel="noopener noreferrer" :aria-label="`${title}，第 ${index + 1} 页，打开 PDF`">
      <img :src="page" :alt="`${title}，第 ${index + 1} 页`" :loading="index === 0 ? 'eager' : 'lazy'" decoding="async" width="1191" height="1684" />
    </a>
  </section>
</template>

<style scoped>
.pdf-viewer {
  min-width: 0;
}

.pdf-page {
  display: block;
}

.pdf-page:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.pdf-page img {
  display: block;
  width: 100%;
  height: auto;
  background: white;
}
</style>
