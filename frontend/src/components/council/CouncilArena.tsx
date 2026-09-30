import { COUNCIL } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { PixelPanel } from '../../pixel/ui/PixelPanel'
import { TypeBadge } from '../../pixel/ui/TypeBadge'
import type { AgentReport } from '../../episode/events'
import type { Seat } from '../../episode/reducer'

function SeatView({ seat }: { seat: Seat }) {
  const creature = COUNCIL[seat.key]
  const fainted = seat.status === 'fainted'
  return (
    // Phones: sprite and name in a row, the signature full width below (in a column it wraps a word per line)
    <li className={`flex flex-col gap-2 sm:items-center sm:text-center ${fainted ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
        <div className={`shrink-0 border-4 border-px-ink bg-px-screen p-1 sm:p-2 ${seat.status === 'done' ? 'pixel-attack' : ''} ${fainted ? 'grayscale' : ''}`}>
          <Sprite name={creature.sprite} size={64} bob={seat.status === 'thinking'} className="sm:hidden" />
          <Sprite name={creature.sprite} size={96} bob={seat.status === 'thinking'} className="hidden sm:block" />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-center">
          <span className="font-pixel text-[10px] leading-relaxed">{creature.name.toUpperCase()}</span>
          <TypeBadge type={creature.type} />
        </div>
      </div>
      {seat.status === 'thinking' && (
        <span className="text-[20px] text-px-muted">
          thinking<span className="pixel-blink">…</span>
        </span>
      )}
      {seat.status === 'done' && seat.signature && (
        <p className="border-2 border-px-ink bg-px-screen px-2 py-1 text-[20px] leading-tight text-px-ink">“{seat.signature}”</p>
      )}
      {fainted && <p className="text-[20px] text-px-glitch-text">{creature.name} fainted!</p>}
    </li>
  )
}

/** A report whose agent key the frontend doesn't know: never shown as the wrong creature. */
function NeutralSeat({ report }: { report: AgentReport }) {
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-[112px] w-[112px] items-center justify-center border-4 border-px-ink bg-px-screen font-pixel text-2xl text-px-ink">?</div>
      <span className="font-pixel text-[10px] leading-relaxed">{report.title.toUpperCase()}</span>
    </li>
  )
}

export function CouncilArena({ seats, extras }: { seats: Seat[]; extras: AgentReport[] }) {
  return (
    <PixelPanel title="THE COUNCIL">
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
        {seats.map((seat) => (
          <SeatView key={seat.key} seat={seat} />
        ))}
        {extras.map((report) => (
          <NeutralSeat key={report.key} report={report} />
        ))}
      </ul>
    </PixelPanel>
  )
}
