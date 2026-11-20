<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import NotebookPanel from './NotebookPanel.vue'
import NotebookDivider from './NotebookDivider.vue'
import SelectionToolbar from './SelectionToolbar.vue'
import { useAnnotationSource } from './useAnnotationSource'
import { useCloudNotebook } from './useCloudNotebook'
import { useNotebook } from './useNotebook'
import { cropPdfBox } from './pdf-selection'
import { jsonBackup, markdownBackup, newerEntry, parseBackup, type Anchor, type Annotation, type Bookmark, type Entry, type Kind, type PaperNote } from './annotations'
import type { CardAction } from './NoteCard.vue'
import './notebook.css'

const props = defineProps<{ target?: HTMLElement; document:string; title:string; kind:Kind; docked?:boolean; boxActive?:boolean }>()
const open = defineModel<boolean>('open',{required:true})
const emit = defineEmits<{ boxMode:[active:boolean]; author:[value:boolean] }>()
const legacy = useNotebook(props.document,props.kind)
const { records, author, status, conflicts, login, logout, edit, retry, resolveConflicts } = useCloudNotebook(props.document,props.kind)
const currentById = computed(() => new Map(records.value.map(n => [n.id,n])))
const localImports = computed(() => legacy.records.value.filter(n => !n.deleted && !currentById.value.has(n.id)))
function importLocal() { if (author.value) for (const n of localImports.value) edit(n.type==='annotation' ? {...n,published:false} : n) }
const host = ref<HTMLElement>(), panel = ref<InstanceType<typeof NotebookPanel>>()
const section = ref<Entry['type']>('annotation'), active = ref(''), message = ref('')
const undo = shallowRef<() => void>()
let messageTimer: ReturnType<typeof setTimeout>
function notice(text:string) { message.value=text; clearTimeout(messageTimer); messageTimer=setTimeout(() => { message.value='' },3200) }
const annotations = computed(() => records.value.filter((n): n is Annotation => !n.deleted && n.type==='annotation').sort((a,b) => {
  const x=a.anchor.boxes[0], y=b.anchor.boxes[0]
  return x && y ? x.page-y.page || x.y-y.y || x.x-y.x || a.id.localeCompare(b.id) : (a.anchor.start??0)-(b.anchor.start??0)
}))
const papers = computed(() => records.value.filter((n): n is PaperNote => !n.deleted && n.type==='paper').sort((a,b) => Date.parse(b.created)-Date.parse(a.created)))
const bookmarks = computed(() => records.value.filter((n): n is Bookmark => !n.deleted && n.type==='bookmark').sort((a,b) => a.position.page-b.position.page || a.position.y-b.position.y))
const markSources = computed<Annotation[]>(previous => {
  const rows=annotations.value
  return previous?.length===rows.length && rows.every((n,i) => n.id===previous[i].id && n.anchor===previous[i].anchor && n.highlighted===previous[i].highlighted) ? previous : rows
})
const { marks,missing,selection,visualRects,toolPoint,clearSelection,boxMode,connector,sourceImages,layout,pageRendered,focusSource,readingPosition,goToPosition } = useAnnotationSource({
  editable:() => author.value, kind:props.kind, target:() => props.target, annotations:markSources, active, panel:host, showing:() => open.value && section.value==='annotation',
  onMark:(id,part) => { const n=currentById.value.get(id); if (n?.type==='annotation') show(n,false,true,part) },
  onComment:a => createAnnotation(a,'comment'), notice
})
watch(author, value => {
  emit('author',value)
  if (!value) { section.value='annotation'; boxMode.value=false; undo.value=undefined; panel.value?.finish(); clearSelection() }
})
watch(boxMode,v => emit('boxMode',v))
watch(() => props.boxActive, v => { if (v !== undefined) boxMode.value=author.value && v }, { immediate:true })

let wideViewport: MediaQueryList | undefined
const preferenceKey = () => 'seagull-notebook-panel-v2:'+props.kind +
  (wideViewport ? (wideViewport.matches ? ':paper-wide' : ':paper-narrow') : '')
let initialized=false
function restorePanel() {
  const defaultOpen = wideViewport?.matches === true
  let saved: { section?: string; open?: boolean } = {}
  try {
    saved=JSON.parse(localStorage.getItem(preferenceKey()) || '{}') ?? {}
  } catch {}
  section.value=author.value && (saved.section==='paper' || (saved.section==='bookmark' && props.kind==='pdf')) ? saved.section : 'annotation'
  open.value=typeof saved.open==='boolean' ? saved.open : defaultOpen
}
onMounted(() => {
  if (props.docked) {
    wideViewport=matchMedia('(min-width:1100px)')
    wideViewport.addEventListener('change',restorePanel)
  }
  restorePanel()
  if (props.kind==='html') document.body.classList.toggle('annotation-html-open',open.value)
  initialized=true
})
watch([open,section],([shown,tab]) => {
  if (!initialized) return
  try { localStorage.setItem(preferenceKey(),JSON.stringify({open:shown,section:tab})) } catch {}
  if (props.kind==='html') document.body.classList.toggle('annotation-html-open',shown)
  if (!shown) panel.value?.finish()
  nextTick(layout)
})
onBeforeUnmount(() => {
  clearTimeout(messageTimer)
  wideViewport?.removeEventListener('change',restorePanel)
  if (props.kind==='html') document.body.classList.remove('annotation-html-open')
})

function meta() {
  const now=new Date().toISOString()
  return {id:crypto.randomUUID(), created:now, updated:now}
}
async function show(n:Annotation|PaperNote, edit:boolean, locate=false, part=0) {
  active.value=n.id; section.value=n.type; open.value=true
  await nextTick(); await panel.value?.reveal(n,edit)
  if (locate && n.type==='annotation') await focusSource(n,part)
}
function sameAnchor(a:Anchor,b:Anchor) {
  if (a.region || b.region) {
    const x=a.region, y=b.region
    return !!x && !!y && x.fingerprint===y.fingerprint && x.path.join('/')===y.path.join('/') &&
      Math.abs(x.x-y.x)<.0001 && Math.abs(x.y-y.y)<.0001 && Math.abs(x.w-y.w)<.0001 && Math.abs(x.h-y.h)<.0001
  }
  return a.quote===b.quote && a.start===b.start && a.boxes.length===b.boxes.length && a.boxes.every((x,i) => {
    const y=b.boxes[i]
    return x.page===y.page && x.content===y.content && Math.abs(x.x-y.x)<.0001 && Math.abs(x.y-y.y)<.0001 && Math.abs(x.w-y.w)<.0001 && Math.abs(x.h-y.h)<.0001
  })
}
function createAnnotation(anchor:Anchor, action:'highlight'|'comment'|'favorite') {
  const old=annotations.value.find(n => sameAnchor(n.anchor,anchor))
  const n:Annotation=old ? {...old} : {...meta(),type:'annotation',anchor,highlighted:false,comment:null,favorite:false}
  if (action==='comment') { n.comment??=''; if (!old) n.highlighted=true }
  if (action==='highlight') n.highlighted=true
  if (action==='favorite') n.favorite=true
  edit(n); clearSelection()
  if (action==='comment') show(n,true,true)
  else notice(action==='highlight'?'已高亮':'已收藏选文')
}
function addPaper() { const n:PaperNote={...meta(),type:'paper',body:''}; edit(n); show(n,true) }
function addBookmark(position=readingPosition()) {
  if (!position) { notice('页面正在载入，请稍后添加书签。'); return }
  const near=bookmarks.value.find(n => n.position.page===position.page && Math.abs(n.position.y-position.y)<.002 && Math.abs(n.position.x-position.x)<.01)
  if (!near) edit({...meta(),type:'bookmark',position})
  notice(near?'此处已有书签':'已添加页面书签')
}
function bookmarkSelection() {
  const b=selection.value?.boxes[0]
  if (b) addBookmark({page:b.page,x:b.x+b.w/2,y:b.y})
  clearSelection()
}
async function copySelection() {
  const anchor=selection.value
  if (!anchor) return
  try {
    if (!anchor.quote) {
      const b=anchor.boxes[0], page=props.target?.querySelector<HTMLElement>('.page[data-page-number="'+b.page+'"]')
      const canvas=page && cropPdfBox(page,b,4096,4096)
      if (!canvas || !navigator.clipboard?.write || typeof ClipboardItem==='undefined') throw Error()
      const png=new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error()),'image/png'))
      await navigator.clipboard.write([new ClipboardItem({'image/png':png})])
    }
    else if (navigator.clipboard) await navigator.clipboard.writeText(anchor.quote)
    else if (!document.execCommand('copy')) throw Error()
    clearSelection(); notice(anchor.quote?'已复制选文':'已复制图像')
  } catch { notice(anchor.quote?'未能复制，请使用浏览器的复制快捷键。':'浏览器未能复制图像。') }
}
function updateBody(n:Annotation|PaperNote,body:string) {
  edit(n.type==='paper'?{...n,body}:{...n,comment:body})
}
function remove(n:Entry) {
  edit({...n,deleted:true}); undo.value=() => { const current=currentById.value.get(n.id); if (current) edit({...current,deleted:false}) }
  if (active.value===n.id) { active.value=''; panel.value?.finish() }
}
function act(n:Annotation|PaperNote,name:CardAction,part=0) {
  if (name==='locate' || name==='edit') {
    if (n.type==='annotation' && name==='edit' && n.comment===null) edit({...n,comment:''})
    show(n,name==='edit',name==='locate',part); return
  }
  if (name==='remove') { remove(n); return }
  if (n.type!=='annotation') return
  const changed={...n}
  if (name==='publish') changed.published=!n.published
  if (name==='highlight') changed.highlighted=!n.highlighted
  if (name==='favorite') changed.favorite=!n.favorite
  if (name==='comment') { changed.comment=null; panel.value?.finish() }
  if (!changed.favorite && !changed.highlighted && changed.comment===null) { remove(n); return }
  edit(changed)
  if (name==='comment' || (name==='highlight' && n.highlighted)) undo.value=() => {
    const current=currentById.value.get(n.id)
    if (current?.type==='annotation') edit(name==='comment'?{...current,comment:current.comment || n.comment}:{...current,highlighted:true})
  }
}
function restore() { undo.value?.(); undo.value=undefined }
function backup(format:'json'|'md') {
  const content=format==='json'?jsonBackup(records.value,props.document,props.kind,props.title):markdownBackup([...papers.value,...annotations.value,...bookmarks.value],props.title)
  const url=URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json':'text/markdown;charset=utf-8'}))
  const a=document.createElement('a'); a.href=url; a.download=props.title.replace(/[\\/:*?"<>|]/g,'_')+'-笔记.'+format; a.click()
  setTimeout(() => URL.revokeObjectURL(url),1000)
}
async function importFile(file:File) {
  try {
    if (file.size>20*1024*1024) throw Error('文件超过 20 MB。')
    const entries=parseBackup(JSON.parse(await file.text()),props.document,props.kind)
    let count=0
    for (const n of entries) {
      const current=currentById.value.get(n.id)
      if (current && !newerEntry(n,current)) continue
      edit(n.type==='annotation'?{...n,published:false}:n)
      count++
    }
    notice(count?'已合并 '+count+' 条记录':'当前记录已是最新')
  } catch(e) { notice(e instanceof Error?e.message:'无法导入笔记备份。') }
}
function toggleBox() { if (author.value) boxMode.value=!boxMode.value }
function openMark(id:string,part:number) { const n=currentById.value.get(id); if (n?.type==='annotation') show(n,false,true,part) }
defineExpose({toggleBox,pageRendered})
</script>
<template>
  <div ref="host" class="annotation-notebook" :class="{'notebook-open':open,'notebook-html':kind==='html','notebook-docked':docked}">
    <NotebookDivider v-show="open" :kind="kind" :docked="docked" />
    <NotebookPanel v-show="open" ref="panel" v-model:section="section" :kind="kind" :annotations="annotations" :papers="papers" :bookmarks="bookmarks" :active="active" :author="author" :status="status" :conflict="!!conflicts.length" :local-count="localImports.length" :images="sourceImages" :missing="missing" :can-undo="!!undo"
      @close="open=false" @retry="retry" @login="login" @logout="logout" @resolve="resolveConflicts" @import-local="importLocal" @backup="backup" @import="importFile" @undo="restore" @add-paper="addPaper" @add-bookmark="addBookmark()" @bookmark="goToPosition($event.position)" @remove="remove" @body="updateBody" @action="act" @layout="layout" />
    <Teleport to="body">
      <div v-for="(r,i) in visualRects" :key="i" class="annotation-direct-selection" aria-hidden="true" :style="{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'}" />
      <SelectionToolbar v-if="author && selection && toolPoint" :point="toolPoint" :pdf="kind==='pdf'" :image-only="!selection.quote" @highlight="createAnnotation(selection,'highlight')" @comment="createAnnotation(selection,'comment')" @favorite="createAnnotation(selection,'favorite')" @copy="copySelection" @bookmark="bookmarkSelection" @dismiss="clearSelection" />
      <svg v-if="connector" class="annotation-connector" aria-hidden="true"><path :d="connector" /></svg>
      <div v-if="message || boxMode" class="notebook-toast" role="status">
        <template v-if="boxMode">{{kind==='pdf'?'在 PDF 页内拖动框选区域。':'在正文中拖动框选区域。'}}<button @click="toggleBox">取消框选</button></template>
        <template v-else>{{message}}</template>
      </div>
    </Teleport>
    <Teleport v-for="m in marks" :key="m.id+'-'+m.part" :to="m.parent">
      <span class="annotation-mark" :data-mark-id="m.id" :data-part="m.part" :class="{'is-filled':m.filled,'is-region':m.area,'is-current':open && section==='annotation' && active===m.id}" :style="m.style">
        <button v-if="m.part===0" class="annotation-number" :aria-label="'查看原文批注 '+m.number" @click.stop="openMark(m.id,m.part)">{{m.number}}</button>
      </span>
    </Teleport>
  </div>
</template>
