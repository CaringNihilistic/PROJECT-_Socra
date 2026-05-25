import { PitchDeck, PitchSlide } from '../store/sessionStore'

const SLIDE_ACCENTS: Record<string, { border: string; dot: string; label: string }> = {
  problem:        { border: 'rgba(239,68,68,0.2)',   dot: '#ef4444', label: '01' },
  solution:       { border: 'rgba(52,211,153,0.2)',  dot: '#34d399', label: '02' },
  market:         { border: 'rgba(85,144,232,0.2)',  dot: '#5590e8', label: '03' },
  product:        { border: 'rgba(34,211,238,0.2)',  dot: '#22d3ee', label: '04' },
  business_model: { border: 'rgba(245,158,11,0.2)',  dot: '#f59e0b', label: '05' },
  gtm:            { border: 'rgba(168,85,247,0.2)',  dot: '#a855f7', label: '06' },
  competition:    { border: 'rgba(245,158,11,0.2)',  dot: '#f59e0b', label: '07' },
  roadmap:        { border: 'rgba(52,211,153,0.2)',  dot: '#34d399', label: '08' },
  ask:            { border: 'rgba(239,68,68,0.2)',   dot: '#ef4444', label: '09' },
}

function SlideCard({ slide, index }: { slide: PitchSlide; index: number }) {
  const accent = SLIDE_ACCENTS[slide.id] ?? { border: 'rgba(255,255,255,0.1)', dot: '#fff', label: String(index + 1).padStart(2, '0') }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: accent.border, background: 'rgba(255,255,255,0.015)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: accent.border, background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent.dot }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: accent.dot, opacity: 0.8 }}>
            {slide.title}
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/20">{accent.label} / 09</span>
      </div>

      <div className="px-6 py-5">
        <p className="text-[18px] font-semibold text-white/90 leading-snug mb-4" style={{ color: accent.dot }}>
          {slide.headline}
        </p>
        <ul className="flex flex-col gap-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: accent.dot, opacity: 0.5 }} />
              <span className="text-[13px] text-white/60 leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function buildExportHtml(deck: PitchDeck, idea: string): string {
  const slidesHtml = deck.slides.map((slide, i) => {
    const accent = SLIDE_ACCENTS[slide.id]
    const color = accent?.dot ?? '#fff'
    const num = String(i + 1).padStart(2, '0')
    const bullets = slide.bullets.map(b => `<li>${b}</li>`).join('')
    return `
      <section class="slide">
        <div class="slide-header">
          <span class="slide-title" style="color:${color}">${slide.title}</span>
          <span class="slide-num">${num} / 09</span>
        </div>
        <p class="headline" style="color:${color}">${slide.headline}</p>
        <ul>${bullets}</ul>
      </section>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pitch Deck — ${idea.slice(0, 50)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #e5e5e5; font-family: 'Inter', system-ui, sans-serif; padding: 40px 20px; }
  h1 { font-size: 14px; font-family: monospace; color: #555; text-transform: uppercase; letter-spacing: .15em; margin-bottom: 40px; }
  .slide { border: 1px solid #222; border-radius: 16px; margin-bottom: 24px; overflow: hidden; }
  .slide-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid #222; background: #111; }
  .slide-title { font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: .15em; }
  .slide-num { font-size: 10px; font-family: monospace; color: #444; }
  .headline { font-size: 20px; font-weight: 600; padding: 20px 20px 12px; line-height: 1.3; }
  ul { list-style: none; padding: 0 20px 20px; display: flex; flex-direction: column; gap: 8px; }
  li { font-size: 13px; color: #888; line-height: 1.6; padding-left: 16px; position: relative; }
  li::before { content: '·'; position: absolute; left: 0; color: #555; }
  @media print { body { background: white; color: black; } .slide { border-color: #ddd; } }
</style>
</head>
<body>
<h1>Pitch Deck — ${idea.slice(0, 80)}</h1>
${slidesHtml}
</body>
</html>`
}

interface Props {
  deck: PitchDeck
  idea: string
}

export function PitchDeckView({ deck, idea }: Props) {
  const handleExport = () => {
    const html = buildExportHtml(deck, idea)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const slug = idea.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    a.href = url; a.download = `pitch-deck-${slug}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">
            Pitch Deck
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <button
          onClick={handleExport}
          className="text-[11px] font-mono text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-3 py-1 rounded-lg transition-all ml-4"
        >
          ↓ Export HTML
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {deck.slides.map((slide, i) => (
          <SlideCard key={slide.id} slide={slide} index={i} />
        ))}
      </div>
    </div>
  )
}
