export type Kind = 'html' | 'pdf'
export type RegionRect = { x: number; y: number; w: number; h: number }
export type Box = RegionRect & { page: number; content?: 'image' | 'region' }
export type HtmlRegion = RegionRect & { path: number[]; fingerprint: string; label: string }
export type Anchor = { quote: string; boxes: Box[]; start?: number; prefix?: string; suffix?: string; region?: HtmlRegion }
type Identity = { id: string; created: string; updated: string; deleted?: boolean; revision?: string }
export type Note = Identity & Anchor & { document: string; kind: Kind; body: string }
export type Annotation = Identity & { type: 'annotation'; anchor: Anchor; comment: string | null; highlighted: boolean; highlightColor?: string; favorite: boolean; published?: boolean }
export type PaperNote = Identity & { type: 'paper'; body: string }
export type Position = { page: number; x: number; y: number }
export type Bookmark = Identity & { type: 'bookmark'; position: Position }
export type Entry = Annotation | PaperNote | Bookmark
export const storagePrefix = 'seagull-note-v1:'
export function isVisualPart(a: Anchor, box: Box) { return !!box.content || !a.quote }
export function anchorLabel(a: Anchor) {
  if (a.region) return '框选区域'
  if (a.boxes.some(b => b.content === 'image')) return a.quote ? '图文选区' : '图像'
  if (a.boxes.some(b => b.content === 'region')) return '局部选区'
  return a.quote ? '选文' : '框选区域'
}
const validText = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const fraction = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1
function invalid(): never { throw new Error('备份格式或文档标识不匹配，请选择这篇文章的笔记备份。') }

export function isHighlightColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}
export function normalizeEntryColor(entry: Entry): Entry {
  if (entry.type !== 'annotation' || entry.highlightColor === undefined) return entry
  if (!isHighlightColor(entry.highlightColor)) throw new Error('高亮颜色须为六位十六进制色值。')
  const highlightColor = entry.highlightColor.toLowerCase()
  return highlightColor === entry.highlightColor ? entry : { ...entry, highlightColor }
}

function rect(b: RegionRect): RegionRect {
  if (!b || !fraction(b.x) || !fraction(b.y) || !Number.isFinite(b.w) || !Number.isFinite(b.h) ||
      b.w <= 0 || b.h <= 0 || b.x + b.w > 1.001 || b.y + b.h > 1.001) throw new Error('批注区域数据无效。')
  return { x: b.x, y: b.y, w: b.w, h: b.h }
}

function identity(n: Identity): Identity {
  if (!n || typeof n.id !== 'string' || !/^[\w-]{1,100}$/.test(n.id) ||
      ![n.created, n.updated].every(s => typeof s === 'string' && Number.isFinite(Date.parse(s))) ||
      (n.revision !== undefined && (typeof n.revision !== 'string' || !/^[a-f\d-]{36}$/i.test(n.revision))) ||
      (n.deleted !== undefined && typeof n.deleted !== 'boolean')) invalid()
  return { id: n.id, created: n.created, updated: n.updated, deleted: n.deleted, revision: n.revision }
}
export function newerEntry(a: Entry, b: Entry) {
  const elapsed = Date.parse(a.updated) - Date.parse(b.updated)
  return elapsed ? elapsed > 0 : (a.revision ?? '') > (b.revision ?? '')
}
function anchor(n: Anchor, kind: string): Anchor {
  if (!n || !validText(n.quote, 50000) || !Array.isArray(n.boxes) || n.boxes.length > 1000) invalid()
  if (n.region !== undefined) {
    const r = n.region
    if (!r || kind !== 'html' || n.boxes.length || n.quote || !Array.isArray(r.path) || r.path.length > 128 ||
        r.path.some(i => !Number.isSafeInteger(i) || i < 0 || i > 10000) ||
        !r.fingerprint || !validText(r.fingerprint, 500) || !validText(r.label, 200) ||
        !Number.isSafeInteger(n.start) || n.start! < 0) invalid()
    return { quote: '', boxes: [], start:n.start, region: { ...rect(r), path:[...r.path], fingerprint:r.fingerprint, label:r.label } }
  }
  const boxes = n.boxes.map(b => {
    if (!b || !Number.isSafeInteger(b.page) || b.page < 1) invalid()
    if (b.content !== undefined && b.content !== 'image' && b.content !== 'region') invalid()
    const box: Box = { page: b.page, ...rect(b) }
    if (b.content) box.content = b.content
    return box
  })
  if (kind === 'html' && n.quote) {
    if (!Number.isSafeInteger(n.start) || n.start! < 0 || !validText(n.prefix, 50000) || !validText(n.suffix, 50000)) invalid()
    return { quote: n.quote, boxes, start: n.start, prefix: n.prefix, suffix: n.suffix }
  }
  return { quote: n.quote, boxes }
}
export function validateNotes(input: unknown, document: string, kind: string): Note[] {
  const data = input as { version?: number; document?: string; notes?: Note[] }
  if (data?.version !== 1 || (data.document !== undefined && data.document !== document) ||
      !Array.isArray(data.notes) || data.notes.length > 10000) invalid()
  return data.notes.map(n => {
    if (!n || n.document !== document || n.kind !== kind || !validText(n.body, 100000)) invalid()
    return { ...identity(n), ...anchor(n, kind), document, kind: n.kind, body: n.body }
  })
}
export function locateQuote(text: string, note: Anchor): number {
  if (!note.quote) return -1
  const matches: number[] = []
  let at = text.indexOf(note.quote)
  while (at >= 0) { matches.push(at); at = text.indexOf(note.quote, at + 1) }
  if (matches.length === 1) return matches[0]
  const contextual = matches.filter(i => (!note.prefix || text.slice(Math.max(0,i-note.prefix.length),i) === note.prefix) && (!note.suffix || text.slice(i+note.quote.length,i+note.quote.length+note.suffix.length) === note.suffix))
  return contextual.length === 1 ? contextual[0] : -1
}
export function fromLegacy(n: Note): Entry {
  const meta = identity(n)
  if (!n.quote && !n.boxes.length && !n.region) return { ...meta, type: 'paper', body: n.body }
  return { ...meta, type: 'annotation', anchor: anchor(n, n.kind), comment: n.body || null, highlighted: true, favorite: false }
}
export function validateEntry(n: Entry, kind: Kind): Entry {
  const meta = identity(n)
  switch (n.type) {
    case 'paper':
      if (!validText(n.body, 100000)) invalid()
      return { ...meta, type: 'paper', body: n.body }
    case 'bookmark': {
      const p = n.position
      if (kind !== 'pdf' || !p || !Number.isSafeInteger(p.page) || p.page < 1 || !fraction(p.x) || !fraction(p.y)) invalid()
      return { ...meta, type: 'bookmark', position: { page: p.page, x: p.x, y: p.y } }
    }
    case 'annotation': {
      const a = anchor(n.anchor, kind)
      if (!(kind === 'pdf' ? a.boxes.length : a.quote || a.region) ||
          (n.comment !== null && !validText(n.comment, 100000)) ||
          typeof n.highlighted !== 'boolean' || typeof n.favorite !== 'boolean') invalid()
      if (n.published !== undefined && typeof n.published !== 'boolean') invalid()
      return normalizeEntryColor({ ...meta, type: 'annotation', anchor: a, comment: n.comment, highlighted: n.highlighted, favorite: n.favorite,
        ...(n.highlightColor !== undefined ? { highlightColor: n.highlightColor } : {}),
        ...(n.published === true ? {published:true} : {}) })
    }
    default: return invalid()
  }
}
export function parseBackup(input: unknown, document: string, kind: Kind): Entry[] {
  const data = input as { version?: number; document?: string; kind?: Kind; entries?: Entry[] }
  if (data?.version === 1) return validateNotes(data, document, kind).map(fromLegacy)
  if (data?.version !== 2 || data.document !== document || data.kind !== kind ||
      !Array.isArray(data.entries) || data.entries.length > 10000) invalid()
  return data.entries.map(n => validateEntry(n, kind))
}
export function jsonBackup(entries: Entry[], document: string, kind: Kind, title: string) {
  return JSON.stringify({ version: 2, document, kind, title, entries: entries.map(normalizeEntryColor) }, null, 2)
}
export function markdownBackup(entries: Entry[], title: string) {
  const sections: string[] = ['# ' + title]
  for (const n of entries.filter(e => !e.deleted)) {
    if (n.type === 'paper') sections.push('## 整篇笔记\n\n' + n.body)
    else if (n.type === 'bookmark') sections.push('## 书签 · 第 ' + n.position.page + ' 页（页内 ' + Math.round(n.position.y * 100) + '%）')
    else {
      const page = n.anchor.boxes[0]?.page
      const heading = [page ? '第 ' + page + ' 页' : '原文', anchorLabel(n.anchor), n.favorite ? '已收藏' : ''].filter(Boolean).join(' · ')
      const source = n.anchor.quote || n.anchor.region?.label
      const quote = source?.split('\n').map(s => '> ' + s).join('\n')
      sections.push(['## ' + heading, quote, n.comment].filter(Boolean).join('\n\n'))
    }
  }
  return sections.join('\n\n') + '\n'
}
export function markdownNotes(notes: Note[], title: string) { return markdownBackup(notes.map(fromLegacy), title) }
