<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { data as pages } from '../data/tagged-pages.data'
import { contextFor, excerpt, searchContent, type SearchDocument } from '../content-catalog'

const dialog = ref<HTMLDialogElement>()
const input = ref<HTMLInputElement>()
const query = ref('')
const documents = shallowRef<SearchDocument[]>([])
const loading = ref(false), failed = ref(false), limit = ref(12)
const results = computed(() => searchContent(pages, documents.value, query.value))
const route = useRoute()
let loaded = false
let trigger: HTMLElement | null = null
let oldOverflow = ''
let opened = false
async function load() {
  if (loaded || loading.value) return
  loading.value = true; failed.value = false
  try { documents.value = (await import('../data/search.data')).data; loaded = true }
  catch { failed.value = true }
  finally { loading.value = false }
}
async function open() {
  if (opened) return
  trigger = document.activeElement as HTMLElement
  oldOverflow = document.documentElement.style.overflow
  dialog.value?.showModal(); opened = true
  document.documentElement.style.overflow = 'hidden'
  await nextTick(); input.value?.focus()
  void load()
}
function restore() {
  if (!opened) return
  opened = false; document.documentElement.style.overflow = oldOverflow
  trigger?.focus({ preventScroll: true })
}
function close() { dialog.value?.close(); restore() }
function shortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open() }
}
function move(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
  const targets = [input.value!, ...Array.from(dialog.value!.querySelectorAll<HTMLAnchorElement>('.search-hit > a'))]
  const i = targets.indexOf(document.activeElement as HTMLInputElement)
  const next = targets[Math.max(0, Math.min(targets.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1)))]
  event.preventDefault(); next?.focus()
}
watch(query, () => { limit.value = 12 })
watch(() => route.path, close)
onMounted(() => { window.addEventListener('keydown', shortcut); window.addEventListener('seagull-search', open) })
onUnmounted(() => { close(); window.removeEventListener('keydown', shortcut); window.removeEventListener('seagull-search', open) })
</script>

<template>
  <button class="site-search-trigger" aria-haspopup="dialog" aria-label="搜索全部内容" @click="open">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
    <span>搜索</span><kbd>Ctrl K</kbd>
  </button>
  <dialog ref="dialog" class="search-dialog" aria-label="搜索全部内容" @close="restore" @click="($event.target === dialog) && close()" @keydown="move">
    <header><input ref="input" v-model="query" aria-label="搜索关键词" placeholder="搜索标题、主题或正文…" type="search" autocomplete="off" @keydown.enter.prevent="dialog?.querySelector<HTMLAnchorElement>('.search-hit > a')?.click()"><button aria-label="关闭搜索" @click="close">关闭</button></header>
    <div class="search-body">
      <template v-if="query.trim()">
        <p class="search-status" role="status">{{ loading ? '正在加载全文…' : `找到 ${results.length} 项内容` }}<span v-if="failed"> · 全文加载失败，<button @click="load">重试</button></span></p>
        <article v-for="{ page, matches } in results.slice(0, limit)" :key="page.url" class="search-hit">
          <a :href="withBase(page.url)" @click="close"><span class="search-context">{{ contextFor(page) }}</span><strong>{{ page.title }}</strong><p>{{ excerpt(page.description, query) }}</p></a>
          <div v-if="matches.some(m => m.anchor)" class="search-passages">
            <a v-for="match in matches.filter(m => m.anchor)" :key="match.anchor" :href="withBase(page.url) + '#' + encodeURIComponent(match.anchor)" @click="close"><span>↳ {{ match.title }}</span><small>{{ excerpt(match.text, query) }}</small></a>
          </div>
        </article>
        <button v-if="results.length > limit" class="search-more" @click="limit += 12">再显示 12 项</button>
        <p v-if="!results.length && !loading" class="search-empty">没有匹配的内容，试试更短的关键词。</p>
      </template>
      <div v-else class="search-empty"><p>可以搜索正文，也可以直接找主题。</p><div class="search-suggestions"><button v-for="term in ['强化学习', '智能体', '奖励建模', 'Linux']" :key="term" @click="query = term">{{ term }}</button></div><a :href="withBase('/tags')" @click="close">按栏目和主题浏览全部内容 →</a></div>
    </div>
    <footer>↑ ↓ 选择文章 · Enter 打开 · Esc 关闭</footer>
  </dialog>
</template>

<style scoped>
.site-search-trigger { display:flex; align-items:center; gap:8px; min-height:40px; padding:0 12px; border:1px solid var(--vp-c-divider); border-radius:7px; font-size:13px; color:var(--vp-c-text-2); background:var(--vp-c-bg-alt); }
kbd { margin-left:12px; font:11px var(--vp-font-family-base); opacity:.75; }
.search-dialog { position:fixed; inset:10vh 20px auto; margin:auto; width:700px; max-width:calc(100vw - 40px); max-height:80dvh; padding:0; border:1px solid var(--vp-c-divider); border-radius:12px; color:var(--vp-c-text-1); background:var(--vp-c-bg); box-shadow:0 20px 70px #0003; }
.search-dialog[open] { display:flex; flex-direction:column; }
.search-dialog::backdrop { background:#0c202c88; }
header { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--vp-c-divider); }
input { flex:1; min-width:0; font-size:17px; min-height:40px; }
header button { min-width:40px; min-height:40px; font-size:13px; color:var(--vp-c-text-2); }
.search-body { overflow:auto; overscroll-behavior:contain; padding:0 20px 20px; }
.search-status { font-size:12px; color:var(--vp-c-text-2); margin:16px 0 6px; }
.search-hit { border-bottom:1px solid var(--vp-c-divider); padding:8px 0 14px; }
.search-hit > a { display:block; padding:8px; border-radius:6px; }
.search-hit a:hover, .search-hit a:focus-visible { background:var(--vp-c-bg-soft); }
.search-context { display:block; font-size:12px; color:var(--vp-c-text-2); margin-bottom:6px; }
strong { display:block; font-size:17px; line-height:1.6; font-weight:600; }
.search-hit p { margin:6px 0 0; font-size:13px; line-height:1.8; color:var(--vp-c-text-2); }
.search-passages { margin:4px 8px 0 18px; padding-left:12px; border-left:2px solid var(--vp-c-divider); }
.search-passages a { display:block; padding:6px; font-size:13px; color:var(--vp-c-brand-1); }
.search-passages small { display:block; margin-top:3px; font-size:12px; line-height:1.7; color:var(--vp-c-text-2); }
.search-empty { padding:26px 8px; color:var(--vp-c-text-2); font-size:14px; line-height:1.8; }
.search-suggestions { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 24px; }
.search-suggestions button { padding:8px 12px; background:var(--vp-c-bg-soft); border-radius:6px; }
.search-empty a,.search-status button { color:var(--vp-c-brand-1); }
.search-more { display:block; margin:18px auto 0; padding:8px 16px; color:var(--vp-c-brand-1); }
footer { border-top:1px solid var(--vp-c-divider); padding:10px 20px; font-size:11px; color:var(--vp-c-text-2); }
@media(max-width:767px) { kbd { display:none; } .site-search-trigger { border:0; background:transparent; padding:0 10px; } .search-dialog { inset:12px 12px auto; max-width:calc(100vw - 24px); max-height:calc(100dvh - 24px); } header { padding:10px 14px; } .search-body { padding-inline:14px; } footer { display:none; } }
</style>
