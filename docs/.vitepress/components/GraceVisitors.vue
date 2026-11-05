<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { graceCharacterFor, graceCharacters, graceParties, portraitPath } from './grace-characters'

const props = defineProps<{ section: string }>()
const first = graceCharacters.indexOf(graceCharacterFor(props.section))
const widthQuery = typeof window === 'undefined' ? undefined : window.matchMedia('(max-width: 959px)')
const compact = ref(widthQuery?.matches ?? false)
function syncWidth(event: MediaQueryListEvent) { compact.value = event.matches }
onMounted(() => widthQuery?.addEventListener('change', syncWidth))
onUnmounted(() => widthQuery?.removeEventListener('change', syncWidth))
const offset = ref(0)
const lead = computed(() => (first + offset.value) % graceCharacters.length)
const character = computed(() => graceCharacters[lead.value])
const partner = computed(() => {
  const pair = graceParties[Math.floor(lead.value / 2)]
  return pair[lead.value % 2 === 0 ? 1 : 0]
})
function next() {
  const step = compact.value ? 1 : 2
  offset.value = (offset.value + step) % graceCharacters.length
}
</script>

<template>
  <button type="button" class="grace-visitors grace-visitors-next" title="换一组人物" aria-label="换一组人物" @click="next">
    <span class="visitors-art" aria-hidden="true">
      <img :src="withBase(portraitPath(character))" width="112" height="110" alt="" loading="lazy" decoding="async" fetchpriority="low" />
      <img v-if="!compact" class="visitors-partner" :src="withBase(portraitPath(partner))" width="106" height="110" alt="" loading="lazy" decoding="async" fetchpriority="low" />
    </span>
    <span class="visitors-caption" aria-live="polite" aria-atomic="true">
      {{ character.name }}<span v-if="!compact"> · {{ partner.name }}</span>
      <svg viewBox="0 0 18 10" width="16" height="10" fill="none" stroke="currentColor" aria-hidden="true"><path d="M1 5h14M10.5 1l5 4-5 4" /></svg>
    </span>
  </button>
</template>

<style scoped>
.grace-visitors {
  flex:0 0 clamp(156px,15vw,205px); display:grid; align-content:end;
  min-width:0; padding:4px 4px 6px; color:var(--grace-panel-muted);
  cursor:pointer; border:0; background:transparent;
}
.visitors-art { display:flex; align-items:end; justify-content:center; height:104px; }
.visitors-art img { display:block; height:100%; width:52%; min-width:0; object-fit:contain; object-position:center bottom; }
.visitors-art .visitors-partner { width:49%; height:89%; margin-left:-1%; }
.visitors-caption {
  display:flex; align-items:center; justify-content:center; gap:3px;
  margin-top:4px; font:12px/1.5 var(--grace-serif); color:var(--grace-panel-gold);
}
.visitors-caption svg { flex:none; margin-left:5px; }
.grace-visitors:hover .visitors-caption { color:var(--grace-panel-ink); }
.grace-visitors:focus-visible { outline:2px solid var(--grace-panel-gold); outline-offset:2px; }
@media (max-width:959px) {
  .grace-visitors { flex-basis:85px; }
  .visitors-art { height:76px; }
  .visitors-art > img { width:100%; }
  .visitors-caption { font-size:11px; }
}
@media (max-width:359px) {
  .grace-visitors { flex-basis:69px; }
  .visitors-art { height:60px; }
}
</style>
