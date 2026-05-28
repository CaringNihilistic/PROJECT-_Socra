import { PitchDeck, PitchSlide, AgentReport } from '../store/sessionStore'

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

function SlideCard({ slide, index, total }: { slide: PitchSlide; index: number; total: number }) {
  const accent = SLIDE_ACCENTS[slide.id] ?? { border: 'rgba(255,255,255,0.1)', dot: '#fff', label: String(index + 1).padStart(2, '0') }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: accent.border, background: 'rgba(255,255,255,0.015)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: accent.border, background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent.dot }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: accent.dot, opacity: 0.8 }}>
            {slide.title}
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/20">{accent.label} / {String(total).padStart(2, '0')}</span>
      </div>
      <div className="px-6 py-5">
        <p className="text-[18px] font-semibold leading-snug mb-4" style={{ color: accent.dot }}>
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

function DevilSlideCard({ report, index, total }: { report: AgentReport; index: number; total: number }) {
  const label = String(index + 1).padStart(2, '0')
  // Parse numbered list items from the content
  const lines = report.content.split('\n').filter(l => l.trim())

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.03)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: '0 0 6px #ef4444' }} />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-red-400/80">
            💀 Devil's Advocate
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/20">{label} / {String(total).padStart(2, '0')}</span>
      </div>
      <div className="px-6 py-5">
        <p className="text-[15px] font-semibold text-red-400 mb-4 leading-snug">
          5 reasons this plan fails
        </p>
        <ul className="flex flex-col gap-2.5">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-red-500/40" />
              <span className="text-[13px] text-white/55 leading-relaxed">{line.replace(/^\d+\.\s*/, '')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface Props {
  deck: PitchDeck


  devilReport?: AgentReport | null
}

export function PitchDeckView({ deck, devilReport }: Props) {
  const total = deck.slides.length + (devilReport ? 1 : 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/40">Pitch Deck</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
      <div className="flex flex-col gap-3">
        {deck.slides.map((slide, i) => (
          <SlideCard key={slide.id} slide={slide} index={i} total={total} />
        ))}
        {devilReport && (
          <DevilSlideCard report={devilReport} index={deck.slides.length} total={total} />
        )}
      </div>
    </div>
  )
}
