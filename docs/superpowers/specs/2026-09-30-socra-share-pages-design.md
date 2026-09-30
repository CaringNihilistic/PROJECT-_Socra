# Socra pixel redesign, sub-project 5: Share pages

Status: approved design (user picked every recommended option on 2026-09-30); spec self-reviewed per the user's standing instruction.

The last sub-project: `/card/:id`, `/share/:id`, `/compare/:a/:b`, plus the two Results footer cards (donation, follow-up email) still in the legacy style. Frontend-only, with one new dependency (`html-to-image`). All three pages read the public session view (`GET /sessions/{id}`: no transcript; scores, explanations, reports and plan included).

## 1. Decisions

| Question | Decision |
|---|---|
| `/card` | **Trading card** for the idea: stage sprite in an art window, HP = score, five stats, a rarity frame by grade, the Chairman's verdict as flavour text, a card number. |
| Download | **DOWNLOAD PNG**, rendered in the browser with `html-to-image`. Link previews (og:image) stay as today: a static site can't render per-idea images. |
| `/share` | **Results + Watch episode**: the Results view read-only, with the council episode replayable by visitors. |
| `/compare` | **VS battle screen**: the two creatures face off, mirrored stat bars, each council creature's two signatures side by side, links to both plans. No declared winner. |

## 2. `/card/:id`: trading card

`share/card.ts` (pure):

- `gradeFor(score)`: the existing thresholds and labels, each with a rarity frame.

  | Score | Grade | Frame |
  |---|---|---|
  | ≥ 80 | GREENLIT | gold holo: `px-xp` border with a static diagonal pixel-stripe sheen |
  | ≥ 60 | STRONG | `px-plan` |
  | ≥ 40 | DEVELOPING | `px-psy` |
  | < 40 | EARLY STAGE | `px-edge` (grey) |

- `flavorText(masterplan)`: the first sentence of the verdict's first paragraph (the first non-heading paragraph), stripped of markdown and cut at ≤ 140 characters on a word boundary with "…". It returns `null` without a masterplan.
- `cardNumber(id)`: `#` plus the first 6 characters of the id, upper-cased.

**`TradingCard`** (fixed 360px wide, so the PNG is the same everywhere; it scales down on narrow phones with a wrapper, never below whole-pixel sprite sizes):

- Header: `IDEA` / stage name, and `HP {score}` right-aligned.
- Art window: the stage sprite at 128px on `px-screen`.
- The idea text (VT323 22px, max 3 lines, clamped).
- The grade line: `{STAGE} · {GRADE}`.
- The five stats (`StatBar` compact, labels from `STAT_ROWS`).
- Flavour text (VT323) between thin rules, or `"Still under interrogation."` without a plan.
- Footer: `SOCRA` and the card number.

**`CardPage`**:
- Pixel loading ("LOADING…") and not-found states. Not found: "This card doesn't exist." plus `RUN YOUR IDEA ▶`.
- The card, then `DOWNLOAD PNG`, `COPY LINK` (confirms "Link copied") and `RUN YOUR IDEA ▶`.
- Share prompt: "Post it with #SocraScore".

**PNG**: `toPng(cardNode, { pixelRatio: 2, fontEmbedCSS })`. The Google Fonts stylesheet is fetched and its font URLs inlined as data URIs once. Cross-origin `cssRules` are unreadable, so html-to-image can't embed the fonts itself. The file is `socra-card-{slug}.png`. On failure: "Couldn't create the image. Try again, or take a screenshot."

## 3. `/share/:id`: Results + Watch episode

- **Header**: `SOCRA` / `MASTERPLAN` and `RUN YOUR IDEA ▶`.
- **Body**: `Results` with `data = resultsFromSession(session)`, `canReplay(session)`, no re-run and no pipeline tag.
- **Footer**: a CTA panel: "Think your idea survives the council? Prof. Socra is waiting." with `PRESS START ▶` → `/`.
- **Watch episode**: `episode/usePlayback.ts` (new) owns a replay `EpisodeController` (`replayEvents(session)`) plus the open/skip/close state. `EpisodePlayer` renders it. Reduced motion skips straight to the end, as in the store.
- **Missing plan / not found**: a pixel panel ("This masterplan doesn't exist, or isn't finished yet.") with `RUN YOUR IDEA ▶`.

`Results` gains no new props: its SHARE LINK / SCORE CARD / COPY PLAN / DOWNLOAD buttons already work for visitors.

## 4. `/compare/:a/:b`: VS screen

`share/compare.ts` (pure):
- `statPairs(a, b)`: per `STAT_ROWS` entry `{ label, a, b, leader: 'a' | 'b' | 'tie' }`; a tie is equal to the rounded percent.
- `councilPairs(a, b)`: per `COUNCIL` key `{ key, a: signature | null, b: … }`. A missing or fainted report gives `null`, shown as "No report".

**Layout**, top to bottom:
1. **VS banner**: A (left) and B (right). Each shows the stage sprite at 128px (B mirrored with `scale-x-[-1]`, still whole pixels), the idea (3 lines max), `HP {score}` and the stage name. A big `VS` in Press Start 2P sits between them. Phones stack A / VS / B.
2. **STATS**: one row per stat. The label is centred, A's bar grows leftwards from the centre and B's rightwards; the leader's number is `px-xp` and the other `px-soft`. `role="meter"` on each bar with "Idea A clarity 65" labels.
3. **THE COUNCIL**: per creature, the sprite and name, then A's signature and B's signature side by side (stacked with `A` / `B` tags on phones).
4. **Links**: `READ PLAN A ▶` → `/share/a`, `READ PLAN B ▶` → `/share/b` (shown only for sessions with a plan), and `RUN YOUR IDEA ▶`.

Each side loads independently. One side failing shows "Idea B couldn't be loaded" in its column. Both failing shows the not-found panel.

## 5. Results footer cards

- **`FollowUpEmailCapture`**: a pixel panel titled `CHECK IN LATER`, same behaviour and endpoint.
- **`DonationCard`**: a `plan`-accent pixel panel "Socra is free. Support it if it helped.", with `DONATE ₹499` and `MAYBE LATER`, same behaviour.

## 6. Cleanup

- Delete `VerdictCard.tsx` (replaced) and `PitchDeckView.tsx` (imported nowhere).
- Stop loading Bricolage Grotesque, Onest and DM Mono in `index.html` once nothing uses `font-display` / `font-sans` / `font-mono`. Remove their Tailwind `fontFamily` entries, and the `ink` palette if unused.
- Update the CLAUDE.md fonts row.

## 7. Code layout

| File | Contents |
|---|---|
| `src/share/card.ts`, `src/share/compare.ts`, `src/share/__tests__/share.test.ts` | Pure helpers + tests. |
| `src/episode/usePlayback.ts` | Replay controller hook for pages outside the store. |
| `src/components/share/TradingCard.tsx`, `src/components/share/pngExport.ts` | The card and its PNG export. |
| `src/components/CardPage.tsx`, `SharePage.tsx`, `ComparePage.tsx` | Rewritten pages (`App.tsx` routes unchanged). |
| `src/components/share/__tests__/share.test.tsx` | Render tests. |

## 8. Testing

- **Helpers**:
  - Grade boundaries at 39/40/59/60/79/80.
  - Flavour text on the real fixture plans (a sentence, ≤ 140 characters, no markdown), and `null` without a plan.
  - Card numbers.
  - Stat leaders including ties.
  - Council pairs with a missing and a fainted report.
- **Render**:
  - The card shows HP, all five stat labels, the grade, the flavour and the card number.
  - The share page renders Results with WATCH EPISODE for a full session and the not-found panel without a plan.
  - Compare renders both ideas, VS, every council creature and "No report" for a gap.
- **Browser (puppeteer, local)**, with `GET /sessions/:id` intercepted to serve the recorded fixture sessions (the local frontend cannot reach the production API: CORS):
  - Each page at 375px and 1280px with no horizontal overflow.
  - DOWNLOAD PNG produces a PNG that visibly uses the pixel fonts (checked by viewing it).
  - WATCH EPISODE opens the episode on `/share` and Esc closes it.
