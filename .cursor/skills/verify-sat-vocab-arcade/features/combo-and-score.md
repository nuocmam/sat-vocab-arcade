# Combo and score

Each correct answer adds one to the combo meter and multiplies that hit’s points; a miss zeros the combo (and flashes BROKE if you were at x3 or higher). Faster answers pay more.

## Sub-features

- First hit: combo `x1`, points ≈ `100 + speed` (speed 0–80 from how quickly you answered, capped at 5s).
- Second consecutive hit: combo `x2`, multiplier `1.2`, score HUD strictly greater than after the first hit.
- Combo paint: `x0`–`x2` use class `mag`; `x3+` `combo-lo`; `x5+` `combo-mid` and `#feedback` shouts `ON FIRE xN`; `x10+` `combo-hi` / `UNSTOPPABLE`; `x15+` `VOCAB GOD`.
- Miss after combo ≥ 3: `#comboEl` text `BROKE` for 400ms, then `x0`. Miss after combo 1–2: straight to `x0`. Score does not go down.
- `#scoreEl` tweens for 240ms. Read it after the tween if you need the exact integer.

## How to get to it (user POV)

Start a round. Answer the first word correctly — SCORE leaves 0 and COMBO shows x1. Answer the next word correctly while the clock is still running — COMBO becomes x2 and SCORE jumps again. Miss on purpose and COMBO dies (BROKE if you had a real streak).

## Driving it with drive.mjs

Preconditions: launched, doctored, `clear-storage`, then `click-play` → `wait-playing`. You must still be on `#play` with `time` > 2.

1. First correct hit.
   - Command: `node scripts/drive.mjs key-correct`
   - Result: `state.combo` is `"x1"`, `int(state.score)` is between 100 and 180 inclusive for a sub-5s answer, one `.choice.correct`.
2. Hold those numbers.
   - Command: write `state.score` / `state.combo` from the JSON into `notes.md` as `score1` / `combo1`.
   - Result: `combo1` is `x1`.
3. Wait for the next word, then hit again.
   - Command: `node scripts/drive.mjs wait 400` then `node scripts/drive.mjs key-correct`
   - Result: `state.combo` is `"x2"`, `int(state.score)` > `score1`. The second hit’s points are `round((100+speed)*1.2)`.
4. Screenshot the x2 HUD.
   - Command: `node scripts/drive.mjs shot 06-combo-x2`
   - Result: PNG with COMBO `x2` and a SCORE larger than the first shot.
5. Break the combo.
   - Command: `node scripts/drive.mjs wait 400` then `node scripts/drive.mjs key-wrong`
   - Result: `feedback` starts with `MISS  —  `, `combo` is `"x0"` (this streak is only 2, so not `BROKE`), `int(state.score)` equals the post-second-hit score (misses do not subtract).

To see `BROKE`, run three `key-correct` cycles (waiting 400ms between them) before `key-wrong`.

## Gotchas

- Combo is consecutive hits in this run only. It does not persist in `localStorage` until the round ends (`longestCombo` is the run’s best, written in `endRound`).
- If you sample score during the 240ms tween, the HUD string may still be climbing. For a strict `>` compare, `wait 250` after `key-correct` or read `state.score` from a second `state` call.
- A 5+ combo writes a shout into `#feedback` (`ON FIRE x5`). That is not a miss. Misses always begin with `MISS`.
- The 60s clock is shared. Do not start this feature with 1s left — `answer()` no-ops when `endsAt` is reached.
- Do not use `clear-storage` between the two hits; that reloads the page and kills the run.
