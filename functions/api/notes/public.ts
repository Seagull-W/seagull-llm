import { notes } from '../../../server/notes-api'
export const onRequest: PagesFunction<{NOTES_DB:D1Database}> = ({request,env}) => notes(request,env.NOTES_DB,false)
