# SAT Word Blitz feature map

Drive these paths against a live `python3 -m http.server` + Chrome CDP session. Selectors and commands come from [SKILL.md](../SKILL.md). There is no in-app debug flag to shorten the 60s round.

## Baseline preconditions

- Repo files present: `index.html`, `app.js`, `styles.css`, `words.js`, `favicon.svg`, `.nojekyll`.
- `cd .cursor/skills/verify-sat-vocab-arcade && npm install` has been run once (`puppeteer-core`).
- `./scripts/launch.sh` printed `READY http://127.0.0.1:8000/` and `CDP http://127.0.0.1:9222`.
- `./scripts/doctor.sh` exited 0 (`DOCTOR_OK`).
- For score/combo/storage assertions, start from empty stats: `./scripts/drive.mjs clear-storage`. Home chips should read BEST `0`, MAX COMBO `0`, RUNS `0`, and `storage` is `null`.
- `#playBtn` is enabled. If doctor reports an empty word bank, stop — PLAY will be disabled.

## Driving conventions

- Use `./scripts/drive.mjs <command>` against the launched CDP browser. One command per process; the tab persists.
- Prefer IDs and ARIA names (`#playBtn`, `#wordEl`, `[aria-label="Definition choices"]`). Do not use click coordinates.
- After PLAY, wait with `wait-countdown` then `wait-playing` (~2.1s). Do not assume the first word is visible immediately.
- Sample a hit at 120ms (`key-correct` / `answer-correct` already do this). The next question overwrites the board at 280ms (hit) or 900ms (miss).
- Map the right definition through `window.SAT_WORDS` (the helpers do this). Do not hard-code a word — the deck is shuffled and weakly weighted.
- Keys: `1`–`4` and `a`–`d` choose by index, not by “correctness”. `Enter` / `Space` start a run from home or results.
- Isolate a second cabinet with `SAT_VOCAB_PORT`, `SAT_VOCAB_CDP`, and `SAT_VOCAB_RUN_DIR`.

## Proof / skip reporting

A feature is **proved** when `evidence/<id>/` contains `notes.md`, before/after `state/*.json`, and `shots/*.png` that show the named user path and the resulting HUD or `satWordBlitz.v1` mutation — and those files still exist after `cleanup.sh`.

A feature is **skipped** only when `doctor.sh` cannot see a runnable arcade (missing files, no Python/Chrome, dead launch). Write the doctor output into `notes.md` and stop. Waiting 60s for results is not a skip.

On a failed iteration, run `./scripts/cleanup.sh` before relaunching.

## Features

| Feature | File | What a pass looks like |
|---|---|---|
| Start a round | [start-round.md](start-round.md) | PLAY (or Enter) → countdown `3`…`BLITZ` → `#wordEl` is a real SAT word and four `.choice` buttons |
| Answer via keyboard | [answer-via-keyboard.md](answer-via-keyboard.md) | `1`–`4` / `A`–`D` marks `.choice.correct` or `.wrong`, updates score/combo or shows `MISS` |
| Combo and score | [combo-and-score.md](combo-and-score.md) | Two fast hits → combo `x2` and score strictly greater than after the first hit; a miss resets combo |
| Results and missed words | [results-and-missed-words.md](results-and-missed-words.md) | After 60s, `#results` shows GAME OVER, hits/misses, and `#missedList` if you missed |
| localStorage stats | [localstorage-stats.md](localstorage-stats.md) | Ending a round writes `satWordBlitz.v1` and paints `#homeBest` `#homeCombo` `#homeGames` |
