import { nextTick } from 'vue'
import { withBase } from 'vitepress'
import { heroImageFor, heroMobileMedia, resolveVisualStyle, type VisualStyle } from './visual-styles'
import { showPageArrival } from './page-arrival'

const homePicture = '.VPHome :is(.hero-art, .film-frame picture, .grace-hero-art) img'
const visiblePicture = homePicture + ', .VPDoc .section-illustration img'
// Large desktop night scenes can take ~250 ms on a cold connection. Beyond
// this budget their inline preview can carry the transition without a freeze.
const decodeBudget = 300
let warmed: HTMLImageElement | undefined

function inView<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector)
  const box = element?.getBoundingClientRect()
  const navBottom = document.querySelector('.VPNav')?.getBoundingClientRect().bottom ?? 0
  return box && box.width > 0 && box.height > 0 && box.bottom > navBottom && box.top < innerHeight ? element : null
}

// Hold just the latest intended hero in the decode cache, never the entire set
// of full-size landscape images when someone is browsing the book of covers.
export function warmHomePicture(style: VisualStyle, dark: boolean) {
  const current = inView<HTMLImageElement>(homePicture)
  if (!current) return
  const path = heroImageFor(style, dark, matchMedia(heroMobileMedia).matches)
  const url = new URL(withBase(path), document.baseURI).href
  if (current.currentSrc === url || warmed?.src === url) return
  const image = new Image()
  warmed = image
  image.fetchPriority = 'low'
  image.src = url
  image.decode?.().catch(() => { if (warmed === image) warmed = undefined })
}

async function decodeVisiblePicture(cancelled?: Promise<void>) {
  const image = inView<HTMLImageElement>(visiblePicture)
  if (!image?.decode) return
  let timer: number | undefined
  const limit = new Promise<void>(resolve => { timer = window.setTimeout(resolve, decodeBudget) })
  try {
    const waits = [image.decode(), limit]
    if (cancelled) waits.push(cancelled)
    await Promise.race(waits)
  } catch { /* An image error or a superseding source never prevents a choice. */ }
  finally { window.clearTimeout(timer) }
}

// Only deliberate choices call this helper. Restoring preferences on load or
// synchronizing another tab must not animate the page someone is reading.
let active: { transition: ViewTransition; commit: () => void; stopWaiting: () => void } | undefined
let revision = 0

export function changeAppearance(kind: VisualStyle['iconSet'], update: () => void) {
  const request = ++revision
  if (active) {
    // A second click can arrive before the first snapshot's update callback.
    // Commit both choices in order and let the latest one appear immediately.
    active.stopWaiting()
    active.transition.skipTransition()
    active.commit()
    update()
    return
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  const root = document.documentElement
  if (!document.startViewTransition) {
    const route = location.pathname
    update()
    nextTick(async () => {
      await decodeVisiblePicture()
      if (request === revision && route === location.pathname) showPageArrival(resolveVisualStyle(root.dataset.visualStyle))
    })
    return
  }
  let appearance: string = kind
  if (kind === 'cinema') {
    // When there is a visible picture, dissolve only the two shots. For an
    // article use an opaque projection gate so text keeps its contrast.
    if (!inView('.film-frame picture, .home-illustrated-hero, .grace-hero, .section-illustration')) appearance = 'cinema-gate'
  }

  root.dataset.appearanceMotion = appearance
  let committed = false
  function commit() {
    if (committed) return
    committed = true
    update()
  }

  let stopWaiting!: () => void
  const cancelled = new Promise<void>(resolve => { stopWaiting = resolve })
  const transition = document.startViewTransition(async () => {
    commit()
    await nextTick()
    await decodeVisiblePicture(cancelled)
  })
  active = { transition, commit, stopWaiting }
  // Skipping the animation rejects ready but still runs the update callback.
  transition.ready.catch(() => {})
  function clear() {
    if (active?.transition !== transition) return
    active = undefined
    delete root.dataset.appearanceMotion
  }
  transition.finished.then(clear, clear)
}
