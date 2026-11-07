<script setup lang="ts">
import { useData } from 'vitepress'
import InterfaceIcon from './InterfaceIcon.vue'
import StyleSwitcher from './StyleSwitcher.vue'
import WindowLight from './WindowLight.vue'
import { useVisualStyle } from '../theme/visual-styles'
import { cancelPicturePreview, changeAppearance, previewAppearancePicture, warmAppearancePicture } from '../theme/appearance-motion'
import '../theme/styles/appearance-motion.css'
const { isDark } = useData()
const style = useVisualStyle()

function toggleDaylight() {
  warmAppearancePicture(style.value, !isDark.value)
  changeAppearance(style.value.iconSet, () => { isDark.value = !isDark.value })
}
</script>

<template>
  <div class="seagull-nav-actions"><slot />
    <StyleSwitcher />
    <button class="theme-toggle" type="button" :aria-pressed="isDark" :title="isDark ? '切换到浅色模式' : '切换到深色模式'" aria-label="深色主题"
      @pointerenter="previewAppearancePicture(style, !isDark)" @pointerleave="cancelPicturePreview"
      @focus="previewAppearancePicture(style, !isDark)" @blur="cancelPicturePreview" @click="toggleDaylight">
      <WindowLight v-if="style.iconSet === 'cinema'" :night="isDark" /><InterfaceIcon v-else :name="isDark ? 'moon' : 'sun'" /><span class="action-label">主题</span>
    </button>
  </div>
</template>

<style scoped>
.seagull-nav-actions { display: flex; align-items: center; flex: none; gap: 8px; padding-left: 10px; }
button, a { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 40px; padding: 0 8px; border: 0; border-radius: 6px; color: var(--vp-c-text-1); font-size: 13px; white-space: nowrap; }
button:hover, a:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
button:focus-visible, a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
@media (max-width: 639px) { .action-label { display: none; } .seagull-nav-actions { gap: 2px; padding-left: 0; } }
</style>
