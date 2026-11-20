import { validateEntry, type Entry, type Kind } from '../docs/.vitepress/components/annotations.ts'

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function notes(request: Request, db: D1Database, owner: boolean) {
  const url = new URL(request.url)
  if (request.method !== 'GET' && !(owner && request.method === 'PUT')) return json({error:'只读接口'},405)
  const doc = url.searchParams.get('document') || ''
  const kind = doc.split(':',1)[0] as Kind
  if (!['html','pdf'].includes(kind) || doc.length <= kind.length+1 || doc.length > 2048) return json({error:'文档标识无效'},400)
  if (!db) return json({error:'笔记数据库尚未配置'},503)

  if (request.method === 'GET') {
    const after = Number(url.searchParams.get('after') || 0)
    if (!Number.isSafeInteger(after) || after < 0) return json({error:'游标无效'},400)
    const condition = owner ? '' : 'AND published = 1'
    const {results} = await db.prepare(
      'SELECT sequence,payload FROM notebook_entries WHERE document=?1 AND sequence>?2 '+condition+' ORDER BY sequence LIMIT 8'
    ).bind(doc, after).all<{sequence:number; payload:string}>()
    const rows = results.map(row => {
      const entry = JSON.parse(row.payload) as Entry
      return {sequence:row.sequence, entry:owner ? entry : {...entry, favorite:false}}
    })
    return json({rows, more:rows.length === 8})
  }

  if (request.headers.get('Origin') !== url.origin) return json({error:'来源无效'},403)
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({error:'需要 JSON'},415)
  // Stop reading even for a chunked body without Content-Length.
  const reader = request.body?.getReader()
  if (!reader) return json({error:'缺少批注'},400)
  const decoder = new TextDecoder()
  let size=0, raw=''
  for (;;) {
    const {done,value} = await reader.read()
    if (done) break
    size+=value.byteLength
    if (size > 1500000) { await reader.cancel(); return json({error:'单条批注过大'},413) }
    raw+=decoder.decode(value,{stream:true})
  }
  let entry:Entry, base:string|null
  try {
    const data=JSON.parse(raw+decoder.decode())
    base=data.base
    if (base !== null && typeof base !== 'string') throw Error()
    entry=validateEntry(data.entry,kind)
    if (!entry.revision || base===entry.revision) throw Error()
  } catch { return json({error:'批注格式无效'},400) }
  const revision=entry.revision
  const published=Number(entry.type==='annotation' && entry.published===true && !entry.deleted)
  // Allocate the document cursor and compare the base revision in the same SQLite statement.
  const next='(SELECT COALESCE(MAX(sequence),0)+1 FROM notebook_entries WHERE document=?1)'
  const values=[doc, entry.id, revision, published, JSON.stringify(entry)]
  const write=base===null
    ? db.prepare('INSERT INTO notebook_entries(document,id,revision,published,payload,sequence) VALUES(?1,?2,?3,?4,?5,'+next+') ON CONFLICT(document,id) DO NOTHING').bind(...values)
    : db.prepare('UPDATE notebook_entries SET revision=?3,published=?4,payload=?5,sequence='+next+' WHERE document=?1 AND id=?2 AND revision=?6').bind(...values,base)
  const [,read]=await db.batch([write,db.prepare('SELECT payload FROM notebook_entries WHERE document=? AND id=?').bind(doc,entry.id)])
  const current=read.results[0] ? JSON.parse(String(read.results[0].payload)) as Entry : null
  return current?.revision===revision ? json({revision}) : json({current},409)
}
