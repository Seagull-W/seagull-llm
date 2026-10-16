import { readFileSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import matter from 'gray-matter'

// Read the same authoritative body used by VitePress, for tags and checks.
export function readContent(file) {
  const source = readFileSync(file, 'utf8')
  const { data, content } = matter(source)
  if (data.contentFormat !== 'html') return { data, content, source }
  const match = content.trim().match(/^<!--\s*@include:\s*(.+?\.html)\s*-->$/)
  if (!match) throw new Error(`${file}: expected exactly one HTML source include`)
  const target = resolve(dirname(file), match[1])
  if (relative(dirname(file), target).startsWith('..')) throw new Error(`${file}: HTML source must be adjacent`)
  return { data, content: readFileSync(target, 'utf8'), source, htmlFile: target }
}
