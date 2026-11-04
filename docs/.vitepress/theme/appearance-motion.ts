import { nextTick } from 'vue'
import type { VisualStyle } from './visual-styles'

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
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  if (kind === 'cinema') {
    // A style change may enter the film layout from an illustrated home or
    // directory. Only take a snapshot if its scene will actually be in view.
    const bounds = document.querySelector('.film-frame picture, .home-illustrated-hero, .section-illustration')?.getBoundingClientRect()
    if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) {
      update()
      return
    }
  }

  const root = document.documentElement
  root.dataset.appearanceMotion = kind
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
