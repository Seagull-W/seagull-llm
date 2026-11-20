import { newerEntry, type Entry } from './annotations'

type Draft = { document: string; entry: Entry }
let database: Promise<IDBDatabase> | undefined
function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve,reject) => {
      const request=indexedDB.open('seagull-notebook-recovery',1)
      request.onupgradeneeded=() => {
        const store=request.result.createObjectStore('drafts',{keyPath:['document','entry.id']})
        store.createIndex('document','document')
      }
      request.onsuccess=() => {
        const db=request.result
        db.onversionchange=() => { db.close(); database=undefined }
        resolve(db)
      }
      request.onerror=() => reject(request.error)
    }).catch(error => { database=undefined; throw error })
  }
  return database
}
export async function recoveryDrafts(doc:string): Promise<Entry[]> {
  const db=await openDatabase()
  return new Promise((resolve,reject) => {
    const request=db.transaction('drafts').objectStore('drafts').index('document').getAll(doc)
    request.onsuccess=() => resolve((request.result as Draft[]).map(d => d.entry))
    request.onerror=() => reject(request.error)
  })
}
// A recovery copy survives tab closure when localStorage has reached its quota.
// Read and compare inside the same transaction so a retry cannot erase a newer draft.
export async function persistRecovery(doc:string, entries:Entry[], remove=false) {
  if (!entries.length) return
  const db=await openDatabase()
  return new Promise<void>((resolve,reject) => {
    const tx=db.transaction('drafts','readwrite'), store=tx.objectStore('drafts')
    for (const entry of entries) {
      const key=[doc,entry.id], read=store.get(key)
      read.onsuccess=() => {
        const old=read.result as Draft | undefined
        if (old && newerEntry(old.entry,entry)) return
        if (remove) { if (old) store.delete(key) }
        else store.put({document:doc,entry})
      }
    }
    tx.oncomplete=() => resolve()
    tx.onabort=() => reject(tx.error)
  })
}
