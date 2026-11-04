<script setup lang="ts">
import { pixelDaylightMatrix } from '../theme/pixel-daylight'
</script>
<template>
  <svg width="0" height="0" class="pixel-filter-defs" aria-hidden="true" focusable="false">
    <defs><filter id="pixel-daylight" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" :values="pixelDaylightMatrix" /></filter></defs>
  </svg>
</template>
<style scoped>
.pixel-filter-defs { position:absolute; pointer-events:none; overflow:hidden; }
</style>
