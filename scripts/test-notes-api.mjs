import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { onRequest } from '../functions/api/notes/owner.ts'
import { notes } from '../server/notes-api.ts'
import 'fake-indexeddb/auto'
import { claim, enqueue, finish, forkConflict, pending } from '../docs/.vitepress/components/notes-outbox.ts'

const origin='https://notes.example', document='html:papers/test.md'
const address=origin+'/api/notes/owner?document='+encodeURIComponent(document)
const now=new Date().toISOString()
const entry={id:'first',type:'annotation',created:now,updated:now,revision:crypto.randomUUID(),
  anchor:{quote:'example',start:0,prefix:'',suffix:'',boxes:[]},comment:'private',highlighted:true,favorite:true}

// Exercise the migration and the same bound SQL that runs in D1.
function database() {
  const conn=new DatabaseSync(':memory:')
  conn.exec(readFileSync(new URL('../migrations/0001_notes.sql',import.meta.url),'utf8'))
  return {
    prepare(sql) {
      return {bind(...values) {return {all:()=>({results:conn.prepare(sql).all(...values)})}}}
    },
    batch(statements) {
      conn.exec('BEGIN')
      try {const result=statements.map(s=>s.all()); conn.exec('COMMIT'); return result}
      catch (e) {conn.exec('ROLLBACK'); throw e}
    }
  }
}
function put(data,base=null,from=origin) {
  return new Request(address,{method:'PUT',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify({base,entry:data})})
}
test('offline typing coalesces, sent revisions survive retries, conflict resolution keeps the latest private copy',async () => {
  const doc='html:outbox-test'
  const change=(comment,base) => ({doc,writer:'first-device',base,
    entry:{...entry,comment,published:true,revision:crypto.randomUUID()}})
  const first=change('first',null)
  const second=change('second',first.entry.revision)
  await enqueue(first)
  await enqueue(second)
  const [saved]=await pending(doc)
  assert.equal(saved.base,null)
  assert.equal(saved.entry.revision,second.entry.revision)
  assert.equal(await claim(saved),true)
  const third=change('latest offline text',saved.entry.revision)
  await enqueue(third)
  assert.equal((await pending(doc)).length,2)
  await finish(saved,true)
  assert.equal(await claim(saved),false)
  await forkConflict(saved)
  const copies=await pending(doc)
  assert.equal(copies.length,1)
  assert.equal(copies[0].entry.comment,'latest offline text')
  assert.notEqual(copies[0].entry.id,first.entry.id)
  assert.equal(copies[0].entry.published,false)
  assert.equal(copies[0].base,null)
  await finish(copies[0],false)
  assert.deepEqual(await pending(doc),[])
})
test('private import, publication, incremental sync, conflicting edits, retraction and deletion',async () => {
  const db=database()
  const read=async(owner,after=0)=>(await (await notes(new Request(address+'&after='+after),db,owner)).json()).rows
  assert.equal((await notes(put(entry),db,false)).status,405)
  assert.equal((await notes(put(entry,null,'https://other.example'),db,true)).status,403)
  assert.equal((await notes(put(entry),db,true)).status,200)
  assert.deepEqual(await read(false),[])
  const [first]=await read(true)
  const publicEntry={...entry,revision:crypto.randomUUID(),published:true,comment:'visible'}
  assert.equal((await notes(put(publicEntry,entry.revision),db,true)).status,200)
  assert.equal((await notes(put(publicEntry,entry.revision),db,true)).status,200)
  const [published]=await read(false)
  assert.equal(published.entry.favorite,false)
  assert.equal(published.entry.comment,'visible')
  assert.equal((await read(true,first.sequence)).length,1)
  const stale=await notes(put({...entry,revision:crypto.randomUUID()},entry.revision),db,true)
  assert.equal(stale.status,409)
  assert.equal((await stale.json()).current.revision,publicEntry.revision)
  const privateEntry={...publicEntry,published:false,revision:crypto.randomUUID()}
  assert.equal((await notes(put(privateEntry,publicEntry.revision),db,true)).status,200)
  assert.deepEqual(await read(false),[])
  const removed={...publicEntry,deleted:true,revision:crypto.randomUUID()}
  assert.equal((await notes(put(removed,privateEntry.revision),db,true)).status,200)
  assert.deepEqual(await read(false),[])
  assert.equal((await read(true,published.sequence))[0].entry.deleted,true)
  const paper={...entry,id:'paper',type:'paper',body:'private paper',published:true}
  assert.equal((await notes(put(paper),db,true)).status,200)
  assert.deepEqual(await read(false),[])
})

test('only a signed Access identity for the intended application and allowlisted mailbox reaches owner data',async t => {
  const env={NOTES_DB:database(),ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'notes',
    NOTES_OWNER_EMAILS:'preferred@example.org,backup@example.org'}
  const issuer='https://'+env.ACCESS_TEAM_DOMAIN
  const pair=await generateKeyPair('RS256')
  const jwk={...await exportJWK(pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'}
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(String(url),issuer+'/cdn-cgi/access/certs')
    return Response.json({keys:[jwk]})
  })
  const sign=(email,aud='notes',exp='5m')=>new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test-key'})
    .setSubject('subject').setIssuer(issuer).setAudience(aud).setExpirationTime(exp).sign(pair.privateKey)
  const owner=(token)=>onRequest({env,request:new Request(address,{headers:token?{'Cf-Access-Jwt-Assertion':token}:{}})})
  for (const token of [undefined,'invalid',await sign('other@example.org'),await sign('preferred@example.org','other'),
    await sign('preferred@example.org','notes',1)]) assert.equal((await owner(token)).status,403)
  for (const email of ['preferred@example.org','backup@example.org']) assert.equal((await owner(await sign(email))).status,200)
})
