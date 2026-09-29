/**
 * Dev-only review page for the pixel kit, served at /__pixel when running `npm run dev`.
 * Routed in App.tsx behind import.meta.env.DEV, so it is not part of production builds.
 */
import { Sprite, type SpriteSize } from './Sprite'
import { SPRITE_NAMES } from './sprites'
import { COUNCIL, PROFESSOR, STAGES, TEAM_GLITCH, TRAINERS } from './cast'
import { PixelPanel } from './ui/PixelPanel'
import { DialogBox } from './ui/DialogBox'
import { XpBar } from './ui/XpBar'
import { StatBar } from './ui/StatBar'
import { TypeBadge } from './ui/TypeBadge'
import { PixelButton } from './ui/PixelButton'
import { MenuChoice } from './ui/MenuChoice'

const SIZES: SpriteSize[] = [64, 96, 128]

export function PixelPreview() {
  return (
    <main className="min-h-screen bg-px-night text-px-screen font-term text-[22px] p-10 flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <p className="font-term text-[24px] text-px-muted">DEV ONLY · /__pixel</p>
        <h1 className="font-pixel text-2xl leading-relaxed text-px-xp">Pixel kit preview</h1>
        <p className="text-px-soft max-w-2xl">
          Every sprite at each allowed size, and every kit component. Not routed in production.
        </p>
      </header>

      <PixelPanel title="SPRITES AT 64 / 96 / 128">
        <div className="grid grid-cols-4 gap-8">
          {SPRITE_NAMES.map((name) => (
            <div key={name} className="flex flex-col gap-2">
              <div className="flex items-end gap-3 bg-px-screen border-4 border-px-ink p-3">
                {SIZES.map((size) => (
                  <Sprite key={size} name={name} size={size} />
                ))}
              </div>
              <p className="font-term text-[20px] text-px-muted">{name}</p>
            </div>
          ))}
        </div>
      </PixelPanel>

      <PixelPanel title="THE COUNCIL">
        <div className="grid grid-cols-5 gap-6">
          {Object.entries(COUNCIL).map(([key, c]) => (
            <div key={key} className="flex flex-col gap-3">
              <div className="flex justify-center bg-px-screen border-4 border-px-ink py-4">
                <Sprite name={c.sprite} size={128} bob />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-[12px]">{c.name.toUpperCase()}</span>
                <TypeBadge type={c.type} />
              </div>
              <p className="font-term text-[22px] text-px-xp">{c.advisor} · {key}</p>
              <p className="text-px-soft">“{c.line}”</p>
            </div>
          ))}
        </div>
      </PixelPanel>

      <div className="grid grid-cols-2 gap-8">
        <PixelPanel title="TEAM GLITCH" accent="glitch">
          <p className="font-term text-[24px] mb-4">“{TEAM_GLITCH.motto}”</p>
          <div className="flex gap-6">
            {TEAM_GLITCH.members.map((m) => (
              <div key={m.name} className="flex flex-col items-center gap-2">
                <Sprite name={m.sprite} size={96} label={m.name} />
                <span className="font-pixel text-[11px]">{m.name.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </PixelPanel>
        <PixelPanel title="THE TRAINERS" accent="plan">
          <div className="flex gap-6">
            {Object.values(TRAINERS).map((t) => (
              <div key={t.name} className="flex flex-col items-center gap-2">
                <Sprite name={t.sprite} size={96} label={t.name} />
                <span className="font-pixel text-[11px]">{t.name.toUpperCase()}</span>
                <span className="text-px-soft text-[20px] text-center">{t.line}</span>
              </div>
            ))}
          </div>
        </PixelPanel>
      </div>

      <PixelPanel title="EVOLUTION + XP">
        <div className="flex flex-col gap-6">
          {[0.12, 0.52, 0.64, 0.75, 0.9].map((score) => (
            <XpBar key={score} score={score} />
          ))}
          <div className="flex gap-6">
            {STAGES.map((s) => (
              <div key={s.phase} className="flex flex-col items-center gap-2">
                <Sprite name={s.sprite} size={96} />
                <span className="font-term text-[20px] text-px-muted">{s.name} · {s.threshold * 100}%</span>
              </div>
            ))}
          </div>
        </div>
      </PixelPanel>

      <div className="grid grid-cols-[1fr_1.4fr] gap-8 items-start">
        <PixelPanel title="STATS">
          <div className="flex flex-col gap-2.5">
            <StatBar label="PROBLEM" value={0.8} />
            <StatBar label="SCALE" value={0.6} />
            <StatBar label="TECH" value={0.7} />
            <StatBar label="SUCCESS" value={0.45} />
            <StatBar label="RISK" value={0.55} />
          </div>
        </PixelPanel>
        <div className="flex flex-col gap-6">
          <DialogBox speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite} more>
            Before I hand you a masterplan… who exactly pays for this, and what do they use today?
          </DialogBox>
          <div className="pixel-panel p-4 grid grid-cols-2 gap-3.5">
            <MenuChoice>Students pay $4/month</MenuChoice>
            <MenuChoice>Universities license it</MenuChoice>
            <MenuChoice>Free for students, paid by colleges</MenuChoice>
            <MenuChoice disabled>Disabled option</MenuChoice>
          </div>
          <div className="flex gap-4 items-center">
            <PixelButton>ANSWER</PixelButton>
            <PixelButton variant="secondary">RUN</PixelButton>
            <PixelButton disabled>DISABLED</PixelButton>
          </div>
        </div>
      </div>

      <PixelPanel title="MARKDOWN · prose-pixel">
        <div className="prose prose-pixel max-w-none">
          <h1>Chairman’s Verdict</h1>
          <p>Long-form text is VT323 at 22px. Headings get the pixel face; <strong>bold</strong> and <a href="#top">links</a> use the kit colours.</p>
          <h2>Risk Register</h2>
          <ul>
            <li>FERPA exposure on synced deadline data</li>
            <li>Canvas API rate limits at 10× scale</li>
          </ul>
          <table>
            <thead><tr><th>Layer</th><th>Tool</th></tr></thead>
            <tbody><tr><td>Database</td><td>Postgres</td></tr></tbody>
          </table>
        </div>
      </PixelPanel>
    </main>
  )
}
