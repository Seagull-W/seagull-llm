import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { validateEntry, type Entry, type Kind } from './annotations'
import { claim, enqueue, finish, forkConflict, pending, type Mutation } from './notes-outbox'

const loginHint='seagull-author-login'
function endpoint(doc:string,owner:boolean) {
  const url=new URL('/api/notes/'+(owner?'owner':'public'),location.origin)
  url.searchParams.set('document',doc)
  return url
}
class LoginRequired extends Error {}
async function api(url:URL, init?:RequestInit) {
  const response=await fetch(url,{cache:'no-store',credentials:'same-origin',redirect:'manual',...init})
  if (response.type==='opaqueredirect' || [401,403].includes(response.status)) throw new LoginRequired()
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('批注服务尚未就绪')
  if (!response.ok && response.status!==409) throw Error('批注服务暂时不可用')
  return response
}

export function useCloudNotebook(doc:string,kind:Kind) {
  const records=shallowRef<Entry[]>([]), author=ref(false), status=ref('正在读取批注…')
  const conflicts=shallowRef<Mutation[]>([])
  const remote=new Map<string,Entry>(), live=new Map<string,Entry>()
  const volatile=new Map<string,Mutation>()
  let cursor=0, generation=0, disposed=false, busy=false, again=false
  let timer:ReturnType<typeof setTimeout>, poll:ReturnType<typeof setInterval>
  let writes=Promise.resolve(), writer=''

  function login() {
    localStorage.setItem(loginHint,'1')
    const url=new URL('/api/notes/owner',location.origin)
    url.searchParams.set('login','1')
    url.searchParams.set('return',location.pathname+location.search+location.hash)
    location.assign(url.href)
  }
  function logout() {
    localStorage.removeItem(loginHint)
    reset()
    location.assign('/cdn-cgi/access/logout')
  }
  function reset() {
    author.value=false; cursor=0; remote.clear(); live.clear(); records.value=[]; conflicts.value=[]
  }
  function schedule(delay=500) {
    clearTimeout(timer)
    if (!disposed) timer=setTimeout(sync,delay)
  }
  function persist(change:Mutation) {
    volatile.set(change.entry.revision!,change)
    writes=writes.then(async () => {
      await enqueue(change)
      volatile.delete(change.entry.revision!)
    }).catch(() => {status.value='本机保存失败，请重试或导出备份'})
  }
  function edit(input:Entry) {
    if (!author.value) return
    const previous=live.get(input.id)
    const previousTime=previous ? Date.parse(previous.updated) : 0
    const entry={...input,revision:crypto.randomUUID(),updated:new Date(Math.max(Date.now(),previousTime+1)).toISOString()}
    generation++
    live.set(entry.id,entry); records.value=Array.from(live.values())
    persist({doc,writer,entry,base:previous?.revision || null})
    status.value='待同步'
    schedule()
  }
  async function pull(owner:boolean) {
    // Public results are full snapshots so retractions disappear as soon as a reader refreshes.
    const next=owner ? new Map(remote) : new Map<string,Entry>()
    let after=owner ? cursor : 0
    for (;;) {
      const url=endpoint(doc,owner)
      url.searchParams.set('after',String(after))
      const page=await (await api(url)).json()
      for (const row of page.rows) {
        const entry=validateEntry(row.entry,kind)
        next.set(entry.id,entry); after=row.sequence
      }
      if (!page.more) break
    }
    if (owner && localStorage.getItem(loginHint)!=='1') throw new LoginRequired()
    remote.clear()
    for (const [id,entry] of next) remote.set(id,entry)
    if (owner) cursor=after
  }
  async function render(owner:boolean) {
    const at=generation
    const edits=owner ? await pending(doc) : []
    if (at!==generation || disposed) { again=true; return }
    live.clear()
    for (const n of remote.values()) live.set(n.id,n)
    for (const m of [...edits,...volatile.values()]) if (owner) live.set(m.entry.id,m.entry)
    records.value=Array.from(live.values())
    conflicts.value=edits.filter(m=>m.conflict)
  }
  async function push() {
    // Other documents may still have edits when the reader navigates away or closes a tab.
    const queue=await pending()
    const waiting=new Set(queue.map(m=>m.entry.revision))
    for (const m of queue) {
      if (disposed || !author.value) return
      if (m.conflict || (m.base && waiting.has(m.base))) continue
      if (!await claim(m)) continue
      const response=await api(endpoint(m.doc,true),{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({entry:m.entry,base:m.base})})
      const conflict=response.status===409
      await finish(m,conflict)
      if (!conflict) waiting.delete(m.entry.revision)
    }
  }
  async function sync() {
    if (disposed) return
    if (busy) {again=true; return}
    busy=true
    try {
      let owner=localStorage.getItem(loginHint)==='1'
      if (!owner && author.value) reset()
      if (owner) {
        try {
          await pull(true)
          if (disposed) return
          author.value=true
          await writes
          await render(true)
          if (navigator.locks) await navigator.locks.request('seagull-author-sync',push)
          else await push()
          await pull(true)
        } catch (e) {
          if (!(e instanceof LoginRequired)) throw e
          localStorage.removeItem(loginHint); owner=false; reset()
        }
      }
      if (!owner) await pull(false)
      await render(owner)
      if (!owner) status.value='公开批注 · 只读'
      else if (volatile.size) status.value='正在写入本机，失败时可导出备份'
      else if (conflicts.value.length) status.value='其他设备也修改了这条笔记'
      else status.value=(await pending(doc)).length?'待同步':'已同步'
    } catch (e) {
      if (disposed) return
      if (volatile.size) status.value='本机保存失败，请导出备份'
      else if (author.value) status.value='同步暂不可用，编辑保存在本机'
      else status.value=e instanceof Error && e.message==='批注服务尚未就绪'?e.message:'公开批注暂时无法读取'
    } finally {
      busy=false
      if (again) {again=false; schedule(100)}
    }
  }
  function retry() {
    for (const m of volatile.values()) persist(m)
    schedule(0)
  }
  async function resolveConflicts() {
    await writes
    for (const m of conflicts.value) await forkConflict(m)
    await sync()
  }
  const resume=() => { if (document.visibilityState==='visible') schedule(0) }
  const handleStorage=(event:StorageEvent) => {
    if (event.key===loginHint) {
      if (!event.newValue) { reset(); generation++ }
      resume()
    }
  }
  onMounted(() => {
    writer=crypto.randomUUID()
    void sync()
    poll=setInterval(resume,45000)
    window.addEventListener('online',resume); window.addEventListener('focus',resume)
    window.addEventListener('storage',handleStorage)
    document.addEventListener('visibilitychange',resume)
  })
  onBeforeUnmount(() => {
    disposed=true; clearTimeout(timer); clearInterval(poll)
    window.removeEventListener('online',resume); window.removeEventListener('focus',resume)
    window.removeEventListener('storage',handleStorage)
    document.removeEventListener('visibilitychange',resume)
  })
  return {records,author,status,conflicts,login,logout,edit,retry,resolveConflicts}
}
