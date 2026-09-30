import { useCallback, useEffect, useRef, useState } from 'react'
import { Sprite } from '../../pixel/Sprite'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { useModalKeys } from '../../pixel/useModalKeys'
import { STAGE_MEANING, type Evolution } from '../../chat/turns'

/** Matches the pixel-evolve animation in index.css. */
export const EVOLVE_MS = 2400

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface EvolutionSceneProps {
  evolution: Evolution
  onClose: () => void
  /** Defaults to the user's OS setting; tests pass it explicitly. */
  reducedMotion?: boolean
}

/** "What? IDEA EGG is evolving!" A full-screen moment when a turn crosses a phase threshold. */
export function EvolutionScene({ evolution, onClose, reducedMotion = prefersReducedMotion() }: EvolutionSceneProps) {
  const { from, to } = evolution
  const [evolved, setEvolved] = useState(reducedMotion)

  useEffect(() => {
    if (evolved) return
    const t = setTimeout(() => setEvolved(true), EVOLVE_MS)
    return () => clearTimeout(t)
  }, [evolved])

  const ref = useRef<HTMLDivElement>(null)
  // Esc skips the animation, then closes
  const onEscape = useCallback(() => (evolved ? onClose() : setEvolved(true)), [evolved, onClose])
  useModalKeys(ref, onEscape)

  const fromName = from.name.toUpperCase()
  const toName = to.name.toUpperCase()

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evolution-title"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-px-night px-4 py-8 font-term text-[22px] text-px-screen"
    >
      {evolved && !reducedMotion && <div className="pixel-flash-white pointer-events-none fixed inset-0" aria-hidden="true" />}
      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        <h2 id="evolution-title" className="font-pixel text-xs leading-relaxed text-px-xp">EVOLUTION</h2>

        {evolved ? (
          <Sprite name={to.sprite} size={128} bob label={to.name} />
        ) : (
          // The silhouette filter goes on each sprite: on the wrapper it would whiten the backing too
          <div className="relative h-32 w-32" aria-hidden="true">
            <Sprite name={to.sprite} size={128} className="pixel-silhouette absolute inset-0" />
            <div className="pixel-evolve-old absolute inset-0 bg-px-night">
              <Sprite name={from.sprite} size={128} className="pixel-silhouette" />
            </div>
          </div>
        )}

        <div className="pixel-dialog w-full px-5 py-4 text-[26px] leading-snug text-px-ink">
          {evolved ? (
            <>
              <p>Congratulations! Your idea evolved into {toName}!</p>
              <p className="mt-2 text-[22px]">{STAGE_MEANING[to.phase]}</p>
            </>
          ) : (
            <p>What? {fromName} is evolving!</p>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {evolved ? `Your idea evolved into ${to.name}. ${STAGE_MEANING[to.phase]}` : `${from.name} is evolving.`}
        </p>

        {evolved ? (
          <PixelButton autoFocus onClick={onClose}>CONTINUE ▶</PixelButton>
        ) : (
          <PixelButton autoFocus variant="secondary" onClick={() => setEvolved(true)}>SKIP ▶▶</PixelButton>
        )}
      </div>
    </div>
  )
}
