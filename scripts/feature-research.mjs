import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

const catalogPath = new URL('../docs/research/catalog.json', import.meta.url)
const stagedPath = new URL('catalog.feature.tmp', catalogPath)
const usage = '用法：node scripts/feature-research.mjs <slug> [--note "推荐语" | --off]'

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { note: { type: 'string' }, off: { type: 'boolean' } },
  })
  const [slug] = positionals
  if (positionals.length !== 1 || !slug || (values.off && values.note !== undefined)) throw new Error(usage)
  const note = values.note?.trim()
  if (note === '') throw new Error('--note 需要非空的推荐语。')

  // Reserve the staging file before reading so concurrent edits cannot overwrite each other.
  await writeFile(stagedPath, '', { flag: 'wx' })
  try {
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
    const matches = catalog.filter(entry => entry.slug === slug)
    if (!matches.length) throw new Error(`未找到调研 slug「${slug}」。`)
    if (matches.length > 1) throw new Error(`slug「${slug}」对应多期调研，请在 catalog.json 中按 route 选定篇目。`)
    const [entry] = matches
    if (values.off) {
      delete entry.featured
      delete entry.featuredNote
    } else {
      entry.featured = true
      if (note !== undefined) entry.featuredNote = note
    }
    await writeFile(stagedPath, JSON.stringify(catalog, null, 2) + '\n')
    await rename(stagedPath, catalogPath)
  } catch (error) {
    await unlink(stagedPath)
    throw error
  }
  console.log(`${slug}：${values.off ? '已取消精选' : '已设为精选'}`)
}

try {
  await main()
} catch (error) {
  console.error(error.code === 'EEXIST' ? '目录暂存文件 catalog.feature.tmp 已存在，请确认其他编辑已结束后重试。' : error.message)
  process.exitCode = 1
}
