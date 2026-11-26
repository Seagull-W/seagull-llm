import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

// Exercise the production engine in an isolated DOM/clock; no browser or new dependency required.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../docs/.vitepress/components/atlas/atlas-engine.ts', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'Atlas', platform: 'browser', target: 'es2022',
})
const code = bundle.outputFiles[0].text
const nodes = [
  { id: 'article', kind: 'article', label: '文章', value: '/article', x: -200, y: 100 },
  { id: 'section', kind: 'section', label: '栏目', value: 'section', x: 180, y: -160 },
]

function eventTarget() {
  const listeners = new Map()
  return {
    listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
      if (!listeners.get(type)?.size) listeners.delete(type)
    },
    dispatch(type, event = {}) {
      for (const listener of [...(listeners.get(type) || [])]) listener({ ...event, type })
    },
  }
}

function fixture(t, reduced = true) {
  let now = 0, serial = 0, observerDisconnected = false
  const frames = new Map(), selections = []
  const gradient = () => ({ addColorStop() {} })
  const context = new Proxy({
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    createRadialGradient: gradient, createLinearGradient: gradient,
    measureText: text => ({ width: text.length * 8 }),
  }, { get: (object, key) => key in object ? object[key] : () => {} })
  function makeCanvas() {
    const captures = new Set()
    return {
      ...eventTarget(), width: 0, height: 0, style: {}, captures,
      getContext: () => context,
      getBoundingClientRect: () => ({ width: 1200, height: 800, left: 0, top: 0 }),
      setPointerCapture: id => captures.add(id),
      hasPointerCapture: id => captures.has(id),
      releasePointerCapture(id) { captures.delete(id); this.dispatch('lostpointercapture', { pointerId: id }) },
    }
  }
  const media = { ...eventTarget(), matches: reduced }
  const document = { ...eventTarget(), hidden: false, createElement: makeCanvas }
  const window = { ...eventTarget(), devicePixelRatio: 2, matchMedia: () => media }
  const sandbox = {
    document, window, performance: { now: () => now },
    getComputedStyle: () => ({ getPropertyValue: () => '#040b12' }),
    ResizeObserver: class { observe() {} disconnect() { observerDisconnected = true } },
    requestAnimationFrame: callback => { frames.set(++serial, callback); return serial },
    cancelAnimationFrame: id => frames.delete(id),
  }
  runInNewContext(code, sandbox)
  const canvas = makeCanvas()
  const engine = sandbox.Atlas.createAtlasEngine({
    canvas, nebula: makeCanvas(), nodes, links: [{ source: 'article', target: 'section' }],
    onHover() {}, onSelect: (...selection) => selections.push(selection),
  })
  t.after(() => engine.dispose())
  return {
    engine, canvas, document, window, media, frames, selections,
    get observerDisconnected() { return observerDisconnected },
    frame(at = now + 16.67) {
      now = at
      const callbacks = [...frames.values()]
      frames.clear()
      for (const callback of callbacks) callback(now)
    },
    pointer(type, id, x, y) {
      canvas.dispatch(type, { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: now })
    },
    distance() {
      const a = engine.getNodePosition('article'), b = engine.getNodePosition('section')
      return Math.hypot(a.x - b.x, a.y - b.y)
    },
  }
}

test('reduced motion renders once, while focus and zoom still update the static scene', t => {
  const f = fixture(t)
  f.frame()
  assert.equal(f.frames.size, 0, 'a static scene must not keep an idle animation loop')
  assert.equal(f.canvas.width, 2400, 'rendering retains high DPI resolution')
  f.engine.focus('article')
  f.frame()
  const focused = f.engine.getNodePosition('article')
  assert.ok(Math.abs(focused.x - 600) < .01 && Math.abs(focused.y - 368) < .01)
  const before = f.distance()
  f.engine.zoom(2)
  f.frame()
  assert.ok(Math.abs(f.distance() / before - 2) < .001)
  assert.equal(f.frames.size, 0, 'direct interaction must settle back to a static scene')
})

test('touch selects on the first tap, reports a repeat tap, and never selects after a pinch', t => {
  const f = fixture(t)
  f.frame()
  const star = f.engine.getNodePosition('article')
  for (let tap = 0; tap < 2; tap++) {
    f.pointer('pointerdown', 1, star.x, star.y)
    f.pointer('pointerup', 1, star.x, star.y)
    f.frame()
  }
  assert.deepEqual(f.selections, [['article', false], ['article', true]])
  const before = f.distance()
  f.pointer('pointerdown', 1, 300, 300)
  f.pointer('pointerdown', 2, 500, 300)
  f.pointer('pointermove', 2, 700, 300)
  f.pointer('pointerup', 2, 700, 300)
  f.pointer('pointerup', 1, 300, 300)
  f.frame()
  assert.ok(f.distance() > before * 1.8, 'pinch changes the camera scale')
  assert.equal(f.selections.length, 2, 'ending a pinch must not activate a node')
  assert.equal(f.canvas.captures.size, 0)
})

test('interrupting a flight with zoom keeps the currently visible camera', t => {
  const f = fixture(t, false)
  f.frame(1300) // Finish the opening reveal before testing the camera itself.
  f.engine.focus('article')
  f.frame(1800)
  const before = f.engine.getNodePosition('article')
  f.engine.zoom(1)
  f.frame(1816.67)
  const after = f.engine.getNodePosition('article')
  assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1, 'only normal micro-drift may move the node; the old flight target must not take over')
})

test('hidden pages stop rendering; reduced motion and disposal cancel animation resources', t => {
  const f = fixture(t, false)
  f.frame(1300)
  assert.equal(f.frames.size, 1)
  f.document.hidden = true
  f.document.dispatch('visibilitychange')
  assert.equal(f.frames.size, 0)
  f.engine.focus('article')
  assert.equal(f.frames.size, 0, 'invalidating a hidden scene must not schedule a frame')
  f.document.hidden = false
  f.document.dispatch('visibilitychange')
  assert.equal(f.frames.size, 1)
  f.media.matches = true
  f.media.dispatch('change')
  f.frame()
  assert.equal(f.frames.size, 0)
  f.pointer('pointerdown', 1, 300, 300)
  f.engine.dispose()
  assert.equal(f.frames.size, 0)
  assert.equal(f.canvas.captures.size, 0)
  assert.equal(f.canvas.listeners.size + f.document.listeners.size + f.window.listeners.size + f.media.listeners.size, 0)
  assert.ok(f.observerDisconnected)
})
