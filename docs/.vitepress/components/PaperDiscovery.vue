<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { sections, type ContentEntry } from '../content-catalog'
import { researchCards } from '../research-sidebar'
import SectionArtwork from './SectionArtwork.vue'
import { getHomeTopics, discoveryGroups } from './home-discovery-data'

const props = defineProps<{ pages: ContentEntry[] }>()
const root = ref<HTMLElement>()
const narrow = ref(false)
const mounted = ref(false)
const picked = ref('')
let breakpoint: MediaQueryList | undefined
const topics = computed(() => getHomeTopics(props.pages))
const maxStops = computed(() => Math.max(1, ...topics.value.map(topic => topic.readings.length)))
const mobileStart = computed(() => topics.value.find(t => t.key === 'gpu') ?? topics.value[0])
const active = computed(() => topics.value.find(t => t.key === picked.value)
  ?? topics.value.find(t => t.key === (narrow.value ? 'gpu' : 'sandbox')) ?? topics.value[0])
const blocks = computed(() => narrow.value ? ['topics', 'directory'] : ['directory', 'topics'])
const byId = new Map(sections.map(s => [s.id, s]))
const sectionUrl = (id: string) => withBase('/' + id + '/')
const groups = computed(() => {
  const counts = new Map<string, number>()
  for (const p of props.pages) counts.set(p.section, (counts.get(p.section) ?? 0) + 1)
  return discoveryGroups.map(group => ({
    ...group,
    sections: group.sectionIds.flatMap(id => {
      const section = byId.get(id)
      return section ? [{
        ...section, count: id === 'research' ? researchCards.length : counts.get(id) ?? 0,
        unit: id === 'research' ? '期' : id === 'videos' ? '部' : '篇',
      }] : []
    }),
  }))
})

function turnPage() {
  if (!active.value || topics.value.length < 2) return
  const first = mobileStart.value!
  const choices = [first, ...topics.value.filter(t => t !== first)]
  picked.value = choices[(choices.indexOf(active.value) + 1) % choices.length].key
}
function focusDirectory() {
  // VitePress moves the viewport for hash links; move the keyboard starting point with it.
  root.value?.querySelector<HTMLElement>('#paper-directory')?.focus({ preventScroll: true })
}

function arrange() {
  const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const within = !!focus && root.value?.contains(focus)
  narrow.value = !!breakpoint?.matches
  // Moving keyed sections also puts their links in visual reading order for keyboard users.
  if (within) nextTick(() => {
    if (focus && focus.isConnected && focus.getClientRects().length && !focus.closest('[inert]')) {
      focus.focus({ preventScroll: true })
    } else {
      root.value?.querySelector<HTMLButtonElement>(narrow.value ? '.p-turn' : '.p-choice[aria-pressed=true]')?.focus({ preventScroll: true })
    }
  })
}
onMounted(() => {
  breakpoint = window.matchMedia('(max-width: 767px)')
  arrange()
  mounted.value = true
  breakpoint.addEventListener('change', arrange)
})
onUnmounted(() => breakpoint?.removeEventListener('change', arrange))
</script>

<template>
  <div ref="root" class="paper-discovery" :class="{ 'p-awaiting': !mounted }">
    <template v-for="block in blocks" :key="block">
      <nav v-if="block === 'directory'" id="paper-directory" tabindex="-1" class="p-directory" aria-label="栏目直达">
        <h2 class="p-directory-title">栏目直达</h2>
        <div class="p-atlas">
          <section v-for="group in groups" :key="group.art" class="p-leaf" :data-art="group.art">
            <div class="p-crest">
              <SectionArtwork class="p-crest-art" :section="group.art" />
              <h3>{{ group.name }}</h3>
            </div>
            <div class="p-entries">
              <a v-for="section in group.sections" :key="section.id" class="p-entry" :href="sectionUrl(section.id)">
                <span>{{ section.title }}</span><small>{{ section.count }} {{ section.unit }}</small>
              </a>
            </div>
          </section>
        </div>
      </nav>

      <section v-else-if="active" class="p-topics" aria-labelledby="paper-topic-heading">
        <header class="p-bar">
          <h2 id="paper-topic-heading"><span class="p-wide">跨栏选读</span><span class="p-small">专题选读</span></h2>
          <div v-if="topics.length > 1" class="p-controls p-wide" role="group" aria-label="选择专题">
            <button v-for="topic in topics" :key="topic.key" class="p-choice" type="button"
              :aria-pressed="active.key === topic.key" @click="picked = topic.key">{{ topic.short }}</button>
          </div>
          <a class="p-jump p-small" href="#paper-directory" @click.left.exact="focusDirectory">栏目直达 <span aria-hidden="true">↓</span></a>
          <button v-if="topics.length > 1" class="p-small p-turn" type="button" @click="turnPage"
            :aria-label="'翻一题，当前专题：' + (mounted ? active.short : mobileStart?.short)">翻一题 <span aria-hidden="true">↗</span></button>
        </header>

        <!-- Inactive sheets participate in intrinsic sizing but never in hit testing or the focus order. -->
        <div class="p-stage" :class="{ 'p-turned': picked }" :style="{ '--p-stops': maxStops, '--p-rows': maxStops + 1 }">
          <article v-for="topic in topics" :key="topic.key" class="p-sheet"
            :class="{ 'p-current': active.key === topic.key, 'p-mobile-start': mobileStart?.key === topic.key }"
            :inert="mounted && active.key !== topic.key" :aria-hidden="mounted ? active.key !== topic.key : undefined">
            <div class="p-upper">
              <h3>{{ topic.name }}</h3>
              <p v-if="topic.deck" class="p-deck">{{ topic.deck }}</p>
              <figure v-if="topic.key === 'gpu' && topic.readings.some(r => r.page.url.includes('simt-kernels'))" class="p-proof p-matrix">
                <img :src="withBase('/cuda-notes/figures/2-2/transpose.png')" width="1228" height="523" loading="lazy" decoding="async"
                  alt="转置前后，绿色图块所在的列和行互换" />
                <figcaption>分块转置 · CUDA SIMT 内核笔记原图</figcaption>
              </figure>
              <figure v-else-if="topic.key === 'sandbox' && topic.readings.some(r => r.page.section === 'linux-notes')" class="p-proof">
                <dl class="p-boundaries">
                  <div><dt>Namespace</dt><dd>进程看见什么</dd></div>
                  <div><dt>cgroups</dt><dd>能用多少资源</dd></div>
                  <div><dt>seccomp</dt><dd>允许哪些系统调用</dd></div>
                </dl>
                <figcaption>据《Linux 隔离机制》整理</figcaption>
              </figure>
              <figure v-else-if="topic.key === 'reward' && topic.readings.some(r => r.page.url.includes('训练实验'))" class="p-proof">
                <dl class="p-values">
                  <div><dt>bf16</dt><dd>76.34%</dd></div>
                  <div><dt>f32</dt><dd>78.06%</dd></div>
                </dl>
                <figcaption>第 524 步 · 验证偏好准确率</figcaption>
              </figure>
            </div>
            <ol class="p-stops">
              <li v-for="{ role, page } in topic.readings" :key="page.url" class="p-stop">
                <span class="p-role">{{ role }}</span>
                <a class="p-article" :href="withBase(page.url)">{{ page.title }}</a>
                <a v-if="byId.has(page.section)" class="p-source" :href="sectionUrl(page.section)">{{ byId.get(page.section)?.title }} <span aria-hidden="true">↗</span></a>
              </li>
            </ol>
          </article>
        </div>
        <span class="p-sr" role="status">{{ picked ? active.name : '' }}</span>
      </section>
    </template>
  </div>
</template>

<style scoped src="./paper-discovery.css"></style>
