import { onBeforeUnmount, onMounted, shallowRef, ref } from 'vue'
import type { Entry, Kind } from './annotations'
import { validateEntry } from './annotations'
import { persistRecovery, recoveryDrafts } from './notebook-recovery'
import { NotebookStore, type SaveState } from './notebook-store'

// Failed writes survive client-side navigation and are retried when returning to a paper.
const outstanding = new Map<string, NotebookStore>()
function beforeClose(event: BeforeUnloadEvent) {
  let failed = false
  for (const book of Array.from(outstanding.values())) {
    if (!book.flush()) failed = true
  }
  if (failed) { event.preventDefault(); event.returnValue = '' }
}
function track(book: NotebookStore) {
  if (book.pending.size) outstanding.set(book.doc, book)
  else outstanding.delete(book.doc)
  if (outstanding.size) window.addEventListener('beforeunload', beforeClose)
  else window.removeEventListener('beforeunload', beforeClose)
}
export function useNotebook(doc: string, kind: Kind) {
  const book = outstanding.get(doc) ?? new NotebookStore(doc, kind, () => window.localStorage, () => window.sessionStorage)
  const records = shallowRef<Entry[]>([])
  const state = ref<SaveState>('idle')
  const incomplete = ref(false)
  const mirrored = new Map<string, Entry>()
  let writeFailed = false
  function protectDrafts() {
    if (book.state === 'failed' && book.pending.size) writeFailed = true
    if (!book.pending.size) writeFailed = false
    const toSave = writeFailed ? Array.from(book.pending.values()).filter(n => mirrored.get(n.id) !== n) : []
    if (toSave.length) {
      for (const n of toSave) mirrored.set(n.id,n)
      persistRecovery(doc,toSave).catch(() => {
        for (const n of toSave) if (mirrored.get(n.id) === n) mirrored.delete(n.id)
      })
    }
    const committed: Entry[] = []
    for (const [id] of mirrored) {
      const n = book.records.get(id)
      if (n && !book.pending.has(id)) { committed.push(n); mirrored.delete(id) }
    }
    if (committed.length) persistRecovery(doc,committed,true).catch(() => {})
  }
  let timer: ReturnType<typeof setTimeout>
  book.onChange = () => {
    records.value = Array.from(book.records.values())
    state.value = book.state
    incomplete.value = book.readError
    track(book)
    protectDrafts()
    clearTimeout(timer)
    if (book.state === 'saving') timer = setTimeout(flush, 350)
  }
  function flush() { if (book.pending.size) book.flush() }
  function onHidden() { if (document.visibilityState === 'hidden') flush() }
  function onStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage) return
    book.receive(event.key, event.newValue)
  }
  onMounted(() => {
    book.load()
    recoveryDrafts(doc).then(drafts => {
      const valid = drafts.map(n => validateEntry(n,kind))
      for (const n of valid) mirrored.set(n.id,n)
      if (valid.length) { book.stage(valid); book.flush(); protectDrafts() }
    }).catch(() => { /* The synchronous journal and primary storage work independently of IndexedDB. */ })
    window.addEventListener('storage', onStorage)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    flush()
    book.onChange = () => { track(book); protectDrafts() }
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('pagehide', flush)
    document.removeEventListener('visibilitychange', onHidden)
  })
  return { book, records, state, incomplete }
}
