<script setup lang="ts">
defineProps<{ night: boolean }>()
</script>
<template>
  <svg class="window-light" :class="{ 'is-night': night }" width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden="true" focusable="false">
    <path class="window-sky" d="M5 4h16v21H5z" />
    <path class="window-hill" d="M5 19c5-5 7-2 10-4l6-2v12H5z" />
    <path class="window-glow" d="M16 19h2v3h-2z" />
    <circle class="window-sun" cx="17" cy="9" r="2" />
    <path d="M4 3h18v23H4zM13 3v23M4 13h18M2 28h22" stroke="currentColor" stroke-width="1.3" />
    <path d="m4 3-2 2v19l2 2" stroke="currentColor" stroke-width="1.1" />
  </svg>
</template>
<style scoped>
.window-light { flex:none; }
.window-sky { fill:#a6bdc4; transition:fill .3s; }
.window-hill { fill:#7d8b68; transition:fill .3s; }
.window-glow { fill:#e5c290; opacity:0; transition:opacity .3s; }
.window-sun { fill:#ece7ce; transition:opacity .3s; }
.is-night .window-sky { fill:#34443e; }
.is-night .window-hill { fill:#242f27; }
.is-night .window-glow { opacity:1; }
.is-night .window-sun { opacity:0; }
@media(prefers-reduced-motion:reduce) { .window-sky,.window-hill,.window-glow,.window-sun { transition:none; } }
</style>
