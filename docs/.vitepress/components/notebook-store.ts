import { fromLegacy, newerEntry, normalizeEntryColor, storagePrefix, validateEntry, validateNotes } from './annotations.ts'
import type { Entry, Kind } from './annotations.ts'

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'
type AccessStorage = () => Storage
const prefixFor = (version: string, doc: string) => version + encodeURIComponent(doc) + ':'

export class NotebookStore {
  readonly records = new Map<string, Entry>()
  readonly pending = new Map<string, Entry>()
  readonly prefix: string
  readonly draftPrefix: string
  readonly legacy: string
  readonly doc: string
  readonly kind: Kind
  private disk: AccessStorage
  private session: AccessStorage
  state: SaveState = 'idle'
  readError = false
  onChange = () => {}
  constructor(doc: string, kind: Kind, disk: AccessStorage, session: AccessStorage) {
    this.doc = doc
    this.kind = kind
    this.disk = disk
    this.session = session
    this.prefix = prefixFor('seagull-note-v2:', doc)
    this.draftPrefix = prefixFor('seagull-draft-v2:', doc)
    this.legacy = prefixFor(storagePrefix, doc)
  }
  private merge(n: Entry) {
    const current = this.records.get(n.id)
    if (current && !newerEntry(n, current)) return false
    this.records.set(n.id, n)
    return true
  }
  private readKeys(storage: Storage, drafts: boolean) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key) continue
      const legacy = !drafts && key.startsWith(this.legacy)
      const prefix = drafts ? this.draftPrefix : legacy ? this.legacy : this.prefix
      if (!key.startsWith(prefix)) continue
      try {
        const raw = JSON.parse(storage.getItem(key)!)
        const n = legacy ? fromLegacy(validateNotes({ version: 1, notes: [raw] }, this.doc, this.kind)[0]) : validateEntry(raw, this.kind)
        if (key !== prefix + n.id) throw Error()
        if (this.merge(n) && drafts) this.pending.set(n.id, n)
      } catch { this.readError = true }
    }
  }
  load() {
    this.readError = false
    try { this.readKeys(this.disk(), false) } catch { this.readError = true }
    try { this.readKeys(this.session(), true) } catch { /* Direct local writes also work without session storage. */ }
    if (this.pending.size) this.flush()
    else {
      this.state = this.readError ? 'failed' : this.records.size ? 'saved' : 'idle'
      this.onChange()
    }
  }
  receive(key: string | null, value: string | null) {
    if (!key?.startsWith(this.prefix) || !value) return
    try {
      const n = validateEntry(JSON.parse(value), this.kind)
      if (key !== this.prefix + n.id) return
      if (this.merge(n)) this.onChange()
      else {
        const current = this.records.get(n.id)!
        if (newerEntry(current,n) && !this.pending.has(n.id) && this.disk().getItem(key) === value) {
          this.pending.set(n.id,current)
          this.flush()
        }
      }
    } catch { this.readError = true; this.state = 'failed'; this.onChange() }
  }
  edit(n: Entry) {
    const previous = this.records.get(n.id)
    const time = Math.max(Date.now(), previous ? Date.parse(previous.updated) + 1 : 0)
    this.stage([{ ...n, updated: new Date(time).toISOString(), revision: crypto.randomUUID() }])
  }
  // Imports are validated as a whole by the caller before any records are staged.
  stage(entries: Entry[]) {
    let direct = false
    let changed = 0
    for (const n of entries.map(normalizeEntryColor)) {
      if (!this.merge(n)) continue
      this.pending.set(n.id, n)
      changed++
      try { this.session().setItem(this.draftPrefix + n.id, JSON.stringify(n)) }
      catch { direct = true }
    }
    if (changed) {
      this.state = 'saving'
      if (direct) this.flush()
      else this.onChange()
    }
    return changed
  }
  flush() {
    for (const [id, n] of this.pending) {
      try {
        const disk = this.disk()
        const key = this.prefix + id
        const raw = disk.getItem(key)
        const existing = raw ? validateEntry(JSON.parse(raw), this.kind) : undefined
        if (existing && newerEntry(existing, n)) this.merge(existing)
        else disk.setItem(key, JSON.stringify(n))
        this.pending.delete(id)
        try { this.session().removeItem(this.draftPrefix + id) } catch { /* The timestamp makes a stale recovery copy harmless. */ }
      } catch { /* Keep both the draft and this pending entry available to retry or export. */ }
    }
    this.state = this.pending.size || this.readError ? 'failed' : this.records.size ? 'saved' : 'idle'
    this.onChange()
    return !this.pending.size
  }
}
