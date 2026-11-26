<script setup lang="ts">
import type { Maturity } from '../content-catalog'
defineProps<{ maturity: Maturity }>()
</script>
<template>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
    stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-if="maturity === 'seedling'" d="M7 12V8M7 9C4 9 2 7.6 2 5.1 4.7 5.1 7 6.5 7 9ZM7 8c0-3 1.7-4.8 5-5-.3 3.1-2 5-5 5Z" />
    <path v-else-if="maturity === 'budding'" d="M7 12.3V6.5m0 0c-2.4-.9-2.4-2.9 0-5.2 2.4 2.3 2.4 4.3 0 5.2Zm0 4.1C4.6 10.6 3.1 9.5 2.7 7 5.2 7 6.7 8.2 7 10.6Zm0-.9c2.6 0 3.9-1.3 4.3-3.6C8.9 6.2 7.3 7.4 7 9.7Z" />
    <path v-else d="M7 1.2 3.5 6h1.8L2 10.6h10L8.7 6h1.8L7 1.2Zm0 9.4v2.2" />
  </svg>
</template>
