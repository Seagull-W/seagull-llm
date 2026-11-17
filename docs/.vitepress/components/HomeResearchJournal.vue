<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import catalog from '../../research/catalog.json'

defineProps<{ edition: 'paper' | 'pixel' }>()

// Like research-sidebar.ts, use the issue catalog: chapters belong to
// an issue, and its publication date can differ from a file's update date.
interface Edition {
  date: string
  title: string
  description: string
  route: string
  children?: { text: string; link: string }[]
}
const byMonth = new Map<string, Edition[]>()
const issues = [...catalog].sort((a, b) => b.date.localeCompare(a.date))
for (const issue of issues) {
  const month = issue.date.slice(0, 7)
  if (!byMonth.has(month)) byMonth.set(month, [])
  byMonth.get(month)!.push(issue)
}
const months = [...byMonth.keys()]
const month = ref(months[0] || '')
const expanded = ref(false)
const editions = computed(() => byMonth.get(month.value) || [])
const lead = computed(() => editions.value[0])
const briefCount = 3
const entries = computed(() => editions.value.slice(1, expanded.value ? undefined : 1 + briefCount))
const hiddenCount = computed(() => Math.max(0, editions.value.length - 1 - briefCount))
function monthLabel(month: string) {
  const [year, m] = month.split('-')
  return year + ' 年 ' + Number(m) + ' 月'
}
</script>

<template>
  <section v-if="edition === 'pixel' && issues.length" class="pixel-journal" aria-labelledby="pixel-journal-title">
    <h2 id="pixel-journal-title"><a :href="withBase('/research/')" aria-label="每日调研，打开归档">每日调研</a></h2>
    <ul>
      <li v-for="issue in issues.slice(0, 2)" :key="issue.route">
        <time :datetime="issue.date">{{ issue.date.slice(5).replace('-', '.') }}</time>
        <a :href="withBase(issue.route)">{{ issue.title }}</a>
      </li>
    </ul>
  </section>
  <section v-else-if="lead" class="paper-journal" aria-labelledby="paper-journal-title">
    <header class="journal-head">
      <h2 id="paper-journal-title">每日调研</h2>
      <div class="month-picker">
        <select v-model="month" aria-label="调研月份" @change="expanded = false">
          <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
        </select>
        <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6"><path d="m1 1 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
      <a class="archive-entry" :href="withBase('/research/')">调研归档 <span aria-hidden="true">→</span></a>
    </header>
    <div class="journal-spread" :class="{ 'single-edition': !entries.length }">
      <article class="lead-edition">
        <time :datetime="lead.date">{{ lead.date.replaceAll('-', '.') }}</time>
        <h3><a :href="withBase(lead.route)">{{ lead.title }}</a></h3>
        <p v-if="lead.description">{{ lead.description }}</p>
        <span v-if="lead.children?.length" class="chapter-count">全 {{ lead.children.length }} 章</span>
      </article>
      <div v-if="entries.length" class="issue-ledger">
        <ul id="paper-journal-entries">
          <li v-for="entry in entries" :key="entry.route">
            <time :datetime="entry.date">{{ entry.date.slice(5).replace('-', '/') }}</time>
            <a :href="withBase(entry.route)">{{ entry.title }}<small v-if="entry.children?.length" class="chapter-count">全 {{ entry.children.length }} 章</small></a>
          </li>
        </ul>
        <button v-if="hiddenCount" type="button" class="expand-editions" :aria-expanded="expanded" aria-controls="paper-journal-entries" @click="expanded = !expanded">
          <span aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
          {{ expanded ? '收起更多期目' : '展开其余 ' + hiddenCount + ' 期' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pixel-journal {
  display: grid; grid-template-columns: minmax(130px,.6fr) minmax(0,2fr); gap: 6px 24px;
  margin-top: 28px; padding: 13px 0 0; border-top: 2px solid var(--vp-c-text-1);
}
.pixel-journal h2 { margin: 0; padding: 0; border: 0; font-size: 22px; line-height: 1.45; }
.pixel-journal a { color: var(--vp-c-text-1); text-decoration: none; overflow-wrap: anywhere; }
.pixel-journal a:hover, .pixel-journal a:focus-visible { text-decoration: underline; text-underline-offset: .2em; }
.pixel-journal ul { display: grid; gap: 4px; list-style: none; margin: 0; padding: 0; }
.pixel-journal li { display: grid; align-items: baseline; grid-template-columns: 3.2em minmax(0,1fr); gap: 8px; margin: 0; }
.pixel-journal time { font: 13px/1.5 var(--vp-font-family-mono); color: var(--vp-c-text-2); }
.pixel-journal li a { padding: 3px 0; font: 400 15px/1.55 var(--vp-font-family-base); }
.pixel-journal li:first-child a { font-weight: 600; }
@media (max-width: 660px) {
  .pixel-journal { grid-template-columns: minmax(0,1fr); }
}
@media (pointer: coarse) {
  .pixel-journal a { display: inline-flex; align-items: center; min-height: 44px; }
}
.paper-journal {
  --journal-type: 'Seagull Academic Serif', 'Noto Serif SC', SimSun, serif;
  margin: clamp(36px, 5vw, 68px) 0 0;
  padding-top: 10px;
  border-top: 2px solid var(--vp-c-text-1);
  color: var(--vp-c-text-1);
}
.journal-head { display: flex; align-items: center; flex-wrap: wrap; gap: 4px clamp(12px, 2vw, 26px); }
.paper-journal h2, .paper-journal h3 { padding: 0; margin: 0; border: 0; letter-spacing: normal; }
.journal-head h2 { font: 600 clamp(21px, 2vw, 28px)/1.5 var(--journal-type); }
.month-picker { display: inline-flex; align-items: center; position: relative; color: var(--vp-c-text-2); }
.month-picker select {
  min-height: 44px; padding: 0 17px 0 2px; border: 0; appearance: none; border-radius: 0;
  color: inherit; background: transparent; font: inherit; font-size: 13px; cursor: pointer;
}
.month-picker select option { background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.month-picker svg { position: absolute; right: 1px; pointer-events: none; }
.paper-journal a { color: inherit; text-decoration: none; }
.paper-journal a:hover { color: var(--vp-c-brand-1); text-decoration: underline; text-underline-offset: .22em; }
.paper-journal :is(a, select, button):focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.paper-journal .archive-entry {
  margin-inline-start: auto; display: inline-flex; align-items: center; gap: 5px; min-height: 44px;
  color: var(--vp-c-brand-1); font-size: 13px; white-space: nowrap;
}
.journal-spread { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: clamp(24px, 4vw, 56px); margin-top: 12px; }
.journal-spread.single-edition { grid-template-columns: minmax(0, 42rem); }
.journal-spread time { color: var(--vp-c-text-2); font: 14px/1.45 Georgia, serif; font-variant-numeric: tabular-nums; }
.lead-edition time { color: var(--vp-c-brand-1); letter-spacing: .05em; }
.lead-edition h3 { margin: 6px 0; font: 600 clamp(19px, 2vw, 26px)/1.45 var(--journal-type); }
.lead-edition p { margin: 7px 0 0; font-size: 14px; line-height: 1.75; color: var(--vp-c-text-2); }
.journal-spread :is(h3, a, p) { overflow-wrap: anywhere; }
.issue-ledger ul { list-style: none; margin: 0; padding: 0; }
.issue-ledger li { display: grid; grid-template-columns: 3rem 1fr; gap: 8px; margin: 0; align-items: baseline; border-top: 1px solid var(--vp-c-divider); }
.issue-ledger li a { display: grid; align-content: center; min-height: 44px; padding-block: 8px; font: 600 15px/1.55 var(--journal-type); }
.chapter-count { display: block; color: var(--vp-c-text-2); font: 12px/1.5 var(--vp-font-family-base); }
.expand-editions { display: flex; gap: 6px; align-items: center; min-height: 44px; margin-left: 0; color: var(--vp-c-brand-1); font-size: 13px; }
.expand-editions:hover { text-decoration: underline; text-underline-offset: .22em; }
@media (max-width: 767px) {
  .paper-journal { margin-top: 34px; }
  .journal-head { gap: 3px 10px; }
  .journal-spread { grid-template-columns: minmax(0, 1fr); gap: 15px; margin-top: 8px; }
  .issue-ledger li { grid-template-columns: 2.8rem 1fr; }
}
</style>
