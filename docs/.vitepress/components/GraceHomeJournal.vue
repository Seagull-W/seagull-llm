<script setup lang="ts">
import { withBase } from 'vitepress'
import { graceIssues } from './grace-home-data'

defineProps<{ night?: boolean }>()
</script>

<template>
  <section v-if="graceIssues.length" class="grace-journal" :class="{ 'is-night': night }" aria-labelledby="grace-journal-heading">
    <h2 id="grace-journal-heading"><a :href="withBase('/research/')" aria-label="每日调研，进入归档">每日调研 <span aria-hidden="true">↗</span></a></h2>
    <ol>
      <li v-for="issue in graceIssues.slice(0, night ? 3 : 2)" :key="issue.route">
        <time :datetime="issue.date">{{ issue.date.slice(5).replace('-', '.') }}</time>
        <a :href="withBase(issue.route)">{{ issue.title }}</a>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.grace-journal { display:grid; grid-template-columns:auto 1fr; align-items:baseline; gap:24px; padding:17px 0; border-block:1px solid var(--grace-etch); font-family:var(--grace-serif); }
.grace-journal a { color:inherit; text-decoration:none; }
.grace-journal h2 { margin:0; padding:0; border:0; scroll-margin-top:calc(var(--vp-nav-height,64px) + 12px); font:500 19px/1.45 var(--grace-serif); white-space:nowrap; }
.grace-journal h2 span { color:var(--vp-c-brand-1); font:13px Georgia,serif; }
.grace-journal ol { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; margin:0; padding:0; list-style:none; }
.grace-journal li { display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:baseline; margin:0; font:15px/1.65 var(--grace-serif); }
.grace-journal time { color:var(--vp-c-text-2); font:italic 14px Georgia,serif; font-variant-numeric:tabular-nums; }
.grace-journal a:is(:hover,:focus-visible) { text-decoration:underline; text-underline-offset:.23em; }
.grace-journal.is-night { display:block; border:0; padding:0; color:#e8e1ca; }
.is-night h2 { color:#dfcd98; }
.is-night ol { display:block; margin-top:12px; }
.is-night li { display:block; padding:14px 0; border-top:1px solid #756d4f90; }
.is-night time { display:block; margin-bottom:5px; color:#bcb399; }
@media(max-width:700px) {
  .grace-journal { display:block; }
  .grace-journal ol { display:block; margin-top:9px; }
  .grace-journal li, .grace-journal.is-night li { display:grid; grid-template-columns:3em 1fr; padding:8px 0; }
}
</style>
