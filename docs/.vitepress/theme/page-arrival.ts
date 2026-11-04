import type { VisualStyleId } from './visual-styles'

let cancelArrival: (() => void) | undefined

/** Find the visible opening; history navigation may instead restore a paragraph halfway down. */
function visibleOpening() {
  const main = document.querySelector<HTMLElement>('.VPHome, .VPDoc main, .VPPage')
  if (!main) return
  const opening = main.querySelector<HTMLElement>(
    '.home-illustrated-hero, .film-hero, .grace-hero, .document-intro, .note-hero, .linux-note-content .hero, .gallery-header, h1 + .custom-block',
  ) ?? main.querySelector<HTMLElement>('h1')
  const rect = opening?.getBoundingClientRect()
  const navBottom = document.querySelector('.VPNav')?.getBoundingClientRect().bottom ?? 0
  if (opening && rect && rect.bottom > navBottom + 24 && rect.top < innerHeight - 24) return opening

  const bounds = main.getBoundingClientRect()
  const x = Math.min(innerWidth - 1, Math.max(1, bounds.left + bounds.width / 2))
  const y = Math.min(innerHeight - 1, Math.max(navBottom + 48, bounds.top + 48, innerHeight * .37))
  const at = document.elementFromPoint(x, y)
  if (!at || !main.contains(at)) return
  const panel = at.closest<HTMLElement>('section, header, .custom-block, .update-grid, .section-grid')
  if (panel && panel.offsetHeight < innerHeight * 1.5) return panel
  return at.closest<HTMLElement>('p, h1, h2, h3, li, pre, figure, table, a') ?? opening
}

export function showPageArrival(style: VisualStyleId) {
  cancelArrival?.()
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return

  // Vue has rendered the new route. Let VitePress finish its own scroll
  // restoration before choosing which part of that route the reader can see.
  let target: HTMLElement | undefined
  const frame = requestAnimationFrame(() => {
    target = visibleOpening()
    if (!target) { clear(); return }
    target.dataset.routeArrival = style
    target.addEventListener('animationend', finish)
    target.addEventListener('animationcancel', finish)
  })
  function finish(event: AnimationEvent) {
    if (event.target === target && !event.pseudoElement && event.animationName.startsWith('seagull-arrive-')) clear()
  }
  function clear() {
    cancelAnimationFrame(frame)
    if (target) {
      delete target.dataset.routeArrival
      target.removeEventListener('animationend', finish)
      target.removeEventListener('animationcancel', finish)
      target = undefined
    }
    if (cancelArrival === clear) cancelArrival = undefined
  }
  cancelArrival = clear
  return clear
}
