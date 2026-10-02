import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import texDelimiters from '../docs/.vitepress/markdown/tex-delimiters.mjs'

const md = await createMarkdownRenderer(process.cwd(), {
  math: true,
  config(md) { md.use(texDelimiters) }
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

test('actual GRPO chapter renders every complete LaTeX formula', async () => {
  const source = await readFile('docs/rl-book/cha6强化学习.md', 'utf8')
  const html = md.render(source)
  const expected = (source.match(/^\s*\\\[/gm) || []).length +
    (source.match(/(?<!\\)\\\(/g) || []).length
  const parsed = md.parse(source, {})
  const tokens = parsed.flatMap(token => [token, ...(token.children || [])])
  assert.equal(tokens.filter(token => token.markup === '\\[' || token.markup === '\\(').length, expected)
  assert.doesNotMatch(html, /data-mjx-error/)
  assert.ok(countMath(html) >= expected)
})
