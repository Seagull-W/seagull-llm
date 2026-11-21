<script setup lang="ts">
import { pixelDaylightMatrix, pixelArtPalettes } from '../theme/pixel-daylight'
</script>
<template>
  <svg width="0" height="0" class="pixel-filter-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter v-for="(channels, id) in pixelArtPalettes" :id="id" :key="id" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" :values="pixelDaylightMatrix" />
        <feComponentTransfer>
          <feFuncR type="discrete" :tableValues="channels[0]" />
          <feFuncG type="discrete" :tableValues="channels[1]" />
          <feFuncB type="discrete" :tableValues="channels[2]" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
</template>
<style scoped>
.pixel-filter-defs { position:absolute; pointer-events:none; overflow:hidden; }
</style>
