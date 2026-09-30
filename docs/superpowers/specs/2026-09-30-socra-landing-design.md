# Socra pixel redesign, sub-project 4: Landing page

Status: approved design (user picked every recommended option on 2026-09-30); spec self-reviewed per the user's standing instruction.

Builds on the [foundation](2026-09-30-socra-pixel-foundation-design.md), [council episode](2026-09-30-socra-council-episode-design.md) and [interrogation](2026-09-30-socra-interrogation-design.md) specs. Frontend-only.

## 1. Decisions

| Question | Decision |
|---|---|
| Hero | **Game title screen.** Big pixel SOCRA logo, the headline, Prof. Socra with his line, and the idea box framed as the start of the game (`NAME YOUR IDEA` → `PRESS START ▶`). Examples and recent sessions sit below it as menus. |
| Demo | **The whole journey**, one auto-playing loop of ~23s built from the real components: Socra asks, an answer is picked, the egg evolves, the council reports, a trainer presents the plan, then "Your turn". Pause, replay and scene jumps. |
| Sections | **Tight game manual**: hero, WATCH A RUN, HOW IT PLAYS, MEET THE CAST, "every AI tool says yes", FREE TO PLAY, GET UPDATES, footer. The ticker and the 7 feature cards are dropped; their content moves into the steps and the cast. |
| Waitlist | **Becomes "Get updates"**: same form and `POST /waitlist`, honest wording (no "early access"). |

## 2. Page, top to bottom

Everything is `px-night` with the pixel kit; VT323 for text, Press Start 2P for titles and names.

1. **Nav** (sticky): `SOCRA` logo, links `HOW IT PLAYS` / `CAST` / `FREE` (hidden below `md`), the Clerk sign-in button when Clerk is enabled, and `START ▶` (scrolls to and focuses the idea box).
2. **Title screen** (`id="start"`, centred, `max-w-3xl`):
   - `SOCRA` in Press Start 2P, 32px on phones and 48px from `sm`, `px-xp`, with a pixel drop shadow.
   - Headline (VT323, 36px on phones, 48px from `sm`): "We kill **bad ideas** before they kill you." ("bad ideas" in `px-xp`).
   - Subline: "ChatGPT tells you how to build it. Socra tells you if you should."
   - `DialogBox` with Prof. Socra: "No masterplan until I understand you. Tell me your idea."
   - **NAME YOUR IDEA** panel: a textarea (placeholder "I want to build a platform where…"), and `PRESS START ▶` (primary). Enter starts, Shift+Enter adds a line. While creating: `LOADING…`, button disabled. `sessionError` shows below in `px-glitch-text`.
   - **TRY AN EXAMPLE**: the 3 existing examples (unchanged strings: they are the only ideas STUB_MODE answers) as `MenuChoice`s; picking one fills the box and focuses it.
   - **CONTINUE** (only with `sessionHistory`): up to 6 save-file rows. Each shows the idea (truncated), the stage name (`stageForPhase`, or `FINAL FORM` when `has_masterplan`), the score %, and `✓ PLAN` when a masterplan exists. Clicking resumes. Rows with a masterplan have a `↔` compare button with today's flow (select one, then another opens `/compare/a/b`; `?compare=` pre-selects; click again to deselect). The banner "↔ PICK ANOTHER TO COMPARE" shows while one is selected. The sync nudge (signed out + Clerk) is restyled as a one-line link.
3. **WATCH A RUN** (`id="demo"`): the journey demo (§3).
4. **HOW IT PLAYS** (`id="how"`): three numbered panels, each with sprites:
   1. **INTERROGATION** (Socra and the egg): Socra questions you until he understands the idea; your idea gains XP across 5 stats and evolves; every assumption he hears becomes a field note you can mark ✓ or ✗.
   2. **THE COUNCIL** (the five creatures): five advisors research the market live on the web and each look for a different reason the idea fails.
   3. **THE MASTERPLAN** (the three trainers, and Team Glitch): the trainers present the Chairman's plan (verdict, phases, tech stack, first files, risks); Team Glitch gives 5 reasons it fails. Export as .md, share a link or a score card, or compare two ideas.
5. **MEET THE CAST** (`id="cast"`): cards built from `cast.ts`: Prof. Socra; the five council creatures (sprite, name, type badge, advisor, their line); Team Glitch (three sprites, motto); the trainers (sprite, role, line). No hard-coded copies of cast data.
6. **EVERY AI TOOL SAYS YES. SOCRA SAYS NO.**: today's two lists, as a `glitch`-accent panel ("EVERY OTHER TOOL") and a `plan`-accent panel ("SOCRA").
7. **FREE TO PLAY** (`id="free"`): one panel. Everything is free, with no account needed to start. The full analysis runs when your score is ready. An optional ₹499 donation (via Razorpay: UPI, cards, net banking) covers LLM costs. `PRESS START ▶` returns to the idea box.
8. **GET UPDATES** (`id="updates"`): "Get an email when new features land." Email input and `NOTIFY ME ▶` post to `/waitlist` as today. Success: "You’re on the list. We’ll email you when something new lands." Errors as today. "No spam. Unsubscribe any time."
9. **Footer**: "© 2026 Socra · Built in India 🇮🇳". Today's `#` placeholder links (Twitter, LinkedIn, GitHub, Privacy) go nowhere and are removed.

## 3. Journey demo

A pure timeline plus a player.

**`src/landing/journey.ts`**: `JOURNEY_MS` (23000) and `journeyFrame(t)`, which returns what to render at time `t` (ms, 0 ≤ t < `JOURNEY_MS`):

| Time (s) | Scene | Frame |
|---|---|---|
| 0–3.5 | `ask` | Egg at 25% XP; Socra's question; 3 choices; the ▶ cursor sits on choice 0, then moves to 1 at 1.4s and to 2 at 2.4s (shown by highlighting that option). |
| 3.5–5 | `answer` | The picked choice as a `YOU` panel; Socra "…" (waiting). |
| 5–8.5 | `evolve` | XP at 42%; the embedded evolution (§3.1): evolving until 7.4s, then evolved. |
| 8.5–15 | `council` | `CouncilArena` with seats from the episode reducer; reports land at 9.3, 10.3, 11.3, 12.3 and 13.3s. |
| 15–20 | `plan` | `PlanRelay`, streaming the Verdict section of the fixture plan at a steady rate. |
| 20–23 | `end` | "Your turn." with `PRESS START ▶`. |

The content is **excerpts of real recordings**. The question is point 2 of the recorded first question ("**Who is your user?** Solo designers working solo, or are we talking design studios with 5-50 people?"). The choices are the first three recorded `choices` for that question, and the pick is choice 0, "Solo designers, we just forget to follow up ourselves". The demo idea shown is the recorded idea. The council reports and plan come from `episode/__fixtures__/sampleSession.json`. Excerpts keep each scene short so the panel doesn't jump in height. `journeyFrame` is pure: episode states come from `episodeReducer` over the events due by `t`.

**`components/landing/JourneyDemo.tsx`**:
- A `PixelPanel` with a scene strip `1 ASK · 2 EVOLVE · 3 COUNCIL · 4 PLAN` (buttons that jump to each scene's start).
- `PAUSE`/`PLAY` and `REPLAY` controls.
- A fixed `min-h` stage so scene changes don't move the page.
- The clock ticks on `requestAnimationFrame`, and only runs while the panel is on screen (`IntersectionObserver`) and the tab is visible.
- It loops.
- Under reduced motion it does not autoplay: it starts paused on scene 1, and the strip and PLAY step through it.
- The stage is `aria-hidden` apart from one `aria-live` line per scene (e.g. "Scene 3: the council reports."). The controls stay accessible.
- Nothing in the demo is interactive except the controls and the final `PRESS START ▶`.

### 3.1 Evolution core

`EvolutionScene`'s visual core (the flickering sprites, the dialog lines and the meaning) moves to `EvolutionStage({ evolution, evolved })`. `EvolutionScene` keeps the modal, timer, keys and buttons around it; the demo embeds `EvolutionStage` with `evolved` driven by the timeline.

## 4. Code layout

| File | Contents |
|---|---|
| `src/landing/journey.ts`, `__tests__/journey.test.ts` | Timeline and frames (pure). |
| `src/components/landing/TitleScreen.tsx` | Title, Socra, NAME YOUR IDEA, examples. |
| `src/components/landing/ContinueMenu.tsx` | Recent sessions + compare. |
| `src/components/landing/JourneyDemo.tsx` | The demo player. |
| `src/components/landing/HowItPlays.tsx`, `CastRoster.tsx`, `SaysNo.tsx`, `FreeToPlay.tsx`, `GetUpdates.tsx` | The sections. |
| `src/components/landing/__tests__/landing.test.tsx` | Render tests. |
| `src/components/LandingPage.tsx` | Nav + composition; state and store calls stay here. |
| `src/components/chat/EvolutionStage.tsx` | §3.1. |

Removed: `LiveDemo`, the ticker markup and its `ticker` CSS if nothing else uses it, `PHASE_COLORS`, `SectionHeading`.

## 5. Testing

- `journey.test.ts`: a frame at each scene's start and end; the cursor moves; the reports land in order; the plan grows monotonically; `end` at 20s; times wrap at `JOURNEY_MS`.
- `landing.test.tsx`: the title screen has the headline, NAME YOUR IDEA, PRESS START and the three exact example strings. CONTINUE lists recent sessions with stage names, a compare button only on sessions with a plan, and the compare banner when pre-selected. The cast renders every council creature from `cast.ts`. GET UPDATES has no "early access" wording. The journey demo renders each scene from a fixed `t`.
- Manual: screenshots at 375px and desktop; tab through the page; reduced motion; start a real session from the live page.
