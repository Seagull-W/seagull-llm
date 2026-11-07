import { nextTick } from 'vue'
import { withBase } from 'vitepress'
import { closingImageFor, heroImageFor, heroMobileMedia, resolveVisualStyle, type VisualStyle } from './visual-styles'
import { showPageArrival } from './page-arrival'

const homePicture = '.VPHome :is(.hero-art, .film-frame picture, .grace-hero-art) img'
const warmed = new Map<string, HTMLImageElement>()
let hoverTimer: number | undefined

function inView<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector)
  const box = element?.getBoundingClientRect()
  const navBottom = document.querySelector('.VPNav')?.getBoundingClientRect().bottom ?? 0
  return box && box.width > 0 && box.height > 0 && box.bottom > navBottom && box.top < innerHeight ? element : null
}

export function cancelPicturePreview() {
  window.clearTimeout(hoverTimer)
}

export function previewAppearancePicture(style: VisualStyle, dark: boolean) {
  cancelPicturePreview()
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (connection?.saveData || ['2g', 'slow-2g'].includes(connection?.effectiveType ?? '')) return
  hoverTimer = window.setTimeout(() => warmAppearancePicture(style, dark, 'low'), 140)
}

// Reuse a pending request on selection. Two strong references cover a round trip
// between themes without retaining every landscape in decoded form.
export function warmAppearancePicture(style: VisualStyle, dark: boolean, priority: 'low' | 'high' = 'high') {
  cancelPicturePreview()
  const mobile = matchMedia(heroMobileMedia).matches
  const hero = inView<HTMLImageElement>(homePicture)
  const footer = !hero && inView('.home-colophon')
  if (!hero && !footer) return
  const path = hero ? heroImageFor(style, dark, mobile) : closingImageFor(style, dark, mobile)
  const url = new URL(withBase(path), document.baseURI).href
  if (hero?.currentSrc === url || (footer && footer.querySelector('img')?.currentSrc === url)) return
  const cached = warmed.get(url)
  if (cached) {
    warmed.delete(url)
    warmed.set(url, cached)
    if (priority === 'high') cached.fetchPriority = priority
    return
  }
  const image = new Image()
  if (warmed.size >= 2) warmed.delete(warmed.keys().next().value!)
  warmed.set(url, image)
  const release = () => { if (warmed.get(url) === image) warmed.delete(url) }
  image.onerror = release
  image.fetchPriority = priority
  image.decoding = 'async'
  image.src = url
  image.decode?.().catch(release)
}

// Only deliberate choices call this helper. Restoring preferences on load or
// synchronizing another tab must not animate the page someone is reading.
let active: { transition: ViewTransition; commit: () => void } | undefined
let revision = 0

export function changeAppearance(kind: VisualStyle['iconSet'], update: () => void) {
  const request = ++revision
  if (active) {
    // A second click can arrive before the first snapshot's update callback.
    // Commit both choices in order and let the latest one appear immediately.
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
    nextTick(() => {
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

  const transition = document.startViewTransition(() => {
    commit()
    // The browser freezes painting until this callback resolves. Network and
    // image decoding continue independently of the Vue DOM update.
    return nextTick()
  })
  active = { transition, commit }
  // Skipping the animation rejects ready but still runs the update callback.
  transition.ready.catch(() => {})
  function clear() {
    if (active?.transition !== transition) return
    active = undefined
    delete root.dataset.appearanceMotion
  }
  transition.finished.then(clear, clear)
}
