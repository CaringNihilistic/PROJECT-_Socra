import { toPng } from 'html-to-image'

// The card's fonts, with the same size-adjust as the @font-face rules in index.css
const FACES = [
  { family: 'Socra Text', file: '/fonts/atkinson-400.woff2', weight: '400', adjust: '78%' },
  { family: 'Socra Text', file: '/fonts/atkinson-700.woff2', weight: '700', adjust: '78%' },
  { family: 'Socra Title', file: '/fonts/jersey15.woff2', weight: '400', adjust: '180%' },
]

let fontCss: Promise<string> | null = null

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/** The fonts as @font-face rules with the files inlined, so the PNG never falls back to a system font. */
function embeddedFonts(): Promise<string> {
  fontCss ??= Promise.all(
    FACES.map(async (f) => {
      const res = await fetch(f.file)
      if (!res.ok) throw new Error(`Font ${f.file}: ${res.status}`)
      const data = await toDataUrl(await res.blob())
      return `@font-face{font-family:'${f.family}';src:url(${data}) format('woff2');font-weight:${f.weight};size-adjust:${f.adjust};}`
    }),
  )
    .then((rules) => rules.join(' '))
    .catch((err) => {
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
