import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import { readContent } from './content-source.mjs'
import nativeHtml, { inspectHtml } from '../docs/.vitepress/markdown/native-html.mjs'

const { pages } = JSON.parse(readFileSync('scripts/data/westlake-lecture-import.json', 'utf8'))
const md = await createMarkdownRenderer(resolve('docs'), {
  math: true,
  config(md) { md.use(nativeHtml, '/subpath/') }
})

for (const page of pages) {
  test(`${page.chapter}: lecture content, equation references and static math survive conversion`, () => {
    const file = page.html.replace(/\.html$/, '.md')
    const { content, source, data } = readContent(file)
    assert.equal(data.pdf, undefined)
    assert.deepEqual(data.outline, [2, 3])
    const htmlBody = content.replace(/^<(script|style)\b[^>]*>[\s\S]*?<\/\1>\s*$/gm, '')
    const info = inspectHtml(htmlBody)
    assert.ok(info.title)
    assert.ok(info.headers.length >= 2)
    assert.equal((htmlBody.match(/<h1\b/g) ?? []).length, 1)
    const ids = [...htmlBody.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
    assert.equal(ids.length, new Set(ids).size)
    for (const match of htmlBody.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(match[1]), `${page.chapter}: ${match[1]}`)
    }
    for (const [box, count] of Object.entries(page.boxes)) {
      assert.equal((htmlBody.match(new RegExp(`class="${box} lecture-box"`, 'g')) ?? []).length, count)
    }
    assert.equal((htmlBody.match(/class="lecture-equation-number"/g) ?? []).length, page.numbered_equations)
    assert.equal((htmlBody.match(/class="math-block"/g) ?? []).length, page.math.DisplayMath)
    // A full rendering pass catches unsupported TeX, not just source counts.
    const env = {}
    const rendered = md.render(source.replace(/<!--@include:[\s\S]*?-->/, content), env)
    assert.doesNotMatch(rendered, /data-mjx-error|<merror\b|data-tex=/)
    assert.match(rendered, /<mjx-assistive-mml/)
    assert.equal((rendered.match(/<mjx-container[^>]+display="true"/g) ?? []).length, page.math.DisplayMath)
    assert.match(content, /<details class="lecture-original note-details"/)
    assert.match(content, /PdfViewer v-if="showOriginal"/)
  })
}
