import { nextTick } from 'vue'
import { resolveVisualStyle, type VisualStyle } from './visual-styles'
import { showPageArrival } from './page-arrival'

// Only deliberate choices call this helper. Restoring preferences on load or
// synchronizing another tab must not animate the page someone is reading.
let active: { transition: ViewTransition; commit: () => void } | undefined

export function changeAppearance(kind: VisualStyle['iconSet'], update: () => void) {
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
    update()
    nextTick(() => showPageArrival(resolveVisualStyle(root.dataset.visualStyle)))
    return
  }
  let appearance: string = kind
  if (kind === 'cinema') {
    // When there is a visible picture, dissolve only the two shots. For an
    // article use an opaque projection gate so text keeps its contrast.
    const bounds = document.querySelector('.film-frame picture, .home-illustrated-hero, .grace-hero, .section-illustration')?.getBoundingClientRect()
    if (!bounds || bounds.bottom <= 64 || bounds.top >= window.innerHeight - 24) appearance = 'cinema-gate'
  }

  root.dataset.appearanceMotion = appearance
  let committed = false
  function commit() {
    if (committed) return
    committed = true
    update()
  }

  const transition = document.startViewTransition(async () => {
    commit()
    await nextTick()
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
