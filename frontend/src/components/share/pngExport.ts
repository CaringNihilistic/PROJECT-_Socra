import { toPng } from 'html-to-image'

// Only the pixel fonts: the card uses nothing else
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap'
const KEEP_SUBSETS = new Set(['latin', 'latin-ext'])

let fontCss: Promise<string> | null = null

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/**
 * The pixel fonts as @font-face rules with the font files inlined. html-to-image can't
 * embed them itself: the Google Fonts stylesheet is cross-origin, so its cssRules are
 * unreadable from the page.
 */
function embeddedFonts(): Promise<string> {
  fontCss ??= (async () => {
    const css = await (await fetch(FONTS_CSS)).text()
    // Google serves one block per unicode subset, each preceded by /* subset */
    const blocks = css.split(/(?=\/\* [\w-]+ \*\/)/).filter((b) => KEEP_SUBSETS.has(b.match(/\/\* ([\w-]+) \*\//)?.[1] ?? ''))
    let out = blocks.join('\n')
    for (const url of new Set(out.match(/https:\/\/fonts\.gstatic\.com[^)\s]+/g) ?? [])) {
      out = out.split(url).join(await toDataUrl(await (await fetch(url)).blob()))
    }
    return out
  })().catch((err) => {
    fontCss = null // let the next click try again
    throw err
  })
  return fontCss
}

/** Render a node to a 2× PNG and download it. */
export async function downloadPng(node: HTMLElement, filename: string): Promise<void> {
  await document.fonts?.ready
  const url = await toPng(node, { pixelRatio: 2, fontEmbedCSS: await embeddedFonts() })
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}
