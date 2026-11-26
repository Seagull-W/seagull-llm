import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { isVisualPart, locateQuote, type Anchor, type Annotation, type Box, type Kind, type Position } from './annotations'
import { cropPdfBox, imageAt, pageBounds, pdfSelection } from './pdf-selection'
import { captureHtmlRegion, cropHtmlRegion, locateHtmlRegion, regionBounds as boundsFor, revealHtmlRegion, visibleRegionBounds } from './html-selection'

type Mark = { id: string; part: number; number: number; filled: boolean; color?: string; area?: boolean; marginTop?: string; parent: HTMLElement; style: Record<string, string> }
type Point = { x: number; y: number }
const bound = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
function textNodes(root: Element) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(node) {
    return node.parentElement?.closest('script,style,button,.header-anchor,.annotation-notebook') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  } })
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}
function htmlRange(a: Anchor, nodes: Text[], text: string) {
  const start = locateQuote(text, a)
  if (start < 0) return
  const range = document.createRange()
  let offset = 0, began = false
  for (const node of nodes) {
    const end = offset + node.length
    if (!began && start < end) { range.setStart(node, start - offset); began = true }
    if (began && start + a.quote.length <= end) { range.setEnd(node, start + a.quote.length - offset); return range }
    offset = end
  }
}
export function useAnnotationSource(options: {
  editable: () => boolean; kind: Kind; target: () => HTMLElement | undefined; annotations: Ref<Annotation[]>; active: Ref<string>
  panel: Ref<HTMLElement | undefined>; showing: () => boolean
  onMark: (id: string, part: number) => void; onComment: (anchor: Anchor) => void; notice: (message: string) => void
}) {
  const { target, kind } = options
  const marks = shallowRef<Mark[]>([]), missing = shallowRef<string[]>([])
  const selection = shallowRef<Anchor>(), toolPoint = shallowRef<Point & { bottom: number }>()
  const visualRects = shallowRef<DOMRect[]>([])
  let direct = false, suppressClick = false, consumedEnter = false
  const boxMode = ref(false), sourceImages = shallowRef(new Map<string,string>()), connector = ref('')
  const scroller = () => target()?.closest<HTMLElement>('.pdf-scroll')
  const pageAt = (page: number) => target()?.querySelector<HTMLElement>('.page[data-page-number="' + page + '"]')
  let observer: MutationObserver | undefined, resize: ResizeObserver | undefined, cardResize: ResizeObserver | undefined
  let geometryFrame = 0, layoutFrame = 0, mounted = false, selecting = false
  let partIndex = 0, observedCard: HTMLElement | undefined
  const rendered = new Map<number,number>()
  const imageStamps = new Map<string,{ id:string; anchor:Anchor; stamp:string }>()
  const ranges = new Map<Anchor, Range>()
  let drag: { element: HTMLElement; id: number; start: Point; manual:boolean; preview?: HTMLElement } | undefined

  function rects(a: Anchor) {
    if (kind === 'pdf') {
      const bounds = new Map<number,DOMRect>()
      return a.boxes.map(b => {
        if (!bounds.has(b.page)) {
          const page = pageAt(b.page)
          if (page) bounds.set(b.page,pageBounds(page))
        }
        const p = bounds.get(b.page)
        return p && boundsFor(b,p)
      })
    }
    const root = target()
    if (!root) return []
    if (a.region) {
      const el = locateHtmlRegion(root,a.region), box = el && visibleRegionBounds(el,a.region,root)
      return box ? [box] : []
    }
    const cached = ranges.get(a)
    if (cached) return Array.from(cached.getClientRects())
    const nodes = textNodes(root)
    return Array.from(htmlRange(a, nodes, nodes.map(n => n.data).join(''))?.getClientRects() ?? [])
  }
  function visibleArea() {
    const r = scroller()?.getBoundingClientRect()
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
    const right = left + (viewport?.width ?? innerWidth), bottom = top + (viewport?.height ?? innerHeight)
    const panel = kind === 'html' && options.showing() ? options.panel.value?.getBoundingClientRect() : undefined
    const panelTop = panel && panel.left <= left + 1 && panel.right >= right - 1 ? panel.top : bottom
    return { left: Math.max(left, r?.left ?? left), top: Math.max(top, r?.top ?? top),
      right: Math.min(right, r?.right ?? right), bottom: Math.min(bottom, panelTop, r?.bottom ?? bottom) }
  }
  function rebuild() {
    if (!mounted || geometryFrame) return
    geometryFrame = requestAnimationFrame(() => {
      geometryFrame = 0
      const root = target(), result: Mark[] = [], lost: string[] = []
      if (!root) return
      ranges.clear()
      const parents = new Map<number, HTMLElement>()
      const nextBadgeY = new Map<number, number>()
      const nodes = kind === 'html' ? textNodes(root) : [], text = nodes.map(n => n.data).join('')
      for (const [i, n] of options.annotations.value.entries()) {
        const base = { id: n.id, number: i + 1, filled: n.highlighted, color: n.highlightColor }
        if (kind === 'pdf') {
          n.anchor.boxes.forEach((b, part) => {
            let parent = parents.get(b.page)
            if (!parent) {
              const page = pageAt(b.page)
              if (!page) return
              parent = page.querySelector<HTMLElement>(':scope > .notebook-marks') ?? undefined
              if (!parent) { parent = document.createElement('div'); parent.className = 'notebook-marks'; page.append(parent) }
              parents.set(b.page,parent)
            }
            const area = isVisualPart(n.anchor,b)
            let marginTop: string | undefined
            if (part === 0 && !area && parent.clientHeight) {
              // Annotations are in reading order. Leave space for notes on the same line.
              const y = Math.max(b.y, nextBadgeY.get(b.page) ?? 0)
              marginTop = y*100+'%'
              nextBadgeY.set(b.page,y+18/parent.clientHeight)
            }
            result.push({ ...base, part, parent, area, marginTop, style: { left: b.x*100+'%', top: b.y*100+'%', width: b.w*100+'%', height: b.h*100+'%' } })
          })
          if (options.showing()) updateImages(n)
        } else if (n.anchor.region) {
          const region = n.anchor.region, el = locateHtmlRegion(root,region)
          if (!el) { lost.push(n.id); continue }
          const r = visibleRegionBounds(el,region,root)
          if (r) result.push({ ...base, part:0, area:true, parent:document.body,
            style: { left:r.x+scrollX+'px', top:r.y+scrollY+'px', width:r.width+'px', height:r.height+'px' } })
          if (options.showing()) updateHtmlImage(n,el)
        } else {
          const range = htmlRange(n.anchor, nodes, text)
          if (!range) { lost.push(n.id); continue }
          ranges.set(n.anchor,range)
          Array.from(range.getClientRects()).forEach((r, part) => {
            if (r.width && r.height) result.push({ ...base, part, parent: document.body,
              style: { left: r.x+scrollX+'px', top: r.y+scrollY+'px', width: r.width+'px', height: r.height+'px' } })
          })
        }
      }
      marks.value = result; missing.value = lost
      const anchors = new Map(options.annotations.value.map(n => [n.id,n.anchor]))
      for (const [id,v] of imageStamps) {
        if (anchors.get(v.id) !== v.anchor) {
          imageStamps.delete(id)
          const next = new Map(sourceImages.value); next.delete(id); sourceImages.value=next
        }
      }
      nextTick(layout)
    })
  }

  function ownedRange() {
    const root = target(), sel = window.getSelection()
    if (!root || !sel?.rangeCount || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    if (root.contains(range.startContainer) && root.contains(range.endContainer)) return range
  }
  function capture() {
    if (!options.editable()) return
    const root = target(), range = ownedRange()
    if (!mounted || !root || !range || selecting || boxMode.value) return
    const quote = window.getSelection()!.toString().trim()
    resetSelection()
    if (quote.length > 50000) { options.notice('选文超过 5 万字，请分段批注。'); return }
    if (kind === 'pdf') {
      const anchor = pdfSelection(range, root, quote)
      if (!anchor) return
      if (anchor.boxes.length > 1000) { options.notice('选区过长，请分段批注。'); return }
      selection.value = anchor
    } else {
      const nodes = textNodes(root)
      let offset = 0, start = -1, end = -1
      for (const node of nodes) {
        if (node === range.startContainer) start = offset + range.startOffset
        if (node === range.endContainer) end = offset + range.endOffset
        offset += node.length
      }
      if (start < 0 || end < start) return
      const text = nodes.map(n => n.data).join(''), raw = text.slice(start, end), exact = raw.trim()
      if (!exact) return
      start += raw.length - raw.trimStart().length
      selection.value = { quote: exact, boxes: [], start, prefix: text.slice(Math.max(0,start-40),start), suffix: text.slice(start+exact.length,start+exact.length+40) }
    }
    updateLayout()
  }
  function resetSelection() {
    direct = false; selection.value = undefined; toolPoint.value = undefined; visualRects.value = []
  }
  function clearSelection() {
    if (ownedRange()) window.getSelection()?.removeAllRanges()
    resetSelection()
  }
  function selectVisual(box: Box) {
    clearSelection()
    scroller()?.focus({preventScroll:true})
    direct = true; selection.value = {quote:'',boxes:[box]}
    updateLayout()
  }
  function updateImages(n: Annotation, pageNumber?: number) {
    n.anchor.boxes.forEach((b,part) => {
      if (isVisualPart(n.anchor,b) && (!pageNumber || pageNumber === b.page)) updateImage(n,b,part)
    })
  }
  function updateImage(n: Annotation, b:Box, part:number) {
    const key=n.id+':'+part, page=pageAt(b.page), canvas=page?.querySelector<HTMLCanvasElement>('.canvasWrapper canvas')
    if (!page || !canvas?.width || !canvas.height) return
    const stamp = [rendered.get(b.page),canvas.width,canvas.height].join('/')
    const old=imageStamps.get(key)
    if (old?.anchor === n.anchor && old.stamp === stamp) return
    if (!old && imageStamps.size >= 48 && options.active.value !== n.id) return
    try {
      const img = cropPdfBox(page,b,800,400)
      if (img) rememberImage(n,key,stamp,img)
    } catch { /* The saved page coordinates can still open the source. */ }
  }
  function updateHtmlImage(n: Annotation, el: Element) {
    if (!(el instanceof HTMLImageElement) || !n.anchor.region) return
    const key=n.id+':0', stamp=el.currentSrc
    const old=imageStamps.get(key)
    if (old?.anchor === n.anchor && old.stamp === stamp) return
    if (!old && imageStamps.size >= 48 && options.active.value !== n.id) return
    try {
      const image = cropHtmlRegion(el,n.anchor.region,800,400)
      if (image) rememberImage(n,key,stamp,image)
    } catch { /* Cross-origin images still have a saved selection. */ }
  }
  function rememberImage(n: Annotation, key: string, stamp: string, image: HTMLCanvasElement) {
    const data = image.toDataURL()
    const next = new Map(sourceImages.value)
    if (!next.has(key) && next.size >= 48) {
      const first=next.keys().next().value!
      imageStamps.delete(first); next.delete(first)
    }
    next.set(key,data); imageStamps.set(key,{id:n.id,anchor:n.anchor,stamp}); sourceImages.value=next
  }
  function updateLayout() {
    const view = visibleArea()
    const visible = (r?: DOMRect): r is DOMRect => !!r && r.bottom > view.top && r.top < view.bottom && r.right > view.left && r.left < view.right
    if (selection.value) {
      const selected = selection.value, parts = rects(selected), r = parts.find(visible)
      visualRects.value = parts.flatMap((part,i) => {
        if (!visible(part) || !selected.boxes[i]?.content) return []
        const x=Math.max(view.left,part.left), y=Math.max(view.top,part.top)
        return [new DOMRect(x,y,Math.min(view.right,part.right)-x,Math.min(view.bottom,part.bottom)-y)]
      })
      toolPoint.value = r ? { x: bound(r.x+r.width/2, view.left, view.right), y: Math.max(r.top, view.top), bottom: Math.min(r.bottom,view.bottom) } : undefined
    }
    connector.value = ''
    const panel = options.panel.value
    if (!options.showing() || !panel) return
    const n = options.annotations.value.find(n => n.id === options.active.value)
    const card = n && panel.querySelector<HTMLElement>('[data-note-id="' + n.id + '"]')
    if (card !== observedCard) {
      cardResize?.disconnect(); observedCard = card || undefined
      if (card) { cardResize = new ResizeObserver(layout); cardResize.observe(card) }
    }
    if (!n || !card) return
    const rectList = rects(n.anchor)
    const index = visible(rectList[partIndex]) ? partIndex : rectList.findIndex(visible)
    const r = rectList[index]
    if (!r) return
    if (kind === 'pdf') updateImages(n)
    // A connector from a text run crosses the rest of the printed line.
    if (n.anchor.quote && !n.anchor.boxes[index]?.content) return
    const list = card.closest('.notebook-list')!.getBoundingClientRect(), edge = card.getBoundingClientRect()
    const label = card.querySelector('.note-location')!.getBoundingClientRect()
    const x1 = bound(r.right,view.left,view.right-2), y1 = (Math.max(view.top,r.top)+Math.min(view.bottom,r.bottom))/2
    const x2 = edge.left, y2 = label.y + label.height/2
    if (x2 <= x1+2 || y2 < Math.max(list.top,0) || y2 > Math.min(list.bottom,innerHeight) ||
        (kind === 'pdf' && panel.getBoundingClientRect().top >= view.bottom-1)) return
    const bend = (x2-x1)/2
    connector.value = 'M '+x1+' '+y1+' C '+(x1+bend)+' '+y1+' '+(x2-bend)+' '+y2+' '+x2+' '+y2
  }
  function layout() {
    if (mounted && !layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; updateLayout() })
  }
  function pageRendered(page: number) {
    rendered.set(page,(rendered.get(page) ?? 0)+1)
    if (options.showing()) {
      for (const n of options.annotations.value) updateImages(n,page)
      layout()
    }
  }
  let focusRun = 0
  async function focusSource(n: Annotation, part = 0, scrollPolicy: 'center' | 'if-hidden' = 'center') {
    const run = ++focusRun
    partIndex = part
    await nextTick(); await frame(); await frame()
    if (!mounted || !options.showing() || run !== focusRun || options.active.value !== n.id) return
    const root = target()
    if (root && n.anchor.region) {
      const element = locateHtmlRegion(root,n.anchor.region)
      if (element) {
        revealHtmlRegion(element,n.anchor.region,root)
        rebuild()
      }
    }
    const scroll = scroller()
    if (scroll) {
      const reader = scroll.closest<HTMLElement>('.pdf-reader')!
      const bounds = reader.getBoundingClientRect(), viewport = window.visualViewport
      const top = viewport?.offsetTop ?? 0
      if (bounds.bottom < top + 80 || bounds.top > top + (viewport?.height ?? innerHeight)) reader.scrollIntoView({ block: 'nearest' })
    }
    const r = rects(n.anchor)[part]
    if (!r) return
    const view = visibleArea()
    const toolbar = root?.closest('.VPDoc')?.querySelector('.reader-navigation')
    const nav = document.querySelector('.VPNav')
    const toolbarRect = toolbar && getComputedStyle(toolbar).position === 'sticky' ? toolbar.getBoundingClientRect() : null
    let top = Math.max(view.top, nav?.getBoundingClientRect().bottom ?? 0)
    if (toolbarRect && toolbarRect.top <= top + 1) top = Math.max(top, toolbarRect.bottom)
    if (top >= view.bottom) return
    const visibleHeight = Math.min(r.bottom, view.bottom) - Math.max(r.top, top)
    if (scrollPolicy === 'if-hidden' && visibleHeight >= Math.min(r.height,view.bottom-top) - 1 && r.left >= view.left && r.right <= view.right) {
      layout()
      return
    }
    const readingLine = top + Math.max(0, view.bottom-top-r.height)*.42
    if (scroll) {
      scroll.scrollBy({ left:r.x-view.left-(view.right-view.left-r.width)/2, top:r.y-readingLine, behavior:'instant' })
    } else {
      window.scrollBy({ top: r.y-readingLine, behavior:'instant' })
    }
    layout()
  }
  // Save the page point at a fixed reading line, including horizontal pan at custom zoom.
  function readingPosition(): Position | undefined {
    const scroll = scroller()
    if (!scroll) return
    const v = scroll.getBoundingClientRect(), x = v.left+scroll.clientWidth*.5, y = v.top+scroll.clientHeight*.2
    const pages = target()!.querySelectorAll<HTMLElement>('.page')
    for (const page of pages) {
      const p = pageBounds(page)
      if (p.bottom >= y && p.height) return { page: Number(page.dataset.pageNumber), x: bound((x-p.x)/p.width,0,1), y: bound((y-p.y)/p.height,0,1) }
    }
  }
  function goToPosition(pos: Position) {
    const page = pageAt(pos.page), scroll = scroller()
    if (!page || !scroll) return
    const p = pageBounds(page), v = scroll.getBoundingClientRect()
    scroll.scrollBy({ left: p.x+p.width*pos.x-v.x-scroll.clientWidth*.5, top: p.y+p.height*pos.y-v.y-scroll.clientHeight*.2, behavior:'instant' })
  }
  function point(e: PointerEvent, p: DOMRect): Point {
    return { x: bound((e.clientX-p.x)/p.width,0,1), y: bound((e.clientY-p.y)/p.height,0,1) }
  }
  function dragBounds(element: HTMLElement) {
    return kind === 'pdf' ? pageBounds(element) : element.getBoundingClientRect()
  }
  function down(e: PointerEvent) {
    if (!options.editable()) return
    const el = e.target as Element
    if (el.closest('.selection-actions') || !e.isPrimary || e.button !== 0) return
    suppressClick = false
    if (!e.shiftKey) clearSelection()
    const root = target()
    selecting = !!root?.contains(el)
    const manual = boxMode.value
    const element = kind === 'pdf' ? el.closest<HTMLElement>('.page') : manual ? root : undefined
    if (!selecting || !element) return
    if (!manual && (e.pointerType === 'touch' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
        el.closest('a,button,input,textarea,select,[contenteditable=true],.textLayer span:not(.markedContent)'))) return
    e.preventDefault()
    if (manual) e.stopPropagation()
    drag = { element, id:e.pointerId, start:point(e,dragBounds(element)), manual }
  }
  function boxAt(e: PointerEvent) {
    const { element, start } = drag!
    const end = point(e,dragBounds(element))
    return { x: Math.min(start.x,end.x), y: Math.min(start.y,end.y), w: Math.abs(start.x-end.x), h: Math.abs(start.y-end.y) }
  }
  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return
    const b = boxAt(e)
    if (!drag.preview) {
      const bounds = dragBounds(drag.element)
      if (b.w*bounds.width < 4 && b.h*bounds.height < 4) return
      drag.preview = document.createElement('div')
      drag.preview.className = 'annotation-drag'
      drag.element.append(drag.preview)
      drag.element.setPointerCapture(e.pointerId)
    }
    Object.assign(drag.preview.style, { left:b.x*100+'%', top:b.y*100+'%', width:b.w*100+'%', height:b.h*100+'%' })
  }
  function cancelDrag() {
    selecting = false
    if (drag?.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id)
    drag?.preview?.remove(); drag = undefined
  }
  function up(e: PointerEvent) {
    selecting = false
    if (drag && e.pointerId === drag.id) {
      const b = boxAt(e), element = drag.element, p = dragBounds(element), manual = drag.manual
      suppressClick = manual || !!drag.preview
      cancelDrag()
      if (manual) boxMode.value = false
      if (b.w*p.width > 4 && b.h*p.height > 4) {
        if (kind === 'html') {
          const { element: source, region } = captureHtmlRegion(element,boundsFor(b,p))
          let start = 0
          for (const node of textNodes(element)) {
            if (source.contains(node) || (source.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) break
            start += node.length
          }
          options.onComment({quote:'',boxes:[],start,region})
        } else {
          const box = { ...b, page:Number(element.dataset.pageNumber) }
          if (manual) options.onComment({quote:'',boxes:[box]})
          else selectVisual({...box,content:'region'})
        }
      }
      return
    }
    if (target()?.contains(e.target as Node)) requestAnimationFrame(capture)
  }
  function selectionChanged() {
    if (selecting || drag) return
    // Moving focus into the palette can collapse the browser range. Keep the
    // captured anchor until the author applies a color or leaves the toolbar.
    if (selection.value && document.activeElement?.closest('.selection-actions')) return
    if (ownedRange()) capture()
    else if (!direct || !window.getSelection()?.isCollapsed) resetSelection()
  }
  function click(e: MouseEvent) {
    if (!target()?.contains(e.target as Node)) return
    if (suppressClick) { suppressClick=false; e.preventDefault(); e.stopPropagation(); return }
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || boxMode.value || !window.getSelection()?.isCollapsed) return
    if ((e.target as Element).closest('button')) return
    // The text layer receives pointer events, so dragging from an existing highlight still selects text.
    const area = kind === 'pdf' ? (e.target as Element).closest('.page') : document.body
    if (!area) return
    for (const mark of Array.from(area.querySelectorAll<HTMLElement>('.annotation-mark.is-filled')).reverse()) {
      const r = mark.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        e.preventDefault(); e.stopPropagation()
        options.onMark(mark.dataset.markId!,Number(mark.dataset.part)); return
      }
    }
    if (options.editable() && kind === 'pdf' && area instanceof HTMLElement) {
      const box = imageAt(e.target as Element,area,e.clientX,e.clientY)
      if (box) selectVisual(box)
    }
  }
  function keydown(e: KeyboardEvent) {
    if (!options.editable()) return
    const el = e.target instanceof Element ? e.target : null
    if (e.key === 'Tab' && !e.shiftKey && selection.value && toolPoint.value &&
        (el === document.body || el === scroller() || (el && target()?.contains(el)))) {
      const button = document.querySelector<HTMLButtonElement>('.selection-actions button')
      if (button) { e.preventDefault(); button.focus({preventScroll:true}); return }
    }
    if (e.key === 'Escape' && (boxMode.value || selection.value)) {
      if (el?.closest('.selection-actions .highlight-color-picker')) return
      e.preventDefault(); e.stopPropagation(); cancelDrag(); boxMode.value = false; clearSelection()
      return
    }
    if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.keyCode === 229 ||
        e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.repeat && consumedEnter) { e.preventDefault(); return }
    if (e.repeat || boxMode.value || selecting) return
    if (el?.closest('input,textarea,select,button,a[href],summary,[role=textbox],[role=button]') ||
        (el instanceof HTMLElement && el.isContentEditable)) return
    if (el && el !== document.body && el !== document.documentElement && el !== scroller() && !target()?.contains(el)) return
    if (!direct) {
      if (!ownedRange()) return
      capture()
    }
    if (!selection.value) return
    e.preventDefault(); e.stopPropagation(); consumedEnter = true
    options.onComment(selection.value)
  }
  function keyup(e: KeyboardEvent) {
    if (e.key === 'Enter') consumedEnter = false
  }
  function bind() {
    observer?.disconnect(); resize?.disconnect()
    const root = target()
    if (!root) return
    observer = new MutationObserver(changes => {
      if (changes.some(c => Array.from(c.removedNodes).some(n => n instanceof Element && n.matches('.notebook-marks')) ||
        Array.from(c.addedNodes).some(n => n instanceof Element && !n.closest('.notebook-marks,.annotation-drag')) || c.type === 'characterData')) rebuild()
    })
    observer.observe(root, { childList:true, subtree:true, characterData:kind==='html' })
    resize = new ResizeObserver(rebuild); resize.observe(root)
    rebuild()
  }
  watch(options.annotations, rebuild)
  watch(options.target, bind)
  watch(options.active, () => nextTick(layout))
  watch(options.showing, shown => nextTick(shown ? rebuild : layout))
  const boxClass = kind === 'html' ? 'annotation-html-box-mode' : 'annotation-box-mode'
  watch(boxMode, v => {
    target()?.classList.toggle(boxClass,v)
    if (v) clearSelection()
    else cancelDrag()
  })
  function scrollChanged(event: Event) {
    if (kind === 'html' && event.target instanceof Element && target()?.contains(event.target)) rebuild()
    else layout()
  }
  function sourceLoaded(event: Event) {
    if (event.target instanceof HTMLImageElement && target()?.contains(event.target)) rebuild()
  }
  let keyboardResizeTimer: ReturnType<typeof setTimeout> | undefined
  function monitorKeyboard(viewport: VisualViewport, signal: AbortSignal) {
    let settledHeight = viewport.height
    viewport.addEventListener('resize', () => {
      clearTimeout(keyboardResizeTimer)
      keyboardResizeTimer = setTimeout(() => {
        const heightLost = settledHeight - viewport.height
        settledHeight = viewport.height
        // Browser bars can also resize the viewport during normal reading.
        if (heightLost < 100 || viewport.scale !== 1) return
        const field = document.activeElement
        const panel = options.panel.value
        if (!options.showing() || !(field instanceof HTMLTextAreaElement) || !panel?.contains(field) || getComputedStyle(panel).containerName !== 'notebook-sheet') return
        const note = options.annotations.value.find(n => n.id === options.active.value)
        if (note) void focusSource(note, partIndex, 'if-hidden')
      }, 100)
    }, { signal })
  }
  let events: AbortController
  onMounted(() => {
    mounted=true; bind(); events=new AbortController()
    const listener = { signal:events.signal, capture:true }
    document.addEventListener('pointerdown',down,listener); document.addEventListener('pointermove',move,listener)
    document.addEventListener('pointerup',up,listener); document.addEventListener('pointercancel',cancelDrag,listener)
    document.addEventListener('selectionchange',selectionChanged,{ signal:events.signal })
    document.addEventListener('click',click,listener)
    document.addEventListener('keydown',keydown,listener)
    document.addEventListener('keyup',keyup,listener)
    window.addEventListener('scroll',scrollChanged,listener); window.addEventListener('resize',rebuild,{ signal:events.signal })
    if (kind === 'html') document.addEventListener('load',sourceLoaded,listener)
    if (window.visualViewport) monitorKeyboard(window.visualViewport, events.signal)
    document.fonts.ready.then(rebuild)
  })
  onBeforeUnmount(() => {
    mounted=false; events?.abort(); observer?.disconnect(); resize?.disconnect(); cardResize?.disconnect()
    clearTimeout(keyboardResizeTimer)
    cancelAnimationFrame(geometryFrame); cancelAnimationFrame(layoutFrame); cancelDrag()
    target()?.classList.remove(boxClass)
    target()?.querySelectorAll('.notebook-marks').forEach(el => el.remove())
  })
  return { marks, missing, selection, visualRects, toolPoint, clearSelection, boxMode, connector, sourceImages, layout, pageRendered, focusSource, readingPosition, goToPosition }
}
