<script setup lang="ts">
const props = defineProps<{
  src: string
  title: string
  pages: number
  previewPages: string[]
}>()
</script>

<template>
  <section class="pdf-viewer" :aria-label="`${title} PDF 阅读器`">
    <div class="pdf-toolbar">
      <span class="pdf-meta">PDF 讲义 · {{ pages }} 页</span>
      <div class="pdf-actions">
        <a :href="src" target="_blank" rel="noopener noreferrer">在新窗口打开</a>
        <a :href="src" :download="`${title}.pdf`">下载 PDF</a>
      </div>
    </div>
    <p class="pdf-help">下方为逐页高清预览。需要搜索文字或放大阅读时，可在新窗口打开或下载原始 PDF。</p>
    <div class="pdf-document">
      <figure v-for="(page, index) in props.previewPages" :key="page" class="pdf-page">
        <figcaption>第 {{ index + 1 }} / {{ pages }} 页</figcaption>
        <img :src="page" :alt="`${title}，第 ${index + 1} 页`" :loading="index === 0 ? 'eager' : 'lazy'" decoding="async" width="1191" height="1684" />
      </figure>
    </div>
  </section>
</template>

<style scoped>
.pdf-viewer {
  margin: 24px 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.pdf-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 16px;
}

.pdf-meta {
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.pdf-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.pdf-actions a {
  font-size: 14px;
  color: var(--vp-c-brand-1);
}

.pdf-actions a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.pdf-help {
  margin: 0 !important;
  padding: 0 16px 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
}

.pdf-document {
  display: block;
  width: 100%;
  border: 0;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.pdf-page {
  margin: 0;
}

.pdf-page figcaption {
  font-size: 14px;
  padding: 8px 16px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
}

.pdf-page img {
  display: block;
  width: 100%;
  height: auto;
  background: white;
}

@media (max-width: 640px) {
  .pdf-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
