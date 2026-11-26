import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyTex, formatTex } from '../docs/.vitepress/components/math-tex-clipboard.ts'

test('TeX keeps alignment, spacing and internal line breaks in both copy formats', () => {
  const source = '  \r\na & = b \\\\\r\n  & < c\r  '
  const tex = 'a & = b \\\\\n  & < c'
  assert.equal(formatTex(source, true, false), tex)
  assert.equal(formatTex(source, true, true), `$$\n${tex}\n$$`)
  assert.equal(formatTex('  x + y  ', false, true), '$x + y$')
  assert.equal(formatTex('\n  ', true, true), '')
})

test('clipboard API receives plain text only for allowed, nonempty copies', async t => {
  const writeText = t.mock.fn(async () => {})
  t.mock.getter(globalThis, 'navigator', () => ({ clipboard: { writeText } }))
  assert.equal(await copyTex('x', () => false), false)
  assert.equal(await copyTex('', () => true), false)
  assert.equal(await copyTex('x', () => true), true)
  assert.deepEqual(writeText.mock.calls.map(call => call.arguments), [['x']])
})

test('an intervening annotation or selection cancels fallback after permission denial', async t => {
  let allowed = true
  const writeText = async () => {
    await Promise.resolve()
    allowed = false
    throw new Error('denied')
  }
  t.mock.getter(globalThis, 'navigator', () => ({ clipboard: { writeText } }))
  assert.equal(await copyTex('x', () => allowed), false)
})

test('fallback sets text/plain without moving focus, and releases its copy listener', async t => {
  const doc = new EventTarget()
  globalThis.document = doc
  t.after(() => { delete globalThis.document })
  const writeText = async () => { throw new Error('denied') }
  t.mock.getter(globalThis, 'navigator', () => ({ clipboard: { writeText } }))
  const setData = t.mock.fn()
  const event = () => Object.assign(new Event('copy', { cancelable: true }), { clipboardData: { setData } })
  doc.execCommand = command => {
    assert.equal(command, 'copy')
    assert.equal(doc.dispatchEvent(event()), false)
    return true
  }
  assert.equal(await copyTex('$x$', () => true), true)
  assert.equal(doc.dispatchEvent(event()), true)
  assert.deepEqual(setData.mock.calls.map(call => call.arguments), [['text/plain', '$x$']])

  doc.execCommand = () => false
  assert.equal(await copyTex('x', () => true), false)
  assert.equal(doc.dispatchEvent(event()), true)
})
