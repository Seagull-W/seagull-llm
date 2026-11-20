import test from 'node:test'
import assert from 'node:assert/strict'
import { validateNotes, locateQuote, markdownNotes } from '../docs/.vitepress/components/annotations.ts'
const note = { id:'test-1',document:'pdf:abc',kind:'pdf',quote:'原文',body:'笔记',boxes:[{page:1,x:.1,y:.2,w:.3,h:.1}],created:'2026-11-18T00:00:00Z',updated:'2026-11-18T00:00:00Z' }
test('backup validates identity, geometry and format before importing',()=>{
 assert.equal(validateNotes({version:1,notes:[note]},'pdf:abc','pdf').length,1)
 for(const bad of [{...note,document:'pdf:other'}, {...note,boxes:[{page:1,x:.9,y:0,w:.5,h:1}]}, {...note,updated:'invalid'}, {...note,body:3}]) assert.throws(()=>validateNotes({version:1,notes:[bad]},'pdf:abc','pdf'))
 assert.throws(()=>validateNotes({version:2,notes:[note]},'pdf:abc','pdf'))
})
test('HTML anchors recover after edits but refuse ambiguous passages',()=>{
 const n={...note,quote:'目标',prefix:'前文',suffix:'后文'}
 assert.equal(locateQuote('新增前文目标后文',n),4)
 assert.equal(locateQuote('目标以及目标',{...n,prefix:'',suffix:''}),-1)
 assert.equal(locateQuote('文本已经删除',n),-1)
})
test('markdown preserves multiline quotes and excludes tombstones',()=>{
 const out=markdownNotes([{...note,quote:'甲\n乙'}, {...note,id:'deleted',body:'已删除内容',deleted:true}],'标题')
 assert.match(out,/> 甲\n> 乙/);assert.match(out,/第 1 页/);assert.ok(!out.includes('已删除内容'))
})
import { renderNoteMarkdown } from '../docs/.vitepress/components/note-markdown.ts'
test('notes render Markdown and inline/display LaTeX while leaving code literal',()=>{
 const source = '# 标题\n\n**重点**，$x^2$\n\n$$\n\\frac{a}{b}\n$$\n\n- 列表\n\n|甲|乙|\n|-|-|\n|1|2|\n\n```tex\n$x$\n```'
 const out=renderNoteMarkdown(source)
 assert.match(out,/<h1>标题<\/h1>/);assert.match(out,/<strong>重点<\/strong>/)
 assert.match(out,/class="katex"/);assert.match(out,/katex-display/);assert.match(out,/<table>/)
 assert.match(out,/<code class="language-tex">\$x\$/)
 assert.match(renderNoteMarkdown(String.raw`行内 \(a+b\)`),/class="katex"/)
 assert.match(renderNoteMarkdown(String.raw`\[a+b\]`),/katex-display/)
})
test('imported Markdown cannot create scripts or trusted TeX commands',()=>{
 const out=renderNoteMarkdown('<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n$\\href{javascript:alert(1)}{x}$')
 assert.ok(!out.includes('<img'));assert.ok(!out.includes('href="javascript:'))
 assert.match(out,/&lt;img/)
 assert.match(renderNoteMarkdown('$\\notACommand{x}$'),/note-math-error/)
 assert.match(renderNoteMarkdown('![说明](https://example.org/a.png)'),/>图片：说明<\/a>/)
})

import { anchorLabel, fromLegacy, isVisualPart, jsonBackup, markdownBackup, parseBackup } from '../docs/.vitepress/components/annotations.ts'
import { NotebookStore } from '../docs/.vitepress/components/notebook-store.ts'

function memoryStorage() {
  const data = new Map()
  return {
    failWrites:false,
    get length() { return data.size },
    getItem(key) { return data.get(key) ?? null },
    key(i) { return [...data.keys()][i] ?? null },
    removeItem(key) { data.delete(key) },
    setItem(key,value) { if (this.failWrites) throw Error('storage unavailable'); data.set(key,value) }
  }
}
const paper = fromLegacy({...note,id:'paper',quote:'',boxes:[]})
const highlight = fromLegacy({...note,body:''})
const bookmark = {id:'bookmark',type:'bookmark',created:note.created,updated:note.updated,position:{page:2,x:.45,y:.74}}
test('HTML region backups preserve local coordinates and an element anchor',()=>{
  const document='html:papers/deepseek-r1/index.md'
  const region={path:[3,1],fingerprint:'img|图1',label:'架构图',x:.15,y:.2,w:.3,h:.4}
  const entry={...highlight,anchor:{quote:'',boxes:[],start:60,region}}
  const [restored]=parseBackup(JSON.parse(jsonBackup([entry],document,'html','论文')),document,'html')
  assert.deepEqual(restored.anchor,entry.anchor)
  assert.match(markdownBackup([restored],'论文'),/框选区域[\s\S]*架构图/)
  for (const invalid of [{...region,path:[-1]}, {...region,fingerprint:''}, {...region,x:.9}]) {
    const bad={...entry,anchor:{...entry.anchor,region:invalid}}
    assert.throws(()=>parseBackup(JSON.parse(jsonBackup([bad],document,'html','论文')),document,'html'))
  }
  assert.throws(()=>parseBackup(JSON.parse(jsonBackup([entry],note.document,'pdf','论文')),note.document,'pdf'))
})
test('direct image, canvas and mixed selections retain their visual parts through a backup',()=>{
  const text=note.boxes[0], image={...text,page:2,content:'image'}, region={...text,content:'region'}
  for (const [quote,boxes,label] of [
    ['', [image], '图像'], ['', [region], '局部选区'], ['图注', [text,image], '图文选区'], ['', [text], '框选区域']
  ]) {
    const a={...highlight,anchor:{quote,boxes}}
    const [restored]=parseBackup(JSON.parse(jsonBackup([a],note.document,'pdf','论文')),note.document,'pdf')
    assert.deepEqual(restored.anchor,a.anchor)
    assert.equal(anchorLabel(restored.anchor),label)
    assert.equal(restored.anchor.boxes.filter(b=>isVisualPart(restored.anchor,b)).length,1)
    assert.ok(markdownBackup([restored],'论文').includes(label))
  }
  const bad={...highlight,anchor:{quote:'',boxes:[{...image,content:'unsupported'}]}}
  assert.throws(()=>parseBackup({version:2,document:note.document,kind:'pdf',entries:[bad]},note.document,'pdf'))
})
test('both backup versions preserve distinct paper notes, annotations, bookmarks and document identity',()=>{
  const legacy = parseBackup({version:1,document:note.document,notes:[note,{...note,id:'paper',quote:'',boxes:[]}]},note.document,'pdf')
  assert.equal(legacy[0].type,'annotation'); assert.equal(legacy[0].comment,'笔记'); assert.equal(legacy[1].type,'paper')
  assert.equal(highlight.comment,null); assert.equal(highlight.highlighted,true)
  const entries = [paper,{...highlight,highlighted:false,comment:'只有批注',favorite:true},bookmark]
  const parsed = parseBackup(JSON.parse(jsonBackup(entries,note.document,'pdf','论文')),note.document,'pdf')
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)),JSON.parse(JSON.stringify(entries)))
  const md = markdownBackup(parsed,'论文')
  for (const text of ['整篇笔记','> 原文','只有批注','已收藏','页内 74%']) assert.ok(md.includes(text))
  for (const invalid of [
    {version:1,document:'pdf:other',notes:[]},
    {version:2,document:'pdf:other',kind:'pdf',entries:[]},
    {version:2,document:note.document,kind:'pdf',entries:[paper,{...bookmark,position:{page:0,x:0,y:0}}]},
    {version:2,document:note.document,kind:'pdf',entries:[{...highlight,anchor:{quote:'x',boxes:[]}}]}
  ]) assert.throws(()=>parseBackup(invalid,note.document,'pdf'))
})
test('edits are journaled before the delayed write and recover on reload, including after failure and retry',()=>{
  const disk=memoryStorage(), session=memoryStorage()
  const open=()=>new NotebookStore(note.document,'pdf',()=>disk,()=>session)
  const a=open(); a.edit(paper)
  assert.equal(a.state,'saving'); assert.equal(session.length,1); assert.equal(disk.length,0)
  const b=open(); b.load()
  assert.equal(b.state,'saved'); assert.equal(b.records.get('paper').body,'笔记'); assert.equal(session.length,0)
  disk.failWrites=true; b.edit({...paper,body:'待恢复'}); assert.equal(b.flush(),false); assert.equal(b.state,'failed')
  const c=open(); c.load(); assert.equal(c.records.get('paper').body,'待恢复'); assert.equal(c.pending.size,1)
  disk.failWrites=false; c.load(); assert.equal(c.state,'saved'); assert.equal(c.pending.size,0); assert.equal(session.length,0)
  const d=open(); d.load(); assert.equal(d.records.get('paper').body,'待恢复')
})
test('old storage survives migration and stale backups, storage events and imports keep newer records and deletions',()=>{
  const disk=memoryStorage(), session=memoryStorage()
  const a=new NotebookStore(note.document,'pdf',()=>disk,()=>session)
  disk.setItem(a.legacy+note.id,JSON.stringify(note)); a.load()
  const n=a.records.get(note.id); assert.equal(n.comment,'笔记')
  a.edit({...n,highlighted:false}); a.flush()
  a.edit({...a.records.get(n.id),deleted:true}); a.flush()
  assert.equal(a.stage([n]),0); assert.equal(a.records.get(n.id).deleted,true)
  const b=new NotebookStore(note.document,'pdf',()=>disk,()=>session); b.load()
  assert.equal(b.records.size,1); assert.equal(b.records.get(n.id).deleted,true); assert.ok(disk.getItem(a.legacy+n.id))
  b.edit(paper); b.receive(b.prefix+n.id,JSON.stringify(n)); assert.equal(b.pending.size,1); assert.ok(b.records.get(n.id).deleted)
  assert.equal(b.stage([bookmark]),1); b.flush(); assert.equal(b.records.get('bookmark').position.y,.74)
})
test('session storage failure falls back to an immediate durable write and one bad key does not hide other notes',()=>{
  const disk=memoryStorage(), session=memoryStorage(); session.failWrites=true
  const a=new NotebookStore(note.document,'pdf',()=>disk,()=>session)
  a.edit(paper); assert.equal(a.state,'saved'); assert.equal(disk.length,1)
  disk.setItem(a.prefix+'broken','{'); a.load()
  assert.equal(a.readError,true); assert.equal(a.records.get('paper').body,'笔记'); assert.equal(disk.getItem(a.prefix+'broken'),'{')
})


test('two tabs converge even when changes to the same record have identical timestamps',()=>{
  const disk=memoryStorage()
  const open=()=>{const session=memoryStorage();return new NotebookStore(note.document,'pdf',()=>disk,()=>session)}
  const a=open(), b=open()
  const first={...paper,body:'甲',revision:'10000000-0000-4000-8000-000000000000'}
  const second={...paper,body:'乙',revision:'20000000-0000-4000-8000-000000000000'}
  a.stage([first]); b.stage([second]); b.flush(); a.flush()
  assert.equal(a.records.get('paper').body,'乙')
  const key=a.prefix+paper.id
  disk.setItem(key,JSON.stringify(first)); b.receive(key,disk.getItem(key))
  assert.equal(JSON.parse(disk.getItem(key)).body,'乙')
  const reopened=open();reopened.load();assert.equal(reopened.records.get('paper').body,'乙')
})
