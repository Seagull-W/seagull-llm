import type { Entry } from './annotations'

export type Mutation = { doc:string; base:string|null; entry:Entry; writer:string; sent?:boolean; conflict?:boolean }
let database:Promise<IDBDatabase> | undefined
function open() {
  if (!database) database=new Promise<IDBDatabase>((resolve,reject) => {
    const request=indexedDB.open('seagull-author-outbox',1)
    request.onupgradeneeded=() => {
      request.result.createObjectStore('edits',{keyPath:['doc','entry.revision']}).createIndex('doc','doc')
    }
    request.onsuccess=() => {
      const db=request.result
      db.onversionchange=() => { db.close(); database=undefined }
      resolve(db)
    }
    request.onerror=() => reject(request.error)
  }).catch(e => { database=undefined; throw e })
  return database
}
async function transaction<T>(mode:IDBTransactionMode, work:(store:IDBObjectStore, result:(value:T)=>void)=>void) {
  const db=await open()
  return new Promise<T>((resolve,reject) => {
    const tx=db.transaction('edits',mode)
    let value:T
    tx.oncomplete=() => resolve(value)
    tx.onabort=() => reject(tx.error || Error('笔记队列写入失败'))
    work(tx.objectStore('edits'),v => {value=v})
  })
}
export function pending(doc?:string) {
  return transaction<Mutation[]>('readonly',(store,result) => {
    const read=doc ? store.index('doc').getAll(doc) : store.getAll()
    read.onsuccess=() => result((read.result as Mutation[]).sort((a,b)=>a.entry.updated.localeCompare(b.entry.updated)))
  })
}
export function enqueue(change:Mutation) {
  return transaction<void>('readwrite',store => {
    if (!change.base) { store.put(change); return }
    const read=store.get([change.doc,change.base])
    read.onsuccess=() => {
      const old=read.result as Mutation|undefined
      // Collapse local keystrokes only while the previous revision has never been transmitted.
      if (old && !old.sent && old.writer===change.writer) {
        store.delete([change.doc,change.base!])
        store.put({...change,base:old.base})
      } else store.put(change)
    }
  })
}
export function claim(change:Mutation) {
  return transaction<boolean>('readwrite',(store,result) => {
    const key=[change.doc,change.entry.revision!], read=store.get(key)
    read.onsuccess=() => {
      if (!read.result || read.result.conflict) { result(false); return }
      store.put({...read.result,sent:true})
      result(true)
    }
  })
}
export function finish(change:Mutation, conflict:boolean) {
  return transaction<void>('readwrite',store => {
    const key=[change.doc,change.entry.revision!]
    if (!conflict) { store.delete(key); return }
    const read=store.get(key)
    read.onsuccess=() => { if (read.result) store.put({...read.result,conflict:true}) }
  })
}
// Resolve one conflicting branch. Its newest text survives as a fresh private record.
export function forkConflict(change:Mutation) {
  return transaction<void>('readwrite',store => {
    const read=store.index('doc').getAll(change.doc)
    read.onsuccess=() => {
      const all=read.result as Mutation[]
      if (!all.some(m => m.entry.revision===change.entry.revision && m.conflict)) return
      const children=new Map<string,Mutation[]>()
      for (const m of all) if (m.base) children.set(m.base,[...(children.get(m.base)||[]),m])
      const branch=[change]
      for (let i=0;i<branch.length;i++) {
        const m=branch[i], next=children.get(m.entry.revision!) || []
        store.delete([m.doc,m.entry.revision!])
        branch.push(...next)
        if (next.length || m.entry.deleted) continue
        const entry={...m.entry,id:crypto.randomUUID(),revision:crypto.randomUUID(),published:false}
        store.put({...m,entry,base:null,sent:false,conflict:false})
      }
    }
  })
}
