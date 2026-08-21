# Results and missed words

When the 60-second clock hits zero, the cabinet switches to GAME OVER: final score, hit/miss counts, best combo this run, and — if you missed at least once — a list of those words with the real definition and what you picked.

## Sub-features

- `#results` becomes `is-active`; `#play` is `hidden`.
- `#finalScore` tweens to `state.score` over 700ms, then gets class `punch`.
- `#highNote` is always shown: `NEW HIGH SCORE` or `BEST {n} · {delta} SHORT`.
- `#comboNote` shows only when this run’s best combo beats `stats.longestCombo`.
- `#hitCount` `#missCount` `#runCombo` match the run totals.
- `#missedWrap` unhides when `state.missed.length > 0`. Each `<li>` is `<strong>word</strong>`, `.def` (correct), and `.picked` (`you picked: …`).
- `#againBtn` (PLAY AGAIN) or Enter/Space starts another countdown. `#homeBtn` returns to `#home` with chips already painted by `endRound`.

## How to get to it (user POV)

Play a round. Miss at least one word if you want the review list. When TIME reaches 0 the board is replaced by GAME OVER, your score, HITS / MISSES / COMBO, and a Missed words panel. PLAY AGAIN rematches; HOME goes back to the title cabinet.

## Driving it with drive.mjs

Preconditions: launched, doctored, `clear-storage`, then `click-play` → `wait-playing`. There is no query param to shorten `ROUND_MS`. Budget ~75s for this feature.

1. Seed one miss so the review list is non-empty.
   - Command: `node scripts/drive.mjs key-wrong`
   - Result: `feedback` starts with `MISS  —  `. Remember `word` from the JSON for the later list check.
2. Let the clock finish.
   - Command: `node scripts/drive.mjs wait-results`
   - Result: `state.screen` is `"results"`, `resultsHidden` is false, `playHidden` is true. Timeout is 75s. Do not poll `time` yourself unless you want extra screenshots at 10s remaining (`#timeEl` goes red via `.hud-timer.low` at ≤10s).
3. Wait for the score tween, then snapshot.
   - Command: `node scripts/drive.mjs wait 800` then `node scripts/drive.mjs state` and `node scripts/drive.mjs shot 08-results`
   - Result: `finalScore` equals the run score (integer string). `hitCount` / `missCount` / `runCombo` are digits. `highNoteHidden` is false. After `clear-storage`, `highNote` is `NEW HIGH SCORE` if score > 0, else `BEST 0 · 0 SHORT`.
4. Assert the missed-word review.
   - Command: read `state.missed` from that snapshot
   - Result: `missedHidden` is false, `missed` has at least one entry containing the word from step 1 and `you picked:`.
5. Return home (optional, pairs with the storage feature).
   - Command: `node scripts/drive.mjs click-home`
   - Result: `screen` is `"home"`. `#homeGames` is `1`.

A perfect run (no `key-wrong`) still ends on `#results`, but `missedHidden` is true and `#missedList` is empty. That is a valid pass of the GAME OVER screen, not of the review list.

## Gotchas

- `endRound` also runs if a locked-answer timeout fires after `endsAt`. Do not click during the last 300ms if you need a specific last answer to land.
- `#finalScore` starts at `0` and eases up. A screenshot taken immediately after `wait-results` can show a mid-tween number. Wait 800ms.
- `wait-results` is long on purpose. A 5s timeout is a harness bug, not a game bug.
- PLAY AGAIN and Enter on results call `startRound()` again — career stats stay, run HUD resets. Do not treat a new countdown as a failed results screen.
- Missed-word copy is HTML-escaped (`escapeHtml`). Unusual characters in a definition are expected as entities in `html`, but `state.missed` uses `innerText`.
