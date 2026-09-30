# Socra pixel redesign, sub-project 3: Interrogation (chat)

Status: approved design (user picked every recommended option on 2026-09-30); spec self-reviewed per the user's standing instruction.

Builds on [the foundation spec](2026-09-30-socra-pixel-foundation-design.md) (cast, palette, fonts, kit) and [the council episode spec](2026-09-30-socra-council-episode-design.md) (episode overlay, store wiring). Frontend-only: no backend route, prompt or payload changes.

## 1. Decisions

| Question | Decision |
|---|---|
| Layout | **Battle screen.** Your idea creature (with XP and stats) at the top, Prof. Socra's current question in a large dialog box, the answer menu and answer box below. Earlier turns live in a collapsible **LOG**. |
| Crossing a phase threshold | **Full evolution scene.** "What? IDEA EGG is evolving!", the sprite flickers between old and new forms, then "Your idea evolved into HATCHLING!". Skippable, reduced-motion safe. |
| Suggested answers | **Menu that pre-fills.** ▶ cursor menu (arrow keys, click). Choosing fills the answer box for editing; nothing is sent until Send. The last option is always "Write my own answer…". |
| Stats | **Always visible, compact.** Five stat bars beside the creature; each one opens Socra's note on that dimension. |

## 2. Screen anatomy (chat view, top to bottom)

1. **Header** (whole SessionPage, both tabs): `SOCRA` in Press Start 2P, the idea (truncated), `← NEW`, the auth button, then pixel tabs **CHAT / RESULTS** (the tabs show once results exist, as today). The legacy phase stepper is removed: the idea card below carries the phase. Background `px-night` on both tabs.
2. **Idea card** (`PixelPanel`): the stage sprite (128px on `sm`+, 96px below), stage name (`IDEA EGG`, `HATCHLING`, `EVOLVED`, `FINAL FORM`), the `XpBar`, and five stat rows:

   | Dimension key | Label |
   |---|---|
   | `problem_clarity` | CLARITY |
   | `scale_constraints` | SCALE |
   | `tech_context` | TECH |
   | `success_definition` | GOAL |
   | `risk_awareness` | RISK |

   Each stat row is a button (`aria-expanded`) that reveals that dimension's `explanations[].status_text` beneath it; one open at a time. Rows without a note are not buttons. Layout: sprite left and stats right from `sm`, stacked on phones.
3. **Save nudge** (signed-out users with Clerk enabled): one pixel strip, same behaviour as today.
4. **Field notes** (only when `assumptions.length > 0`): the assumptions list restyled as pixel chips; clicking cycles unknown → validated ✓ → disproved ✗ exactly as today (`updateAssumptionStatus`). Header shows the count and ✓/✗ tallies; collapsible; auto-opens when a new assumption appears.
5. **Dev/admin shortcuts** (same conditions as today): pipeline toggle, `[DEV]/[ADMIN] SKIP TO MASTERPLAN`, `[DEV]/[ADMIN] QUICK-FILL`, as small secondary `PixelButton`s. Behaviour unchanged.
6. **Socra's dialog** (`DialogBox`, speaker `PROF. SOCRA`, sprite `socra`): shows, in priority order:
   - while sending: the streaming text as it arrives (markdown), or "…" with a blinking cursor before the first token;
   - after a turn whose Part 1 came back empty but choices exist (today's fallback): "Pick an answer below, or write your own.";
   - otherwise the latest assistant message (markdown);
   - with no assistant message yet: Socra's line, "No masterplan until I understand you."

   Markdown inside the cream dialog uses a new `prose-dialog` typography modifier (ink text on cream, VT323, bold in ink, list markers in ink) so it meets contrast. Long questions grow the box; the page scrolls.
7. **Answer menu** (`MenuChoice` list, only when `currentChoices.length && !isSending && !masterplan`): one option per choice, then "Write my own answer…". ↑/↓ move focus between options (roving focus, wraps); Enter or click pre-fills the answer box with the choice and focuses it. "Write my own…" clears nothing, it just focuses the box.
8. **Status lines**: the saved flash (`SAVED ✓`), the refusal notice (as a small `PixelPanel`), and the stream error panel (`accent="glitch"`, "Socra lost the connection." / "Socra took too long to answer.", `RETRY ▶` resends `lastSentMessage`). Same conditions as today. The legacy "N more answers needed" hint is dropped: the XP label already says how far the next evolution is.
9. **Answer box** (sticky at the bottom): a pixel-bordered textarea (VT323 22px) with a `SEND ▶` `PixelButton`. **Enter sends, Shift+Enter inserts a newline** (today only ⌘+Enter works, which does nothing on Windows). Placeholder: `Answer Prof. Socra…`, or `Ask a follow-up…` once a masterplan exists. Disabled while sending.
10. **Log** (collapsible, closed by default, last in the flow, after the answer box): `LOG (n)` lists every earlier turn, oldest first, excluding the one shown in Socra's dialog. Socra's turns are compact dialog panels (no sprite, `PROF. SOCRA` label), yours are right-aligned panels labelled `YOU`. Same empty-message filter as today (strip `*#-_>` and whitespace; keep if > 5 chars). Because the answer box is sticky, an open log scrolls beneath it. Putting the log above the dialog was rejected: it pushes the current question below the fold.

## 3. Evolution scene

**When.** Only as the result of a chat turn in this tab (never on page load, replay, or an admin seed), and only forwards:

- `sendMessage` records `before = stageForSession(session)` when the turn starts.
- If the stream starts a council episode (the first council event, see the episode spec): set `evolution = { from: before, to: FINAL }` unless `before` is already Final Form. The scene opens **above** the episode overlay; the episode keeps pacing underneath, so closing the scene reveals the council mid-run.
- Else on `done` (and `stillViewing`): `after = stageForSession(p.session)`; set `evolution = evolutionFor(before, after)`. A jump of two stages plays once, straight to the final one.

The idea card and the scene use `stageForSession(session)` (in `chat/turns.ts`): `stageForPhase(session.phase)`, except that a session with a masterplan is always Final Form whatever its phase (guards legacy rows and admin seeds). Unknown phases stay the egg.

**Store.** `evolution: { from: Stage; to: Stage } | null` and `dismissEvolution()`. Reset with the episode on load/clear.

**Scene** (`components/chat/EvolutionScene.tsx`), full-screen `z-[60]` dialog (`role="dialog"`, `aria-modal`, focus trap and restore shared with the episode via a new `pixel/useModalKeys.ts` hook extracted from `EpisodePlayer`):

1. Dialog: "What? {FROM} is evolving!"; the sprite (128px) centred on `px-night`.
2. ~2.4s: the sprite alternates between the old and new form with increasing speed (CSS `steps()` keyframes on two stacked sprites, whole-pixel sizes only), white flash at the end.
3. Dialog: "Congratulations! Your idea evolved into {TO}!", the new sprite, and the stage's one-line meaning:
   - Hatchling: "The council can now debate it."
   - Evolved: "Ready for a stress test."
   - Final Form: "The council convenes!"
4. `CONTINUE ▶` (autofocused) closes. Esc or `SKIP ▶▶` during step 2 jumps to step 3; Esc on step 3 closes.

Reduced motion: no flicker or flash; step 3 shows immediately. `aria-live` announces the final sentence.

## 4. Code layout

| File | Contents |
|---|---|
| `src/chat/turns.ts` | Pure helpers: `visibleTurns(history)`, `currentQuestion(history, streaming)`, `logTurns(history)`, `STAT_ROWS` (key → label), `stageForSession(session)`, `evolutionFor(before: Stage, after: Stage)` (returns `{from, to}` only when `after` is later). |
| `src/chat/__tests__/turns.test.ts` | Unit tests for the helpers. |
| `src/chat/__fixtures__/chatSession.json` | A real anonymous production session mid-interrogation (conversation, scores, explanations, assumptions, choices). |
| `src/components/chat/BattleScreen.tsx` | The chat view (§2 items 2–10); presentational, fed by SessionPage from the store. |
| `src/components/chat/IdeaCard.tsx`, `SocraDialog.tsx`, `AnswerMenu.tsx`, `AnswerBox.tsx`, `FieldNotes.tsx`, `ChatLog.tsx`, `EvolutionScene.tsx` | The pieces. |
| `src/components/chat/ChatDemo.tsx` | Dev-only `/__chat`: BattleScreen on the fixture, with buttons to play each evolution and to fake a streaming turn. |
| `src/components/chat/__tests__/chat.test.tsx` | Render tests (static markup), as for the council. |
| `src/pixel/useModalKeys.ts` | Esc + Tab trap + focus restore, used by EpisodePlayer and EvolutionScene. |
| `src/pixel/ui/StatBar.tsx` | Gains an optional compact label column so five rows fit beside the sprite. |

Removed: `components/EvalBar/` and SessionPage's `AssumptionsList`, `PHASE_STEPS`, `PHASE_COLOR` (replaced by the idea card and field notes). CLAUDE.md's component table is updated.

Out of scope (later sub-projects): the landing page (4), share/card/compare (5), and the Results footer's donation/follow-up cards (restyled with 5).

## 5. Testing

- `turns.test.ts`: empty-message filter; current question vs streaming vs fallback; the log excludes the current question; `evolutionFor` for forward, same, backwards (no scene), double jump, unknown phase, and legacy masterplan.
- `chat.test.tsx` on the fixture: the idea card shows the right stage and all five stat labels; the dialog shows the latest question; the menu lists every choice plus "Write my own answer…" and is hidden while sending; the stream error offers RETRY; the evolution scene renders both stage names and CONTINUE, and in reduced-motion mode renders step 3 directly.
- Store: `evolution` is set on a forward phase change on `done`, on the first council event, and not on load.
- Manual: `/__chat` at 375px and desktop; keyboard only (menu arrows, Enter to send, Esc in the scene); a real run crossing 40% and 80% against the local backend.
