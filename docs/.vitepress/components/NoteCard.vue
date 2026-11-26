<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { anchorLabel, isVisualPart, type Annotation, type PaperNote } from './annotations'
import ReaderIcon from './ReaderIcon.vue'
import NoteEditor from './NoteEditor.vue'
import HighlightColorPicker from './HighlightColorPicker.vue'
export type CardMode = 'read' | 'edit'
export type CardAction = 'edit' | 'locate' | 'remove' | 'comment' | 'highlight' | 'favorite' | 'publish'
const props = defineProps<{ author:boolean; note: Annotation | PaperNote; number: number; active: boolean; mode: CardMode; images?: Map<string,string>; missing?: boolean; showTime?: boolean }>()
const emit = defineEmits<{ action: [name: CardAction,part?:number]; mode: [value: CardMode]; body: [value:string]; color:[value:string|undefined]; layout:[] }>()
const menu = ref<HTMLDetailsElement>()
const picking = ref(false), trigger = ref<HTMLButtonElement>(), picker = ref<InstanceType<typeof HighlightColorPicker>>()
const pickerId = useId()
async function toggleColor() {
  if (menu.value) menu.value.open = false
  picking.value = !picking.value
  await nextTick()
  if (picking.value) picker.value?.focusChoice()
  else trigger.value?.focus({ preventScroll:true })
  emit('layout')
}
function chooseColor(color: string | undefined) {
  emit('color',color)
  void toggleColor()
}
const excerptOpen = ref(true)
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
</script>
<template>
  <article class="note-card" :class="{active,'is-editing':mode==='edit'}" :data-note-id="note.id"
    :style="note.type==='annotation' && note.highlighted && note.highlightColor ? {'--nw-mark-color':note.highlightColor} : undefined">
    <div class="note-card-head">
      <button v-if="note.type==='annotation'" class="note-location" title="定位原文" @click="act('locate')">
        <span class="note-number">{{ number }}</span>
        {{ note.anchor.boxes.length ? '第 '+note.anchor.boxes[0].page+' 页' : '定位原文' }}
        <span v-if="anchorLabel(note.anchor)!=='选文'">· {{anchorLabel(note.anchor)}}</span><ReaderIcon v-if="note.favorite" name="star" />
      </button>
      <time v-else class="note-location" :datetime="note.created">{{ new Date(note.created).toLocaleDateString('zh-CN') }}</time>
      <time v-if="showTime" class="note-created" :datetime="note.created">{{new Date(note.created).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}}</time>
      <small v-if="author && note.type==='annotation'" class="note-visibility">{{note.published?'公开':'仅自己'}}</small>
      <div v-if="author" class="note-card-actions">
        <button v-if="note.type==='annotation'" ref="trigger" type="button" class="note-color-trigger" aria-label="修改高亮颜色" title="修改高亮颜色"
          :aria-expanded="picking" :aria-controls="pickerId" @click="toggleColor">
          <i aria-hidden="true" :style="{backgroundColor:note.highlightColor}"></i>
        </button>
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
      <HighlightColorPicker v-if="author && picking" :id="pickerId" ref="picker" :color="note.highlightColor" @color="chooseColor" @close="toggleColor" />
      <div v-if="note.anchor.quote || note.anchor.region?.label || previews.length" class="note-excerpt">
        <button class="note-excerpt-toggle" :aria-expanded="excerptOpen" @click="excerptOpen=!excerptOpen">
          {{ note.anchor.quote ? '原文摘录' : '原文区域' }}<ReaderIcon name="next" />
        </button>
        <div v-show="excerptOpen">
          <button v-if="note.anchor.quote" class="note-source" title="定位到这段原文" @click="act('locate')"><span>{{ note.anchor.quote }}</span></button>
          <button v-else-if="note.anchor.region?.label" class="note-source" title="定位到框选区域" @click="act('locate')"><span>{{ note.anchor.region.label }}</span></button>
          <button v-for="p in previews" :key="p.part" class="note-source-image" title="定位到原文区域" @click="act('locate',p.part)"><img :src="p.image" alt="所选原文区域" /></button>
        </div>
      </div>
      <span v-if="missing" class="note-hint">{{note.anchor.region ? '框选位置待确认' : '引用已保留，原文位置待确认'}}</span>
    </template>
    <NoteEditor v-if="note.type==='paper' || note.comment!==null || mode!=='read'" :kind="note.type" :mode="mode" :model-value="note.type==='paper'?note.body:note.comment||''" @mode="emit('mode',$event)" @update:model-value="emit('body',$event)" />
    <button v-if="author && mode==='read'" class="edit-note" @click="act('edit')"><ReaderIcon name="edit" />{{ note.type==='annotation' && !note.comment ? '写批注' : '继续编辑' }}</button>
  </article>
</template>
<style scoped>
.note-card-actions .note-color-trigger { min-width:28px; min-height:28px; }
.note-color-trigger i { width:13px; height:13px; border-radius:50%; border:1px solid var(--nw-muted); background:var(--nw-accent); }
</style>
<style>
@container notebook-sheet (min-width:0px) {
  .notebook-panel .note-card.is-editing { margin:0; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }
  .note-card.is-editing .note-card-head,
  .note-card.is-editing:not(:has(.note-hint)) .note-excerpt { display:none; }
}
</style>
