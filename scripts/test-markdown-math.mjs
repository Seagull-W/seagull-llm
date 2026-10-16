import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import texDelimiters from '../docs/.vitepress/markdown/tex-delimiters.mjs'
import { readContent } from './content-source.mjs'
import nativeHtml from '../docs/.vitepress/markdown/native-html.mjs'

const md = await createMarkdownRenderer(process.cwd(), {
  math: true,
  config(md) { md.use(texDelimiters); md.use(nativeHtml) }
})
const countMath = html => (html.match(/<mjx-container/g) || []).length

test('both dollar and LaTeX delimiters render', () => {
  const html = md.render(String.raw`Inline $x$ and \(y_i\).

$$z^2$$

\[
\frac{a}{b}
= c
\]
`)
  assert.equal(countMath(html), 4)
  assert.doesNotMatch(html, /data-mjx-error/)
})

test('code, escaped delimiters and unmatched delimiters remain literal', () => {
  const html = md.render('`\\(x\\)`\n\n```tex\n\\[x\\]\n```\n\n    \\[y\\]\n\n' +
    String.raw`Escaped \\(z\\) and unmatched \(open.`)
  assert.equal(countMath(html), 0)
  assert.match(html, /<code>/)
})

test('formula blocks interrupt paragraphs and work in lists and quotes', () => {
  const html = md.render(String.raw`Text
\[x=1\]

> \[
> y=2
> \]

- Item
  \[
  z=3
  \]
`)
  assert.equal(countMath(html), 3)
  assert.match(html, /<blockquote>/)
  assert.match(html, /<li>/)
})

test('inline formulas work inside tables and emphasis', () => {
  const html = md.render(String.raw`**\(x_i\)**

| Quantity | Value |
| --- | --- |
| Ratio | \(\frac{a}{b}\) |
`)
  assert.equal(countMath(html), 2)
  assert.match(html, /<table/)
  assert.match(html, /<strong>/)
})

test('actual GRPO HTML chapter retains readable math and SVG output', () => {
  const { source, content } = readContent('docs/rl-book/cha6强化学习.md')
  const expected = (content.match(/class="math-(?:inline|block)"/g) ?? []).length
  const html = md.render(source.replace(/<!--@include:[\s\S]*?-->/, content))
  assert.doesNotMatch(html, /data-mjx-error/)
  assert.ok(countMath(html) > 100, 'the real chapter must contain its equations')
  assert.equal(countMath(html), expected)
  assert.match(html, /<mjx-container[^>]*>[\s\S]*?<svg/)
  assert.match(html, /GRPO/)
})
