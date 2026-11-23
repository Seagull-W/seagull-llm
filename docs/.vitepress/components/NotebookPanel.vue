<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import NoteCard, { type CardAction, type CardMode } from './NoteCard.vue'
import ReaderIcon from './ReaderIcon.vue'
import type { Annotation, Bookmark, Entry, Kind, PaperNote } from './annotations'
type Section = Entry['type']
const props = defineProps<{ kind:Kind; annotations:Annotation[]; papers:PaperNote[]; bookmarks:Bookmark[]; active:string
  author:boolean; status:string; conflict:boolean; localCount:number; images:Map<string,string>; missing:string[]; canUndo:boolean }>()
const section = defineModel<Section>('section',{required:true})
const emit = defineEmits<{ close:[]; retry:[]; login:[]; logout:[]; importLocal:[]; resolve:[]; backup:[format:'json'|'md']; import:[file:File]; undo:[]
  addPaper:[]; addBookmark:[]; bookmark:[entry:Bookmark]; remove:[entry:Entry]; body:[entry:Annotation|PaperNote,body:string]
  action:[entry:Annotation|PaperNote,name:CardAction,part?:number]; layout:[] }>()
const panel = ref<HTMLElement>(), file = ref<HTMLInputElement>(), backup = ref<HTMLDetailsElement>()
const editing = ref(''), mode = ref<CardMode>('read'), sort = ref('position'), favorites = ref(false)
const numbers = computed(() => new Map(props.annotations.map((n,i) => [n.id,i+1])))
const order = computed(() => {
  const list = props.annotations.filter(n => !favorites.value || n.favorite)
  if (sort.value==='time') list.sort((a,b) => Date.parse(b.created)-Date.parse(a.created) || a.id.localeCompare(b.id))
  return list
})
const tabs = computed(() => [
  { key:'annotation' as const, label:'原文批注', count:props.annotations.length },
  { key:'paper' as const, label:'整篇笔记', count:props.papers.length },
  ...(props.kind==='pdf'?[{ key:'bookmark' as const, label:'页面书签', count:props.bookmarks.length }]:[])
])

function setMode(id:string, value:CardMode) { editing.value=value==='read'?'':id; mode.value=value; nextTick(() => emit('layout')) }
async function reveal(n:Annotation|PaperNote, edit:boolean) {
  section.value=n.type
  if (n.type==='annotation' && !n.favorite) favorites.value=false
  if (edit) setMode(n.id,'edit')
  else if (editing.value!==n.id) setMode('','read')
  await nextTick()
  const card=panel.value?.querySelector<HTMLElement>('[data-note-id="'+n.id+'"]')
  const list=card?.closest<HTMLElement>('.notebook-list')
  if (card && list) {
    const field=edit ? card.querySelector('textarea') : null
    field?.focus({preventScroll:true})
    const row=card.getBoundingClientRect(), view=list.getBoundingClientRect()
    let {top,bottom}=row
    if (field && row.height > view.height) {
      top=(field.labels?.[0] ?? field).getBoundingClientRect().top
      bottom=field.getBoundingClientRect().bottom
    }
    if (top < view.top+5 || bottom > view.bottom-5) list.scrollTop+=top-view.top-6
  }
  emit('layout')
}
function pickFile(e:Event) {
  const input=e.target as HTMLInputElement
  if (input.files?.[0]) emit('import',input.files[0])
  input.value=''
}
function backupAction(action:'json'|'md'|'import') {
  if (backup.value) backup.value.open=false
  if (action==='import') file.value?.click()
  else emit('backup',action)
}
function outside(e:Event) {
  for (const menu of panel.value?.querySelectorAll<HTMLDetailsElement>('details.notebook-menu[open]') ?? []) {
    if (!menu.contains(e.target as Node)) menu.open=false
  }
}
function escape(e:KeyboardEvent) {
  if (e.key!=='Escape' || e.isComposing || e.keyCode===229) return
  const menu=panel.value?.querySelector<HTMLDetailsElement>('.notebook-menu[open]')
  if (menu) { e.stopPropagation(); menu.open=false; menu.querySelector('summary')?.focus() }
  else if (editing.value) {
    e.stopPropagation()
    const card=panel.value?.querySelector<HTMLElement>('[data-note-id="'+editing.value+'"]')
    setMode('','read')
    nextTick(() => card?.querySelector<HTMLButtonElement>('.edit-note')?.focus({ preventScroll:true }))
  }
}
watch(section,() => { nextTick(() => emit('layout')) })
onMounted(() => document.addEventListener('pointerdown',outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown',outside))
defineExpose({reveal, finish:() => setMode('','read')})
</script>
<template>
  <aside ref="panel" class="notebook-panel" aria-label="阅读笔记" @keydown="escape">
    <header class="notebook-head">
      <strong>{{author ? (section==='annotation' ? '页边批注' : '我的笔记') : '作者批注'}}</strong>
      <button v-if="!author" class="notebook-login" title="使用首选网易邮箱或备用邮箱接收验证码" @click="emit('login')">作者登录</button>
      <details v-if="author" ref="backup" class="notebook-menu"><summary title="备份与导出" aria-label="备份与导出"><ReaderIcon name="more" /></summary>
        <div class="menu-items"><button @click="backupAction('json')">导出 JSON 备份</button><button @click="backupAction('md')">导出 Markdown</button><button @click="backupAction('import')">导入笔记备份</button><button @click="emit('logout')">退出登录</button></div>
      </details>
      <input ref="file" type="file" accept=".json,application/json" hidden @change="pickFile" />
      <button title="收起笔记" aria-label="收起笔记" @click="emit('close')"><ReaderIcon name="close" /></button>
    </header>
    <div v-if="author && localCount" class="notebook-filters"><button @click="emit('importLocal')">导入本篇 {{localCount}} 条本机笔记为私有</button></div>
    <nav v-if="author" class="notebook-tabs" aria-label="笔记分类">
      <button v-for="tab in tabs" :key="tab.key" :aria-pressed="section===tab.key" @click="section=tab.key;setMode('','read')">{{tab.label}}<span v-if="tab.count">{{tab.count}}</span></button>
    </nav>
    <div v-show="section==='annotation'" class="notebook-section">
      <div v-if="annotations.length" class="notebook-filters">
        <select v-model="sort" aria-label="批注排序"><option value="position">{{kind==='pdf'?'按页码':'按原文位置'}}</option><option value="time">按创建时间</option></select>
        <button v-if="author" :aria-pressed="favorites" @click="favorites=!favorites"><ReaderIcon name="star" />只看收藏</button>
      </div>
      <div class="notebook-list">
        <p v-if="!order.length" class="notebook-empty">{{!author?'暂无公开批注。':favorites?'暂无收藏的选文。':kind==='pdf'?'拖选文字或点选图像，按 Enter 写批注。':'选中原文后按 Enter 写批注。'}}</p>
        <NoteCard :author="author" v-for="n in order" :key="n.id" :note="n" :number="numbers.get(n.id)!" :mode="editing===n.id?mode:'read'" :active="active===n.id" :images="images" :show-time="sort==='time'" :missing="missing.includes(n.id)"
          @action="(name,part)=>emit('action',n,name,part)" @mode="setMode(n.id,$event)" @body="emit('body',n,$event)" />
      </div>
    </div>
    <div v-if="author" v-show="section==='paper'" class="notebook-section">
      <div class="notebook-filters"><button @click="emit('addPaper')"><ReaderIcon name="plus" />写整篇笔记</button></div>
      <div class="notebook-list">
        <p v-if="!papers.length" class="notebook-empty">在这里记录对整篇文档的理解。</p>
        <NoteCard :author="author" v-for="n in papers" :key="n.id" :note="n" :number="0" :mode="editing===n.id?mode:'read'" :active="active===n.id"
          @action="emit('action',n,$event)" @mode="setMode(n.id,$event)" @body="emit('body',n,$event)" />
      </div>
    </div>
    <div v-if="author && kind==='pdf'" v-show="section==='bookmark'" class="notebook-section">
      <div class="notebook-filters"><button @click="emit('addBookmark')"><ReaderIcon name="bookmark" />标记当前阅读位置</button></div>
      <div class="notebook-list">
        <p v-if="!bookmarks.length" class="notebook-empty">书签会记住页码和页内的阅读位置。</p>
        <div v-for="n in bookmarks" :key="n.id" class="bookmark-row">
          <button @click="emit('bookmark',n)"><ReaderIcon name="bookmark" /><strong>第 {{n.position.page}} 页</strong><small>页内 {{Math.round(n.position.y*100)}}%</small></button>
          <button aria-label="删除书签" title="删除书签" @click="emit('remove',n)"><ReaderIcon name="close" /></button>
        </div>
      </div>
    </div>
    <footer class="notebook-save" role="status">
      <span>{{status}}</span>
      <button @click="emit('retry')">刷新</button><button v-if="author && conflict" @click="emit('resolve')">保留云端版本，将本机编辑另存为私有副本</button>
      <button v-if="author && canUndo" class="undo-note" @click="emit('undo')">撤销删除</button>
    </footer>
  </aside>
</template>
