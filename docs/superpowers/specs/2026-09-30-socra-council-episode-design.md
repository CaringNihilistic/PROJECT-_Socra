# Socra pixel redesign — Council + Masterplan episode (sub-project 2 of 5)

**Date:** 2026-09-30 · **Status:** designed in brainstorming; review delegated to Claude by the user
**Depends on:** Foundation (`2026-09-30-socra-pixel-foundation-design.md`): sprites, cast, UI kit, VT323/Press Start 2P

## 1. Decisions

| Question | Decision |
|---|---|
| Structure | A **live episode** plays while the council runs (~60s), then settles into a **browsable results page** |
| Creature reveal | Each creature "attacks" with its **signature line** (first bullet of its real report); full reports in results |
| Plan beat | **Trainer relay**: a dialog types the plan live in the voice of the trainer who owns the current section; a section tracker ticks off |
| Controls | **Skip** (always) and **Watch episode** replay from saved data; reduced-motion users go straight to results |
| Architecture | **One episode engine** for live and replay (pure reducer + pacer), replacing the store's four copy-pasted SSE readers |
| Failures | In-world: a creature that errors **faints**; an empty plan is "the trainers dropped the plan, try again?" |

## 2. What the backend sends (unchanged)

Both `POST /sessions/{id}/unlock` and the chat stream (`/message/stream`, when a turn crosses into the masterplan phase) emit `data: {json}\n\n` events:

| Event | When | Notes |
|---|---|---|
| `web_research {queries}` | first | **Only** on `/unlock`, and only if Tavily is configured. Often absent |
| `agent_report {report}` ×5 | as each agent finishes | Parallel: **any order**. Keys `finance`, `market`, `competition`, `tech`, `risk` |
| `synthesis_token {delta}` | plan streaming | ~1,500 tokens. Absent in stub mode |
| ~~`synthesis_done`~~ | — | **Never reaches the browser** (found in a live run): both routes consume it internally to save the plan. The `done` payload's `session.masterplan` is authoritative, so the client expands `done` into `synthesis_done(text)` + `done` (`toEpisodeEvents`). In stub mode this is the *only* place the plan appears |
| `agent_report {report}` (`devils_advocate`) | **after** the plan | Absent in stub mode |
| `done {session, pipeline?}` | last | Full saved session |

A failed agent still sends a report, whose content matches `/analysis unavailable|could not be generated|critical review unavailable/i`.

## 3. The engine (`frontend/src/episode/`)

| File | Responsibility |
|---|---|
| `events.ts` | `EpisodeEvent` union (the five event types above + `done` + `stream_error`) and `AgentReport` |
| `sse.ts` | `readSse(response, onEvent)`: one parser for every stream. Splits on blank lines, joins multi-line `data:`, tolerates an event split across network chunks, ignores malformed JSON |
| `signature.ts` | `signatureLine(content)`: first bullet (`-`, `*`, `•`, `1.`), else the first line that is neither a `#` heading nor a whole-line **bold label** (real reports open with `# The Banker's Verdict` and the Skeptic writes bold-label paragraphs); strips markdown; ≤120 chars cut on a word boundary with `…`. `isFainted(content)` |
| `sections.ts` | `parseSections(markdown)`: picks the heading level whose headings best match the section vocabulary (verdict, tech stack, phase, mvp, growth, moat, risk, files; ties → shallowest; no matches → shallowest level used twice) and splits on it **and every shallower level**. Real plans come in both shapes: `# TECH STACK` with `## What to Build` inside, and `# THE PLAY` wrapping `## Tech Stack`. Deeper headings stay inside their section; empty sections are dropped except the one still streaming; whole-line bold lines count as headings only when the plan has no `#` headings. Text before the first section is an intro presented by Kai |
| `reducer.ts` | `initialEpisode()`, `episodeReducer(state, event)`: pure |
| `pacer.ts` | `createPacer({gapMs, onRelease})`: queues events, releases them no faster than beat gaps, merges consecutive plan tokens, `skip()` flushes instantly |
| `controller.ts` | `createEpisodeController({mode, onChange})`: reducer + pacer; used by the store (live and replay) and by the dev demo |
| `replay.ts` | `replayEvents(session)`: saved reports + plan → an event list (plan cut into ~400 chunks so its beat lasts ~12s) |
| `results.ts` | `resultsFromSession(session)` / `resultsFromEpisode(state)` → one `ResultsData` shape for the browse view |

### State

```
beat:   'scouting' | 'council' | 'plan' | 'ambush' | 'done' | 'failed'
queries: string[]
seats:  5 × { key, status: 'thinking'|'done'|'fainted', signature, report }   (COUNCIL order)
extras: AgentReport[]                              (unknown keys → neutral card)
plan:   { text, status: 'waiting'|'writing'|'done'|'failed' }
glitch: { status: 'waiting'|'done'|'fainted'|'absent', signature, report }
skipped: boolean
```

### Transitions

- `web_research` → store queries (stay in `scouting`).
- council `agent_report` → seat `done` or `fainted` (via `isFainted`) with its signature; beat `council`.
- unknown-key `agent_report` → appended to `extras`; beat `council`.
- `synthesis_token` → append; plan `writing`; beat `plan`.
- `synthesis_done` → text replaced by the authoritative text; plan `done`, or `failed` if blank.
- `devils_advocate` report → glitch `done`/`fainted`; beat `ambush`.
- `done` → beat `done`; a plan still `writing`/`waiting` → `done` (or `failed` if blank); a glitch still `waiting` → `absent`; a seat still `thinking` → `fainted`.
- `stream_error` (stream ended without `done`) → beat `failed` unless already `done`.

### Pacing (live)

| Next event after… | Minimum gap |
|---|---|
| `web_research` | 1200ms |
| an `agent_report` (council) → next council report | 600ms |
| last council report → first plan token | 900ms |
| plan token → plan token | 0 (merged) · replay: 30ms |
| `synthesis_done` → `devils_advocate` | 900ms |
| anything → `done` | 600ms |

Pacing only delays **display**; it never slows the backend. After `skip()` every gap is 0.

### Invariant (tested)

Replaying a finished session produces the same final `seats`, `extras`, `plan` and `glitch` as the live run. `queries` are not saved, so replay has no scouting beat.

## 4. The episode (`frontend/src/components/council/EpisodePlayer.tsx`)

Full-screen overlay on `px-night`, **Skip ▶▶** always top-right (a real button, focusable, Esc also skips).

1. **Scouting** (only if `queries`): Prof. Socra's dialog, "Scouting the market…", queries listed as they arrive.
2. **Council**: an arena panel with 5 seats. `thinking` seats bob with a "…" indicator; on `done` the seat flashes (a 2-frame "attack" shake) and a speech bubble shows its signature line; `fainted` seats go greyscale with "{Name} fainted!". Unknown-key reports appear as a neutral "?" seat.
3. **Plan** (trainer relay): a dialog box whose speaker is the trainer for the latest detected section (swaps Kai → Dex → Marin as headings arrive); it shows the tail (~320 chars, markdown stripped) of the plan as it types; a section tracker lists detected headings with ✓. `failed` → "The trainers dropped the plan." + **Try again** (admin re-run or unlock retry).
4. **Ambush**: a red flash; Team Glitch trio + motto; then Hex's dialog with the Devil's Advocate signature line. Skipped if `absent`.
5. **Done**: "EPISODE COMPLETE" + **See results ▶** (focused). Closing lands on the results view.

`prefers-reduced-motion: reduce`: live episodes start skipped with the overlay closed (straight to results); replay still available but animations are off (static sprites, no flash/shake).

## 5. Results (browse) view (`frontend/src/components/council/Results.tsx`)

Replaces SessionPage's Council and Masterplan tabs (tabs become **Chat · Results**). Renders `ResultsData` from the saved session, or from the live episode when the user skipped before `done` (showing "still writing…" markers).

- Header: idea, **Watch episode** (when ≥1 council report and a plan exist), Copy, Download .md, Share link, Score card; admin **Re-run** and the LangGraph badge as today.
- **The Council**: 5 creature cards (sprite 96, name, type badge, advisor, signature line, **Read full report** disclosure rendering the report with `prose prose-pixel`). Fainted cards greyed; unknown keys as neutral cards.
- **Team Glitch**: glitch-accent panel with the trio, motto and the full critique.
- **The Masterplan**: one block per parsed section: presenting trainer (sprite 64 + name) beside the section rendered with `prose prose-pixel`.
- Existing follow-up email capture and donation card stay at the bottom unchanged (restyled in step 3).

## 6. Store changes (`sessionStore.ts`)

- New: `episode: EpisodeState | null`, `episodeOpen`, `skipEpisode()`, `closeEpisode()`, `replayEpisode()`.
- Removed: `currentAgentReports`, `isAnalyzing`, `isResearching` (council-only flags now derived from `episode`).
- `sendMessage`, `verifyAndUnlock`, `devUnlock`, `devRerunMasterplan` all read streams through `readSse`; council events go to a live controller. Chat `token` / `choices` handling is unchanged. The `done` payload still sets `session` exactly as today.
- `devRerunMasterplan` sends `force=true` (from the earlier fix) and starts a fresh episode.

## 7. Error handling

| Case | Behaviour |
|---|---|
| Agent failed | Seat `fainted`, card greyed, full error text available in results |
| Plan empty | Plan `failed`, overlay offers Try again; results show the retry too |
| No Devil's Advocate | Ambush skipped (`absent`) |
| Stream drops | `failed` beat: "Connection lost. Your analysis may still finish." + Try again |
| Unknown agent key | Neutral card, never a wrong creature |

## 8. Testing

Vitest, pure functions first:

- `sse`: events split across chunks, multi-line data, malformed JSON skipped.
- `signature` / `sections`: real report and plan formats (fixture), bold-label bullets, numbered and bolded headings.
- `reducer`: out-of-order reports, unknown key, fainted agent, blank plan, missing devil, `stream_error` before/after `done`.
- `pacer`: gaps honoured and tokens merged (fake timers); `skip()` flushes at once.
- `replay`: the §3 invariant, on a real saved session fixture.
- Components: server-render `EpisodePlayer` at each beat and `Results` from the fixture without throwing.

A dev-only `/__episode` page replays the fixture session through the real controller, for review without the backend.

## 9. Known issue found during design (backend, not fixed here)

Synthesis is capped at `max_tokens=3000` (`llm_client.py`). The real fixture plan is cut off mid-sentence in Phase 2: Phase 3, the Risk Register and "First 3 files" never arrive, so Marin never presents. The episode must handle a truncated plan (tracker shows only what arrived). Raising the cap is a separate backend change.

## 10. Out of scope

Chat/interrogation restyle (step 3), landing (step 4), `/share` and `/card` wiring of replay (step 5), any backend change, sound.
