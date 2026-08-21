# localStorage stats

Career stats live in `localStorage["satWordBlitz.v1"]` and paint the home chips. A round writes the blob only when it ends; misses also update `weak` immediately so later picks can rematch those words.

## Sub-features

- Key: `satWordBlitz.v1`. Shape: `{ highScore, longestCombo, gamesPlayed, weak }`. `weak[word] = { misses, streak }`.
- `endRound` increments `gamesPlayed`, raises `highScore` / `longestCombo` when beaten, then `paintHome()`.
- A miss calls `noteWeak(word, false)` during the round (`misses += 1`, `streak = 0`). Two later hits on that word delete the weak entry (`streak >= 2`).
- Home chips: `#homeBest` ← `highScore`, `#homeCombo` ← `longestCombo`, `#homeGames` ← `gamesPlayed`.
- `pickQuestion` gives unused weak words a 50% chance to be drawn, weighted by `misses`.
- `clear-storage` (helper) is `removeItem` + reload — not a user control. There is no in-game reset.

## How to get to it (user POV)

Play a full 60-second round (miss once if you want a rematch pile). When GAME OVER appears the browser has already saved the run. HOME shows the new BEST / MAX COMBO / RUNS. Refreshing the page keeps those chips. A later run that scores lower still adds 1 to RUNS and keeps the old BEST.

## Driving it with drive.mjs

Preconditions: launched, doctored. Start from a known blob: `node scripts/drive.mjs clear-storage` so `storage` is `null` and home chips are `0`. Then play through results (`click-play` → `wait-playing` → optional `key-wrong` → `wait-results`).

1. Record the empty baseline.
   - Command: `node scripts/drive.mjs storage` (after `clear-storage`)
   - Result: `{ "storage": null }`. `state.homeGames` is `"0"`.
2. Finish a round.
   - Command: `node scripts/drive.mjs wait-results` (after a started run)
   - Result: `#results` active. Storage is already written by `endRound` before the screen swap.
3. Read the side effect.
   - Command: `node scripts/drive.mjs storage`
   - Result: `storage.gamesPlayed` is `1`. `storage.highScore` equals `int(state.finalScore)` after the tween (wait 800ms). `storage.longestCombo` is the run’s best combo. If you missed, `storage.weak` has that word with `misses >= 1` and `streak` `0`.
4. Confirm the home chips without relying on a reload.
   - Command: `node scripts/drive.mjs click-home` then `node scripts/drive.mjs state`
   - Result: `homeBest` / `homeCombo` / `homeGames` match `highScore` / `longestCombo` / `gamesPlayed`.
5. Confirm persistence across navigation.
   - Command: `node scripts/drive.mjs goto` then `node scripts/drive.mjs state`
   - Result: Same chip values. `storage` still present. Screenshot `09-home-after-run`.

A second `wait-results` after PLAY AGAIN should show `gamesPlayed === 2` and an unchanged `highScore` if the second run scored lower.

## Gotchas

- Hits during a live round do **not** bump `gamesPlayed` or `highScore`. If you `storage` after `key-correct` but before the clock dies, you may only see a `weak` mutation from an earlier miss, or `null` on a clean hit-only run.
- `clear-storage` reloads the page. Never call it in the middle of a round you still want to finish.
- The Chrome profile is under `.verify-run/chrome-profile` and is deleted by `cleanup.sh`. That does not delete `evidence/*.json` dumps you already wrote. A new `launch.sh` starts with empty `localStorage` unless you reused `SAT_VOCAB_KEEP_RUN=1`.
- Two cabinets (two CDP ports) do not share storage. Assert against the session you drove.
- Corrupt JSON in the key is treated as empty stats (`loadStats` catch). Do not seed invalid JSON and call that a game bug.
