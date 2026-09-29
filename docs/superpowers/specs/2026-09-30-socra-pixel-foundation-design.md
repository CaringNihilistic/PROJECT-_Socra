# Socra pixel redesign — Foundation (sub-project 1 of 5)

**Date:** 2026-09-30 · **Status:** approved in brainstorming, awaiting spec review
**Visual reference:** cast sheet artifact — https://claude.ai/artifact/QSzLaRx2ztfXAatqmzD766 (private)

## 1. Context and decisions

Socra is being fully redesigned as a portfolio showpiece. Decisions made during brainstorming:

| Decision | Choice | Why |
|---|---|---|
| Size of change | Full redesign | Portfolio goal needs a distinctive identity |
| Goal | Portfolio showpiece | Visual craft and "wow", while staying usable |
| Theme | Creature-collector inspired, **fully original** | Real franchise names/art invite takedowns on a public site with a donate button |
| Art style | Retro pixel | Every asset can be drawn in code, so nothing depends on outside art |
| In-character tone | Light touch | Fixed in-character lines in the UI; AI output and prompts unchanged |
| Build approach | Custom pixel kit + one live "battle scene" for the Council | Original, light, accessible; the council animation is driven by the real parallel agent stream |
| Sprite resolution | 32×32, shown only at whole-number scales | 16×16 looked blown-up at the sizes the app needs |

**The redesign is frontend-only.** No backend routes, prompts or data shapes change.

### Decomposition

Each sub-project gets its own spec → plan → implementation:

1. **Foundation** (this spec): tokens, fonts, sprite system, cast data, pixel UI kit, markdown styling, tests, CI.
2. **Council + Masterplan**: the live battle scene, Team Glitch critique, trainer-presented masterplan.
3. **Interrogation (chat)**: professor dialog, answer menu, XP and stat bars, evolution.
4. **Landing page**: its demo reuses the real components from 2 and 3.
5. **Share pages**: `/card` (trading card), `/share`, `/compare`.

Order matters: every screen depends on 1; 4 and 5 reuse components from 2 and 3.

## 2. The world and cast

All names are original. Sprite keys (in code) are the lowercase names.

**Professor Socra**: the interrogator. Every AI question renders in his dialog box. Line: "No masterplan until I understand you."

**Your idea evolves.** The four existing phases map onto an evolution line; the eval score is XP toward the next stage, and the five eval dimensions are its stats.

| Phase (backend `phase`) | Stage | Sprite | Threshold (existing) |
|---|---|---|---|
| `intake` | Idea Egg | `egg` | 0% |
| `debate` | Hatchling | `hatchling` | 40% |
| `stress_test` | Evolved | `evolved` | 70% |
| `masterplan` | Final Form | `final` | 80% |

**The Council** (backend agent `key` → creature):

| Agent `key` | Advisor | Creature | Type | Type colour | Line |
|---|---|---|---|---|---|
| `finance` | The Banker | Coinbit (armadillo, coin scales) | Steel | `#9aa7b8` | "Show me the unit economics." |
| `market` | The Oracle | Augurin (owl, third eye) | Psychic | `#e0609f` | "I've seen your market… it's smaller." |
| `competition` | The Challenger | Rivalix (boxing fox) | Fighting | `#e0703a` | "Rivals incoming!" |
| `tech` | The Builder | Beavolt (electric beaver, hard hat) | Electric | `#f5c518` | "Let's see what breaks at 10×." |
| `risk` | The Skeptic | Omenyx (shadow cat) | Ghost | `#5b3fa8` (cream text) | "Every plan has a crack. Found it." |

**Team Glitch**: agent `key` `devils_advocate`. Hex (commander), Rook (saboteur), Gremlix (their gremlin). Motto: "Your plan looks shiny? Prepare for a glitch!"

**The trainers** present the masterplan, matched by section heading (headings come from `_build_synthesis_prompt`):

| Heading contains (case-insensitive) | Trainer |
|---|---|
| "verdict", "phase", "mvp", "growth", "scale", "moat" | Kai (bold rookie) |
| "tech stack", "files", "cost" | Dex (steady planner) |
| "risk" | Marin (water-type gym leader) |
| anything else | Kai |

Rules are checked in the order Marin → Dex → Kai, so "Risk Register" never falls through to Kai. Against today's synthesis headings: Chairman's Verdict, Phase 1/2/3 → Kai; Tech Stack, First 3 files → Dex; Risk Register → Marin.

## 3. Visual system

### Palette (Tailwind tokens, namespace `px`)

| Token | Hex | Use |
|---|---|---|
| `px-night` | `#16142b` | page ground |
| `px-panel` | `#221f3f` | panels, cards |
| `px-edge` | `#3a3566` | outer pixel border |
| `px-screen` | `#f4ecd8` | sprite "screens", dialog boxes |
| `px-ink` | `#1b1a2e` | outlines, text on light |
| `px-muted` | `#b9b3d6` | secondary text on dark |
| `px-soft` | `#d8d2ee` | body text on dark |
| `px-xp` | `#ffd23f` | XP, primary actions |
| `px-plan` | `#3ec7b5` | masterplan, success, stat fill |
| `px-glitch` | `#e8474c` | Team Glitch and error **fills/borders only** (4.07:1 as text on a panel fails AA) |
| `px-glitch-text` | `#ff7a7e` | Team Glitch and error **text** (6.24:1 on panel) |
| `px-psy` | `#9b7be0` | accent fills; text only at 18px+ (4.72:1 on panel) |

Type colours from §2 are tokens too (`px-steel`, `px-psychic`, `px-fighting`, `px-electric`, `px-ghost`). Every text/background pair used must meet WCAG AA (4.5:1; 3:1 at 24px+). Ghost badges use cream text for that reason.

### Typography

| Token | Font | Rule |
|---|---|---|
| `font-pixel` | Press Start 2P | Titles and names only. Never below 10px, never for sentences longer than a short label |
| `font-term` | VT323 | Labels, stats, numbers. Never below 18px (small x-height) |
| `font-read` | Atkinson Hyperlegible 400/700 | All long text: AI questions, advisor reports, masterplan |

Loaded from Google Fonts with `display=swap`, **added alongside** the existing Bricolage/Onest/DM Mono so un-migrated screens don't change.

### Pixel shapes

Shared as CSS classes `.pixel-panel`, `.pixel-dialog`, `.pixel-btn` (not `.px-*`, which reads as Tailwind's padding utility).

- Panel: `border: 4px solid px-ink` + `box-shadow: 0 0 0 4px px-edge`.
- Dialog box: cream fill, double frame `border 4px ink` + `box-shadow: 0 0 0 4px screen, 0 0 0 8px ink`.
- Primary button: `px-xp` fill, 4px ink border, `4px 4px 0` ink drop shadow; pressed state removes the shadow and shifts 4px.
- No blur, no gradients except the segmented XP fill, no rounded corners.

### Sprites

- Authored as 16 rows × 8 chars (left half), mirrored to 16×16, upscaled to **32×32 with Scale2x (EPX)**, then rim-lit: a 1px shadow (mix 22% toward `#141028`) where the pixel below/right is outline or empty, else a 1px highlight (mix 28% toward white) where the pixel above/left is. Outline `k`, highlight `W` and glow `c` are never shaded.
- Rendered as SVG, one `<path>` per colour, `shape-rendering="crispEdges"`.
- **Whole-number scales only**: `size` is typed `32 | 64 | 96 | 128`. No CSS may resize a sprite.
- Exact source data: Appendix A.

### Motion

- Idle bob: 2-frame `steps()` animation, 2px, 1.2s. **Opt-in** via `<Sprite bob />`; sprites are still by default.
- All animation is disabled under `prefers-reduced-motion: reduce`.

## 4. What this sub-project ships

### New files (`frontend/src/pixel/`)

| File | Contents |
|---|---|
| `sprites.ts` | `PALETTE`, `HALVES` (Appendix A), pure `scale2x`, `shade`, `buildSprite(name) → {fill, d}[]`, memoised per name |
| `Sprite.tsx` | `<Sprite name size label? bob? />`; `aria-hidden` unless `label` is given, then `role="img"` + `aria-label` |
| `cast.ts` | Typed cast table (§2) + `councilForAgentKey(key)`, `stageForPhase(phase)`, `trainerForHeading(heading)` |
| `ui/PixelPanel.tsx` | Panel with optional title and accent edge colour |
| `ui/DialogBox.tsx` | Speaker sprite + name + children; optional "▼" more indicator |
| `ui/XpBar.tsx` | `score` 0–1; derives the next threshold from the phase table. Label "XP 64 / 70 · 6 to evolve"; at Final Form the bar is full and the label reads "FINAL FORM" |
| `ui/StatBar.tsx` | label + 0–1 value; `role="meter"` with aria values |
| `ui/TypeBadge.tsx` | Creature type pill using type tokens |
| `ui/PixelButton.tsx` | `variant: 'primary' \| 'secondary'`, real `<button>`, ≥44px tall |
| `ui/MenuChoice.tsx` | "▶ option" button for suggested answers |

Unknown agent keys return `null` from `councilForAgentKey` so a renamed backend agent shows a neutral card instead of the wrong creature.

### Changed files

| File | Change |
|---|---|
| `frontend/index.html` | Add the three Google Fonts |
| `frontend/tailwind.config.js` | Add `px-*` colours, `font-pixel/term/read`, `@tailwindcss/typography` plugin, a `pixel` typography modifier (read font body, pixel-font h1–h2 at 12–14px, term-font table heads, `px-plan` links) |
| `frontend/src/index.css` | `.pixel-panel`, `.pixel-dialog`, `.pixel-btn` classes; idle-bob keyframes; reduced-motion rule |
| `frontend/package.json` | Add `@tailwindcss/typography` ^0.5 and `vitest` ^2.1 (Vite 5 compatible); `"test": "vitest run"`. Tests live in `src/pixel/__tests__/` and are type-checked by `tsc` with everything else |
| `.github/workflows/ci.yml` | New `frontend` job: `npm ci`, `npm run build`, `npm test` |

### The one visible change

Installing `@tailwindcss/typography` activates the 228 `prose*` classes the current screens already use, on **every** markdown surface: chat replies and the council/masterplan views (`SessionPage`), the public `/share` page and `/compare`. They gain real headings, lists and tables **in the current design**. Chat replies will get slightly more vertical spacing between paragraphs. No screen switches to the pixel look in this sub-project.

## 5. Testing and acceptance

Unit tests (vitest, pure functions only):

- `buildSprite` for every name: returns 32×32 coverage, only palette/shade colours, never throws.
- `scale2x`: a known 2×2 input maps to the expected 4×4 output.
- `councilForAgentKey`: all five council keys + `devils_advocate` map correctly; unknown key → `null`.
- `stageForPhase`: four phases map to four stages; unknown → egg.
- `trainerForHeading`: each §2 heading maps correctly, including "Risk Register" → Marin.

Acceptance:

- `npm run build` (tsc) and `npm test` pass locally and in CI.
- Existing screens look the same except the now-styled masterplan/report markdown.
- A dev-only preview page at `/__pixel`, routed in `App.tsx` only when `import.meta.env.DEV` is true (so it is absent from production builds), renders every sprite at 64/96/128 and every kit component, for manual review.

## 6. Out of scope

- Restyling any screen (sub-projects 2–5).
- Any backend, prompt or API change.
- Sound, game-engine rendering, image assets.
- Removing the old fonts and colours (happens when the last screen migrates).

## Appendix A — sprite source data

Palette (`.` is transparent):

```json
{"k":"#1b1a2e","w":"#f4ecd8","W":"#ffffff","y":"#ffd23f","Y":"#c9941a","o":"#ff8c42","O":"#c4561f","r":"#e8474c","R":"#9e2a36","p":"#f28cb8","P":"#c0507f","v":"#9b7be0","V":"#5b3fa8","b":"#5b9cf0","B":"#2f5fb0","t":"#3ec7b5","T":"#1f8577","g":"#6fcf5f","G":"#3a8c35","s":"#b8c3d1","S":"#7a8699","d":"#4f5a6b","n":"#a86a3f","N":"#6e4225","h":"#e0b07a","f":"#ffd6ae","F":"#e0a878","x":"#3b3f5c","c":"#8ef0ff","e":"#4b3a8c","l":"#d9ccff"}
```

Left halves (each row is mirrored: `row + reverse(row)`):

```json
{"coinbit":["........","....kkkk","..kkSSyy",".kSyYYyS",".kSyyySS","kSSSSSsS","kSyYySyY","kSyyySyy","kSSSSSSS","ksssssss","kssWksss","ksskksss","kspssssN",".kssssss","..kddkkk","........"],
"augurin":["........",".k......",".kk.kkkk",".kVkvvvk",".kvvvvkc","kvwwwwvv","kvwkkwvv","kvwkkwvv","kvvwwvvo","kvvvvvvO","kVvlllll","kVvlllll","kVvvllll",".kVvvvvv","..kkookk","........"],
"rivalix":["........",".k......",".kk.....",".kOk....",".koOk.kk",".kooOkoo","kooooooo","kokWoooo","kowwoooo","koowwwwk",".kowwwww","kRRkoooo","kRRRkwww","kRRRkwww",".kkkoooo","...kkkkk"],
"beavolt":["........","...kkkkk","..kyyyyy",".kyyyyyY","kYYYYYYY",".knnnnnn",".knkWnnn",".knkknnn",".knnhhhN",".kynhhhh","..knnhhw","..knnnkw",".knnnnnn",".knhhhhh","..kNNkkk","........"],
"omenyx":["........",".k......",".kk.....",".kVk..kk",".kVVkkee","keVeeeee","keecceee","keeckeee","keeeeeee","keeeeeek","keeeeeew","keeeeeee",".keeeeee",".keVeVee","..kek.ke","...k...k"],
"socra":["........","....kkkk","...kffff","..ksffff","..ksffff","..ksffff","..ksfkWf","..ksfkkf","..ksssss","...kssss","..kkksss",".kWWWkss","kWWWWkbb","kWWsWkbb",".kkxxkkk","..kkkk.."],
"kai":["...k.k..","..kxkxkk",".kxxxxxx",".kxxxxxx",".krrrrrr",".kxfffff",".kfkWfff",".kfkkfff",".kffffff","..kffffk","...kkkkk",".kookwww","koookwww","kfooowww","..kBBkkk","..kkkk.."],
"dex":["........","...kkkkk","..knnnnn",".knnnnnn",".knNnnnn",".knfffff",".kfkWkkk",".kffffff",".kffffff","..kffffk","...kkkkk",".kttttwt","ktttttwt","kfttttTT","..kxxkkk","..kkkk.."],
"marin":["........","...kkkkk","..kbbbbb",".kbbbbbb",".kbyyyyy",".kbbffff",".kbfkWff",".kbfkkff",".kbfffff","..kbfffk","...kkkkk",".kbbbbww","kfbbbbbw","kfBBBBBB","..kffkkk","..kkkk.."],
"hex":["........","...kkkkk","..ksssss",".kssssss",".ksSSsss",".ksfffff",".kVVVVVV",".kVVVccV",".kffffff","..kffffk","...kkkkk",".kxxxxxr","kxxxxxrr","kfxxxxxx","..kxxkkk","..kkkk.."],
"rook":["....kkkk","...kxxRR","..kxxxxR",".kxxxxxx",".kxxxxxx",".kxfffff",".kxfkkff",".kffffff",".kffffff","..kfffkk","...kkkkk",".keeeeRe","keeeeeee","kfeeeeee","..keekkk","..kkkk.."],
"gremlix":["........","........","k.......","kgk..kkk","kgGkkggg",".kgGgggg","..kgyyyg","..kgykkg","..kggggg","..kgkkkk","..kgkwkw","...kgggg","...kgGgg","...kgggg","..kgGkkg","..kkk.kk"],
"egg":["........","........","......kk",".....kww","....kwww","...kwwtt","...kwwtt","..kwwwww","..kwtwww","..kwttww","..kwwwww","..kwwwww","...kwwww","....kwww","....kkkk","........"],
"hatchling":["........","........","........","........","....kkkk","...kwwww","..kwkwkw","..kttttt",".ktkWttt",".ktkkttt",".kpttttt",".ktttttk","..kttttt","...kkkkk","........","........"],
"evolved":["......ko",".....kyo",".....koO","....kttt","...ktttt","..kttttt","..ktkWtt","..ktkktt","..kttttt","..kttttk",".ktkkttt",".kttkttw",".kttktww","..kkktww","...kTTkk","...kkk.."],
"final":["k......y","kyk..kyy",".kyk.kyt","..kykttt","..kttttt",".kttkWtt",".kttkktt",".kyttttt","kttttttw","ktyytttw","ktyyttww","kttttwww",".kttttww","..kTTkkk","..kkkk..","........"]}
```
