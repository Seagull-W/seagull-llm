import { catalogLoader } from './catalog-source'
import type { SearchDocument } from '../content-catalog'
declare const data: SearchDocument[]
export { data }
export default catalogLoader(true)
