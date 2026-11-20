import type { HtmlRegion, RegionRect } from './annotations'

const targets = 'img,mjx-container,math,table,pre,figure,p,li,blockquote,section,[id]'

function fingerprint(el: Element) {
  const content = el instanceof HTMLImageElement
    ? (el.getAttribute('src') ?? '') + ' ' + el.alt
    : (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return [el.localName, content.length, content.slice(0, 160), content.slice(-110)].join('|')
}

function contains(outer: DOMRect, inner: DOMRect) {
  return outer.left <= inner.left && outer.top <= inner.top &&
    outer.right >= inner.right && outer.bottom >= inner.bottom
}

export function captureHtmlRegion(root: HTMLElement, selection: DOMRect): { element: Element; region: HtmlRegion } {
  let element: Element = root
  let bounds = root.getBoundingClientRect()
  for (const candidate of root.querySelectorAll(targets)) {
    const rect = candidate.getBoundingClientRect()
    // A scroll wrapper can be narrower than its table. Prefer the table when
    // both contain the selection so the anchor moves with the table content.
    if (contains(rect, selection) && (element.contains(candidate) || rect.width * rect.height < bounds.width * bounds.height)) {
      element = candidate
      bounds = rect
    }
  }
  const path: number[] = []
  for (let child = element; child !== root; child = child.parentElement!) {
    path.unshift(Array.prototype.indexOf.call(child.parentElement!.children, child))
  }
  const closestFigure = element.closest('figure')
  const label = (element instanceof HTMLImageElement && element.alt ||
    element.closest('table')?.caption?.textContent ||
    closestFigure?.querySelector('figcaption')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  return { element, region: {
    path, fingerprint: fingerprint(element), label,
    x: (selection.left - bounds.left) / bounds.width,
    y: (selection.top - bounds.top) / bounds.height,
    w: selection.width / bounds.width,
    h: selection.height / bounds.height
  } }
}

export function locateHtmlRegion(root: HTMLElement, region: HtmlRegion): Element | undefined {
  let element: Element | undefined = root
  for (const index of region.path) element = element?.children[index]
  if (element && fingerprint(element) === region.fingerprint) return element
  // A figure or paragraph may have moved after an article edit. Restore it only on a unique match.
  const matches = Array.from(root.querySelectorAll(targets)).filter(el => fingerprint(el) === region.fingerprint)
  return matches.length === 1 ? matches[0] : undefined
}

export function regionBounds(region: RegionRect, bounds: DOMRect) {
  return new DOMRect(bounds.x + region.x*bounds.width, bounds.y + region.y*bounds.height,
    region.w*bounds.width, region.h*bounds.height)
}

export function visibleRegionBounds(el: Element, region: HtmlRegion, root: HTMLElement) {
  const box = regionBounds(region, el.getBoundingClientRect())
  let { left, top, right, bottom } = box
  for (let parent = el.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    const viewport = parent.getBoundingClientRect()
    if (style.overflowX !== 'visible') {
      left = Math.max(left, viewport.left)
      right = Math.min(right, viewport.right)
    }
    if (style.overflowY !== 'visible') {
      top = Math.max(top, viewport.top)
      bottom = Math.min(bottom, viewport.bottom)
    }
  }
  if (right > left && bottom > top) return new DOMRect(left, top, right - left, bottom - top)
}

export function revealHtmlRegion(el: Element, region: HtmlRegion, root: HTMLElement) {
  for (let parent = el.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true
  }
  for (let parent = el.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
    if (parent.scrollWidth <= parent.clientWidth || !['auto','scroll'].includes(getComputedStyle(parent).overflowX)) continue
    const box = regionBounds(region, el.getBoundingClientRect())
    const viewport = parent.getBoundingClientRect()
    if (box.left < viewport.left || box.right > viewport.right) {
      parent.scrollBy({ left:box.x - viewport.x - (parent.clientWidth - box.width)/2, behavior:'instant' })
    }
  }
}

export function cropHtmlRegion(image: HTMLImageElement, region: HtmlRegion, maxWidth: number, maxHeight: number) {
  if (!image.complete || !image.naturalWidth) return
  const width = image.naturalWidth*region.w, height = image.naturalHeight*region.h
  const scale = Math.min(1, maxWidth/width, maxHeight/height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width*scale))
  canvas.height = Math.max(1, Math.round(height*scale))
  canvas.getContext('2d')?.drawImage(image, image.naturalWidth*region.x, image.naturalHeight*region.y,
    width, height, 0, 0, canvas.width, canvas.height)
  return canvas
}
