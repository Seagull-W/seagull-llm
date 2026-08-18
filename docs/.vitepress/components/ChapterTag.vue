<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vitepress'
import { sidebar } from '../sidebar'

const route = useRoute()

// 运行时从侧边栏分组反推当前章节所属的层级标签
const layer = computed(() => {
  const path = route.path
  for (const group of sidebar) {
    if (group.items?.some((it) => it.link === path)) {
      return group.text
    }
  }
  return ''
})
</script>

<template>
  <span v-if="layer" class="chapter-tag">
    <i class="chapter-tag-dot"></i>{{ layer }}
  </span>
</template>

<style scoped>
.chapter-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  padding: 4px 13px;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  background: rgba(37, 99, 235, 0.07);
  border: 1px solid rgba(37, 99, 235, 0.15);
  margin-bottom: 18px;
  line-height: 1.4;
}

.chapter-tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--grad-accent);
  flex: none;
}

:global(.dark) .chapter-tag {
  color: var(--vp-c-brand-3);
  background: rgba(96, 165, 250, 0.10);
  border-color: rgba(96, 165, 250, 0.2);
}
</style>
