export function formatTex(source: string, block: boolean, delimited: boolean): string {
  const tex = source.replace(/\r\n?/g, '\n').trim()
  if (!tex || !delimited) return tex
  return block ? `$$\n${tex}\n$$` : `$${tex}$`
}

export async function copyTex(text: string, allowed: () => boolean): Promise<boolean> {
  if (!text || !allowed()) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // The reader may have started selecting text while clipboard permission was pending.
    if (!allowed()) return false
  }

  // Supply the payload in the native copy event, keeping document focus and selection intact.
  let written = false
  function onCopy(event: ClipboardEvent) {
    if (!event.clipboardData) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', text)
    written = true
  }
  document.addEventListener('copy', onCopy)
  try {
    return document.execCommand('copy') && written
  } catch {
    return false
  } finally {
    document.removeEventListener('copy', onCopy)
  }
}
