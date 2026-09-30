import { Sprite } from '../../pixel/Sprite'
import { STAGE_MEANING, type Evolution } from '../../chat/turns'

interface EvolutionStageProps {
  evolution: Evolution
  /** false: the old form flickers over the new one; true: the new form and "Congratulations!". */
  evolved: boolean
  /** Skip the white flash (reduced motion, or an embedded demo that plays it itself). */
  flash?: boolean
}

/** The visual core of an evolution: sprites and the two dialog lines. Used by the scene and the landing demo. */
export function EvolutionStage({ evolution: { from, to }, evolved, flash = true }: EvolutionStageProps) {
  return (
    <div className="relative flex w-full flex-col items-center gap-8">
      {evolved && flash && <div className="pixel-flash-white pointer-events-none fixed inset-0" aria-hidden="true" />}
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
      <div className="pixel-dialog w-full px-5 py-4 text-[22px] leading-snug text-px-ink sm:text-[26px]">
        {evolved ? (
          <>
            <p>Congratulations! Your idea evolved into {to.name.toUpperCase()}!</p>
            <p className="mt-2 text-[22px]">{STAGE_MEANING[to.phase]}</p>
          </>
        ) : (
          <p>What? {from.name.toUpperCase()} is evolving!</p>
        )}
      </div>
    </div>
  )
}
