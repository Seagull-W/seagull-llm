<script setup lang="ts">
import { computed, ref } from 'vue'
import { anchorLabel, isVisualPart, type Annotation, type PaperNote } from './annotations'
import ReaderIcon from './ReaderIcon.vue'
import NoteEditor from './NoteEditor.vue'
export type CardMode = 'read' | 'edit' | 'preview'
export type CardAction = 'edit' | 'locate' | 'remove' | 'comment' | 'highlight' | 'favorite' | 'publish'
const props = defineProps<{ author:boolean; note: Annotation | PaperNote; number: number; active: boolean; mode: CardMode; images?: Map<string,string>; missing?: boolean; showTime?: boolean }>()
const emit = defineEmits<{ action: [name: CardAction,part?:number]; mode: [value: CardMode]; body: [value:string] }>()
const menu = ref<HTMLDetailsElement>()
const previews = computed(() => {
  const n = props.note
  if (n.type !== 'annotation') return []
  if (n.anchor.region) {
    const image = props.images?.get(n.id+':0')
    return image ? [{part:0,image}] : []
  }
  return n.anchor.boxes.flatMap((b,part) => {
    if (!isVisualPart(n.anchor,b)) return []
    const image=props.images?.get(n.id+':'+part)
    return image ? [{part,image}] : []
  })
})
function act(name: CardAction,part?:number) {
  if (menu.value) menu.value.open=false
  emit('action',name,part)
}
function cardClick(event: MouseEvent) {
  if (props.note.type==='annotation' && props.mode==='read' && !(event.target as Element).closest('button,a,summary,details,input,textarea') && !window.getSelection()?.toString()) act('locate')
}
</script>
<template>
  <article class="note-card" :class="{active}" :data-note-id="note.id" @click="cardClick">
    <div class="note-card-head">
      <button v-if="note.type==='annotation'" class="note-location" title="定位原文" @click="act('locate')">
        <span class="note-number">{{ number }}</span>
        {{ note.anchor.boxes.length ? '第 '+note.anchor.boxes[0].page+' 页' : '原文' }}
        <span v-if="anchorLabel(note.anchor)!=='选文'">· {{anchorLabel(note.anchor)}}</span><ReaderIcon v-if="note.favorite" name="star" />
      </button>
      <time v-else class="note-location" :datetime="note.created">{{ new Date(note.created).toLocaleDateString('zh-CN') }}</time>
      <time v-if="showTime" class="note-created" :datetime="note.created">{{new Date(note.created).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}}</time>
      <small v-if="author && note.type==='annotation'">{{note.published?'公开':'仅自己'}}</small>
      <div v-if="author" class="note-card-actions">
        <button v-if="mode==='read'" class="edit-note" title="编辑笔记" aria-label="编辑笔记" @click="act('edit')"><ReaderIcon name="edit" /></button>
        <details ref="menu" class="notebook-menu"><summary aria-label="笔记操作" title="笔记操作"><ReaderIcon name="more" /></summary>
          <div class="menu-items">
            <template v-if="note.type==='annotation'">
              <button @click="act('publish')">{{note.published?'设为私有':'公开这条批注'}}</button>
              <button @click="act('highlight')">{{note.highlighted?'移除高亮':'添加高亮'}}</button>
              <button @click="act('favorite')">{{note.favorite?'取消收藏':'收藏选文'}}</button>
              <button v-if="note.comment!==null" @click="act('comment')">删除批注正文</button>
            </template>
            <button @click="act('remove')">{{note.type==='paper'?'删除整篇笔记':'删除整条记录'}}</button>
          </div>
        </details>
      </div>
    </div>
    <template v-if="note.type==='annotation'">
      <button v-if="note.anchor.quote" class="note-source" title="定位到这段原文" @click="act('locate')">{{note.anchor.quote}}</button>
      <button v-else-if="note.anchor.region?.label" class="note-source" title="定位到框选区域" @click="act('locate')">{{note.anchor.region.label}}</button>
      <button v-for="p in previews" :key="p.part" class="note-source-image" title="定位到原文区域" @click="act('locate',p.part)"><img :src="p.image" alt="所选原文区域" /></button>
      <span v-if="missing" class="note-hint">{{note.anchor.region ? '框选位置待确认' : '引用已保留，原文位置待确认'}}</span>
    </template>
    <NoteEditor v-if="note.type==='paper' || note.comment!==null || mode!=='read'" :mode="mode" :model-value="note.type==='paper'?note.body:note.comment||''" @mode="emit('mode',$event)" @update:model-value="emit('body',$event)" />
  </article>
</template>
