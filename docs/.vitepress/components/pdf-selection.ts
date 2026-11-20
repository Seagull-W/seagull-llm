import type { Anchor, Box } from './annotations'

const imageSelector = '.textLayerImagePlaceholder'

export function pageBounds(page: HTMLElement) {
  const r = page.getBoundingClientRect()
  return new DOMRect(r.left + page.clientLeft, r.top + page.clientTop, page.clientWidth, page.clientHeight)
}

function toBox(page: number, p: DOMRect, r: DOMRect): Box | undefined {
  const x = Math.max(r.left,p.left), y = Math.max(r.top,p.top)
  const w = Math.min(r.right,p.right)-x, h = Math.min(r.bottom,p.bottom)-y
  if (w <= 0 || h <= 0) return
  return { page, x:(x-p.x)/p.width, y:(y-p.y)/p.height, w:w/p.width, h:h/p.height }
}

export function imageAt(target: Element, page: HTMLElement, x: number, y: number) {
  // Prefer overlaid PDF text or links to the image underneath them (e.g. an OCR page).
  if (target.closest('.textLayer span:not(.markedContent),a,button,input')) return
  const image = target.closest(imageSelector) ?? Array.from(page.querySelectorAll(imageSelector)).findLast(el => {
    const r = el.getBoundingClientRect()
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom
  })
  if (!image) return
  const b = toBox(Number(page.dataset.pageNumber),pageBounds(page),image.getBoundingClientRect())
  if (b) return { ...b, content:'image' as const }
}

function textRun(node: Node) {
  const el = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  return !!el?.closest('.textLayer span:not(.markedContent)')
}

export function pdfSelection(range: Range, root: HTMLElement, quote: string): Anchor | undefined {
  const text: Box[] = [], images: { el:Element; box:Box }[] = [], seen = new Set<string>()
  for (const layer of root.querySelectorAll<HTMLElement>('.textLayer')) {
    if (!range.intersectsNode(layer)) continue
    const page = layer.closest<HTMLElement>('.page')!
    const number = Number(page.dataset.pageNumber), p = pageBounds(page)
    const runs = document.createTreeWalker(layer,NodeFilter.SHOW_TEXT)
    for (let node=runs.nextNode(); node; node=runs.nextNode()) {
      if (!range.intersectsNode(node)) continue
      const part = document.createRange()
      part.selectNodeContents(node)
      if (node === range.startContainer) part.setStart(node,range.startOffset)
      if (node === range.endContainer) part.setEnd(node,range.endOffset)
      if (part.collapsed) continue
      for (const r of part.getClientRects()) {
        const b = toBox(number,p,r)
        if (!b) continue
        const key = [number, r.x, r.y, r.width, r.height].map(v => Math.round(v*10)).join('/')
        if (seen.has(key)) continue
        seen.add(key); text.push(b)
        if (text.length > 1000) return {quote,boxes:text}
      }
    }
    for (const el of layer.querySelectorAll(imageSelector)) {
      const b = toBox(number,p,el.getBoundingClientRect())
      if (b) images.push({el,box:{...b,content:'image'}})
    }
  }
  // PDF.js places image placeholders before the text runs in the DOM. Between two
  // text endpoints, use the page layout so the image travels with its caption.
  const first = text[0], last = text.at(-1)
  const betweenText = first && last && textRun(range.startContainer) && textRun(range.endContainer)
  const graphics = images.filter(({el,box}) => {
    if (!betweenText) return range.intersectsNode(el)
    if (box.page > first.page && box.page < last.page) return true
    if (box.page === first.page && box.y < first.y+first.h-.001) return false
    if (box.page === last.page && box.y+box.h > last.y+.001) return false
    // In a multi-column paper, a figure in the adjacent column is outside this passage.
    return text.some(t => t.page === box.page && t.x < box.x+box.w && t.x+t.w > box.x)
  }).map(i => i.box)
  const boxes = quote ? text : []
  for (const image of graphics) {
    const after = boxes.findIndex(b => b.page > image.page ||
      (b.page === image.page && b.y >= image.y+image.h-.001 && b.x < image.x+image.w && b.x+b.w > image.x))
    if (after === -1) boxes.push(image)
    else boxes.splice(after,0,image)
  }
  if (boxes.length) return { quote:text.length ? quote : '', boxes }
}

export function cropPdfBox(page: HTMLElement, box: Box, maxWidth: number, maxHeight: number) {
  const canvas = page.querySelector<HTMLCanvasElement>('.canvasWrapper canvas')
  if (!canvas?.width || !canvas.height) return
  const p = pageBounds(page), c = canvas.getBoundingClientRect()
  if (!c.width || !c.height) return
  const x = Math.max(0,(p.x+box.x*p.width-c.x)*canvas.width/c.width)
  const y = Math.max(0,(p.y+box.y*p.height-c.y)*canvas.height/c.height)
  const w = Math.min(box.w*p.width*canvas.width/c.width,canvas.width-x)
  const h = Math.min(box.h*p.height*canvas.height/c.height,canvas.height-y)
  if (w <= 0 || h <= 0) return
  const image = document.createElement('canvas'), scale = Math.min(1,maxWidth/w,maxHeight/h)
  image.width = Math.max(1,Math.round(w*scale)); image.height = Math.max(1,Math.round(h*scale))
  image.getContext('2d')!.drawImage(canvas,x,y,w,h,0,0,image.width,image.height)
  return image
}
