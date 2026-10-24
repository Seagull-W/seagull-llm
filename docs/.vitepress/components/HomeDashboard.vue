<script setup lang="ts">

import { withBase } from 'vitepress'
import { data as issues } from '../data/research.data'

defineProps<{ sections: { title: string; details: string; link: string }[] }>()
</script>

<template>
  <div class="home-dashboard">
    <section class="research-panel" aria-labelledby="home-research-title">
      <header class="panel-heading">
        <div><h2 id="home-research-title">每日调研</h2><p>论文与社区进展，持续更新</p></div>
        <a :href="withBase('/research/')">全部调研</a>
      </header>
      <div class="research-window" tabindex="0" role="region" aria-label="最近三期每日调研">
        <a v-for="(issue, index) in issues.slice(0, 3)" :key="issue.url" class="research-item" :href="withBase(issue.url)">
          <div class="issue-date"><time :datetime="issue.date">{{ issue.date }}</time><span v-if="index === 0">最新</span></div>
          <h3>{{ issue.title }}</h3>
          <p>{{ issue.description }}</p>
        </a>
        <p v-if="!issues.length" class="empty">新的调研正在整理中。</p>
      </div>
    </section>
    <section class="sections-panel" aria-labelledby="home-sections-title">
      <header class="panel-heading">
        <div><h2 id="home-sections-title">学习栏目</h2><p>选择一个主题，继续阅读</p></div>
      </header>
      <div class="sections-window" tabindex="0" role="region" aria-label="学习栏目">
        <a v-for="section in sections" :key="section.link" class="section-card" :href="withBase(section.link)">
          <h3>{{ section.title }}</h3><p>{{ section.details }}</p><span>进入栏目</span>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-dashboard { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 28px; max-width: 1152px; margin: 0 auto 56px; padding: 0 2px; }
.research-panel, .sections-panel { min-width: 0; }
.research-panel { background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); border-radius: 16px; overflow: hidden; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 94px; padding: 18px 22px; border-bottom: 1px solid var(--vp-c-divider); }
.home-dashboard h2 { margin: 0; padding: 0; border: 0; background: none; font-size: 21px; line-height: 1.5; letter-spacing: 0; }
.home-dashboard p { margin: 4px 0 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.7; }
.panel-heading > a { flex: none; font-size: 13px; color: var(--vp-c-brand-1); }
.home-dashboard a { background-image: none; text-decoration: none; }
.research-window, .sections-window { height: 440px; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: var(--vp-c-border-hover) transparent; }
.research-window { padding: 0 20px; }
.research-item { display: block; padding: 20px 2px; border-bottom: 1px solid var(--vp-c-divider); color: var(--vp-c-text-1); }
.research-item:last-child { border-bottom: 0; }
.issue-date { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--vp-c-text-2); }
.issue-date span { padding: 0 7px; border-radius: 4px; color: var(--vp-c-brand-1); background: var(--vp-c-bg-soft); }
.home-dashboard h3 { margin: 8px 0 0; font-size: 16px; line-height: 1.6; color: var(--vp-c-text-1); letter-spacing: 0; }
.research-item:hover h3, .section-card:hover h3 { color: var(--vp-c-brand-1); }
.sections-panel .panel-heading { padding-inline: 2px; }
.scroll-buttons { display: flex; gap: 8px; }
.scroll-buttons button { width: 32px; height: 32px; border: 1px solid var(--vp-c-border); border-radius: 8px; color: var(--vp-c-text-1); }
.sections-window { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 14px; padding: 16px 5px 6px 2px; }
.section-card { display: flex; flex-direction: column; padding: 18px; min-height: 200px; border: 1px solid var(--vp-c-border); border-top: 3px solid var(--vp-c-brand-3); border-radius: 12px; background: var(--glass-bg); }
.section-card h3 { margin-top: 0; }
.section-card > span { margin-top: auto; padding-top: 16px; font-size: 12px; color: var(--vp-c-brand-1); }
.home-dashboard :focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -3px; }
.empty { padding: 20px; }
@media (max-width: 959px) { .home-dashboard { grid-template-columns: minmax(0, 1fr); gap: 24px; } .research-window { height: 400px; } .sections-window { height: 320px; } }
@media (max-width: 479px) { .panel-heading { padding-inline: 16px; } .research-window { padding-inline: 14px; } .sections-window { grid-template-columns: minmax(0, 1fr); } .section-card { min-height: 160px; } }
</style>
