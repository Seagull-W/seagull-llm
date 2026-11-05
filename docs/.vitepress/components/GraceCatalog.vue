<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { textSections as collections, type ContentEntry } from '../content-catalog'
import GraceEmblem from './GraceEmblem.vue'
import GraceVisitors from './GraceVisitors.vue'

const props = defineProps<{ pages: ContentEntry[] }>()
const selection = ref(collections[0].id)
const current = computed(() => collections.find(section => section.id === selection.value)!)
const articles = computed(() => props.pages.filter(page => page.section === current.value.id))
</script>

<template>
  <div class="grace-catalog">
    <fieldset class="grace-choices">
      <legend class="sr-only">选择栏目以查看篇目</legend>
      <label v-for="section in collections" :key="section.id">
        <input v-model="selection" type="radio" name="grace-home-section" :value="section.id" aria-controls="grace-catalog-detail" />
        <span class="grace-choice">
          <GraceEmblem class="grace-choice-icon" :section="section.id" />
          <span>{{ section.title }}</span>
        </span>
      </label>
    </fieldset>
    <section id="grace-catalog-detail" class="grace-detail" aria-labelledby="grace-detail-title">
      <div class="grace-detail-head">
        <div>
          <p class="grace-count">{{ articles.length }} 篇馆藏</p>
          <h3 id="grace-detail-title">{{ current.title }}</h3>
          <p class="grace-description">{{ current.description }}</p>
        </div>
        <GraceVisitors :key="current.id" :section="current.id" />
      </div>
      <ul class="grace-articles" aria-label="近期篇目">
        <li v-for="entry in articles.slice(0, 3)" :key="entry.url">
          <a :href="withBase(entry.url)">{{ entry.title }}</a>
        </li>
      </ul>
      <a class="grace-enter" :href="withBase('/' + current.id + '/')">进入栏目<span aria-hidden="true"> →</span></a>
    </section>
  </div>
</template>

<style scoped>
.grace-catalog { display:grid; grid-template-columns:minmax(165px,.7fr) minmax(0,1.4fr); border-top:1px solid var(--grace-panel-line); }
.grace-choices { display:flex; flex-direction:column; gap:2px; padding:14px 20px 0 0; margin:0; min-width:0; border:0; }
.grace-choices label { position:relative; cursor:pointer; }
.grace-choices input { position:absolute; width:1px; height:1px; clip-path:inset(50%); overflow:hidden; }
.grace-choice { display:flex; align-items:center; gap:10px; min-height:43px; padding:4px 13px; color:var(--grace-panel-muted); font:15px/1.45 var(--grace-serif); }
.grace-choice-icon { width:34px; height:31px; --grace-emblem-ink:var(--grace-panel-muted); }
.grace-choices input:checked + .grace-choice {
  color:var(--grace-panel-gold);
  background:linear-gradient(90deg,#a18e553e,#a18e5518 80%,transparent);
  box-shadow:inset 2px 0 var(--grace-panel-gold);
}
.grace-choices input:checked + .grace-choice .grace-choice-icon { --grace-emblem-ink:var(--grace-panel-gold); }
.grace-choices label:hover .grace-choice { color:var(--grace-panel-ink); }
.grace-choices input:focus-visible + .grace-choice { outline:2px solid var(--grace-panel-gold); outline-offset:-2px; }
.grace-detail { padding:18px 0 6px clamp(20px,3.5vw,48px); border-left:1px solid var(--grace-panel-line); min-width:0; }
.grace-detail-head { display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:94px; }
.grace-detail .grace-count { margin:0 0 4px; color:var(--grace-panel-muted); font:12px/1.5 var(--vp-font-family-base); letter-spacing:.05em; }
.grace-detail h3 { margin:0; padding:0; color:var(--grace-panel-ink); font:400 clamp(21px,2.1vw,29px)/1.45 var(--grace-serif); }
.grace-detail .grace-description { margin:5px 0 0; color:var(--grace-panel-muted); font:14px/1.7 var(--grace-serif); }
.grace-detail .grace-articles { margin:16px 0 12px; padding:0; list-style:none; border-top:1px solid var(--grace-panel-line); }
.grace-articles li { margin:0; border-bottom:1px solid color-mix(in srgb,var(--grace-panel-line) 65%,transparent); }
.grace-detail .grace-articles a { display:block; padding:9px 6px; font:14px/1.7 var(--grace-serif); color:var(--grace-panel-ink); text-decoration:none; }
.grace-detail .grace-articles a:is(:hover,:focus-visible) { color:var(--grace-panel-gold); background:var(--grace-sheen); box-shadow:inset 2px 0 var(--grace-panel-gold); }
.grace-detail .grace-enter { display:inline-flex; align-items:center; gap:12px; min-height:40px; color:var(--grace-panel-gold); font:14px/1.5 var(--grace-serif); }
.grace-detail a:hover { text-decoration:underline; text-underline-offset:4px; color:var(--grace-panel-gold); }
.grace-detail a:focus-visible { outline:2px solid var(--grace-panel-gold); outline-offset:3px; }
@media(max-width:639px) {
  .grace-catalog { display:block; }
  .grace-choices { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:2px 6px; padding:10px 0; }
  .grace-choice { min-height:44px; padding:4px 7px; gap:6px; font-size:13px; }
  .grace-choice-icon { width:27px; height:25px; }
  .grace-detail { border:0; border-top:1px solid var(--grace-panel-line); padding:14px 0 0; }
  .grace-detail-head { gap:8px; min-height:72px; }
  .grace-articles a { min-height:44px; }
}
@media(max-width:359px) {
  .grace-choice { padding-inline:3px; gap:4px; }
  .grace-choice-icon { width:20px; height:20px; }
}
</style>
