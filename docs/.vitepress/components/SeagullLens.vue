<script setup lang="ts">
import { withBase } from 'vitepress'
</script>
<template>
  <div class="seagull-lens"><img :src="withBase('/seagull.png')" alt="展翅飞翔的海鸥" width="720" height="420" fetchpriority="high" /></div>
</template>
<style scoped>
.seagull-lens { overflow:hidden; border-radius:48% 48% 6px 6px; }
img { display:block; width:100%; height:auto; aspect-ratio:720/420; object-fit:cover; }
</style>
