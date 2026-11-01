import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createContentLoader } from 'vitepress'
import { isPublicContent } from '../public-content'
import { kindFor, newestFirst, sectionFor, topicTags, type ContentEntry, type SearchDocument } from '../content-catalog'
import { scienceVideos } from './videos'

// VitePress 1.x heading slug rules; kept in sync by the search anchor check.
const slugify = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f\u0000-\u001f]/g, '').replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, '_$1').toLowerCase()

// Checkout times are not content update dates. Read history once per loader.
function updateDates() {
  const dates = new Map<string, string>()
  let date = ''
  try {
    for (const line of execFileSync('git', ['-c', 'core.quotepath=false', 'log', '--format=@%cs', '--name-only', '--', 'docs'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split(/\r?\n/)) {
      if (line.startsWith('@')) date = line.slice(1)
      else if (line && !dates.has(line)) dates.set(line, date)
    }
  } catch { /* Source archives use explicit publication dates. */ }
  return dates
}
export function plainText(source: string) {
  return source.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\b[^>]*class="header-anchor"[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/<!--[^]*?-->/g, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/&(?:ZeroWidthSpace|nbsp);/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[#*`|]/g, '').replace(/\s+/g, ' ').trim()
}
export function searchSections(source: string, html: boolean) {
  source = source.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, '')
  const pattern = html ? /<h([2-6])\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g : /^(#{2,6})\s+(.+)$/gm
  const headings = [...source.matchAll(pattern)]
  const slugs = new Map<string, number>()
  return [{ title: '', anchor: '', text: plainText(source.slice(0, headings[0]?.index)) }, ...headings.map((match, i) => {
    const explicit = html ? undefined : match[2].match(/\s*\{#([^}]+)\}\s*$/)
    const title = plainText(html ? match[3] : match[2].replace(/\s*\{#[^}]+\}\s*$/, ''))
    let anchor = html ? match[2] : explicit?.[1] || slugify(title)
    if (!html) { const n = slugs.get(anchor) || 0; slugs.set(anchor, n + 1); if (n) anchor += '-' + n }
    return { title, anchor, text: plainText(source.slice(match.index! + match[0].length, headings[i + 1]?.index)) }
  })].filter(part => part.title || part.text)
}
export function catalogLoader(fullText = false) {
  const dates = updateDates()
  return createContentLoader(['**/*.md', '**/*.html'], {
    includeSrc: true,
    transform(pages): ContentEntry[] | SearchDocument[] {
      const catalog: ContentEntry[] = [], documents: SearchDocument[] = []
      for (const page of pages) {
        if (!isPublicContent(page.url, page.frontmatter) || page.url.replace(/\/$/, '') === '/videos') continue
        const relative = decodeURIComponent(page.url).slice(1).replace(/\.html$/, '') + (page.url.endsWith('/') ? 'index.md' : '.md')
        const file = resolve('docs', relative)
        let source = page.src || ''
        const include = source.match(/<!--\s*@include:\s*(.+?\.html)\s*-->/)
        const htmlFile = include ? resolve(dirname(file), include[1]) : ''
        if (htmlFile && existsSync(htmlFile)) source = readFileSync(htmlFile, 'utf8')
        const fm = page.frontmatter
        // Research is chronological: editing an older report must not promote it.
        const researchDate = sectionFor(page.url)?.id === 'research'
          ? (fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date || '').slice(0, 10)) || page.url.match(/^\/research\/(\d{4}-\d{2}-\d{2})-/)?.[1]
          : ''
        const date = researchDate || [dates.get('docs/' + relative), dates.get('docs/' + relative.replace(/\.md$/, '.html')), String(fm.updated || fm.date || '').slice(0, 10)].filter(Boolean).sort().at(-1) || ''
        catalog.push({ title: String(fm.title), url: page.url, description: String(fm.description || ''), tags: topicTags(fm.tags || []), section: sectionFor(page.url)?.id || '', kind: kindFor(page.url), updated: date })
        if (fullText) documents.push({ url: page.url, sections: searchSections(source, Boolean(htmlFile)) })
      }
      for (const video of scienceVideos) catalog.push({ title: video.title, url: '/videos/#' + video.bvid, description: video.description, tags: video.bvid === 'BV1VTaZ6iE6Q' ? ['强化学习', 'RLHF', 'GAE'] : ['梯度下降'], section: 'videos', kind: '视频', updated: video.publishedAt })
      return fullText ? documents : catalog.sort(newestFirst)
    }
  })
}
