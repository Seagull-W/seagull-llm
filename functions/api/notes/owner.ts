import { isOwner } from '../../../server/notes-access.ts'
import { json, notes } from '../../../server/notes-api.ts'

type Bindings = { NOTES_DB:D1Database; ACCESS_TEAM_DOMAIN:string; ACCESS_AUD:string; NOTES_OWNER_EMAILS:string }
export const onRequest: PagesFunction<Bindings> = async ({request,env}) => {
  if (!await isOwner(request,env)) return json({error:'请使用站主邮箱登录'},403)
  const url=new URL(request.url)
  if (request.method==='GET' && url.searchParams.has('login')) {
    const target=new URL(url.searchParams.get('return') || '/',url.origin)
    const location=target.origin===url.origin && !target.pathname.startsWith('/api/') ? target.href : url.origin+'/'
    return new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store'}})
  }
  return notes(request,env.NOTES_DB,true)
}
