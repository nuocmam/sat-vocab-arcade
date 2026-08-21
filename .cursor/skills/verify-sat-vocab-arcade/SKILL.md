---
name: verify-sat-vocab-arcade
description: Verify SAT Word Blitz, the vanilla HTML/CSS/JS vocab arcade served at http://localhost:8000/. Use when launching, doctoring, driving, capturing proof, or tearing down PLAY → countdown → 60s round, 1–4/A–D answers, combo/score, results/missed words, or localStorage stats.
---

# Verify SAT Word Blitz

This repo is a static arcade: `index.html`, `app.js`, `styles.css`, `words.js` (413 words on `window.SAT_WORDS`), `favicon.svg`, `.nojekyll`. No framework, bundler, backend, or existing test harness. Live site: https://nuocmam.github.io/sat-vocab-arcade/

Work from the repo root. Helpers live in `.cursor/skills/verify-sat-vocab-arcade/`. First time in a machine: `cd .cursor/skills/verify-sat-vocab-arcade && npm install`.

Do not change game behavior for verification. Drive the shipped DOM. If a launch fails, fix process/ports — not the arcade — unless the HTML/JS is actually broken.

## Launch

From repo root (same command as the README, port pinned so it matches `http://localhost:8000/`):

```bash
cd .cursor/skills/verify-sat-vocab-arcade
./scripts/launch.sh
```

That starts two processes only:

1. `python3 -m http.server 8000 --bind 127.0.0.1` with cwd = repo root
2. Headless Google Chrome (`--headless=new --no-sandbox`) on CDP `127.0.0.1:9222`, viewport 390×844, opening `http://127.0.0.1:8000/`

**Ready signal:** `launch.sh` prints `READY http://127.0.0.1:8000/` after `GET /` returns HTML containing `SAT Word Blitz`, and `CDP http://127.0.0.1:9222` after `GET /json/version` succeeds. Python's own line is `Serving HTTP on 127.0.0.1 port 8000` (may be buffered); treat the HTTP title check as the source of truth.

**Teardown:** `./scripts/cleanup.sh` (see Cleanup). PIDs and logs sit in `.cursor/skills/verify-sat-vocab-arcade/.verify-run/` — never commit that directory.

Manual equivalent if you are not using the helper:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# other terminal: open http://127.0.0.1:8000/
```

**Two instances:** HTTP binds one port per process. A second `http.server` on 8000 fails (`launch.sh` checks the bind with Python; `ss` is not required). Side-by-side works on different ports and CDP ports:

```bash
SAT_VOCAB_PORT=8001 SAT_VOCAB_CDP=9223 SAT_VOCAB_RUN_DIR=.cursor/skills/verify-sat-vocab-arcade/.verify-run-b \
  .cursor/skills/verify-sat-vocab-arcade/scripts/launch.sh
```

The game is client-side. Two browsers against one server are fine; they do not share `localStorage`.

**Env knobs:** `SAT_VOCAB_PORT` (default 8000), `SAT_VOCAB_CDP` (9222), `SAT_VOCAB_BIND` (127.0.0.1), `SAT_VOCAB_CHROME` (binary), `SAT_VOCAB_HEADED=1` (skip `--headless=new`), `SAT_VOCAB_RUN_DIR`, `SAT_VOCAB_EVIDENCE`.

Fonts load from `fonts.googleapis.com`. A blocked font request does not block gameplay (system-ui fallback). Audio uses `AudioContext` after PLAY; mute with `#muteBtn` if beeps matter.

## Doctor

Read-only. Does not start or stop processes.

```bash
.cursor/skills/verify-sat-vocab-arcade/scripts/doctor.sh
```

Pass means: the six arcade files exist; `python3`, Chrome, and `node` are on PATH; `app.js` still uses `STORAGE_KEY = "satWordBlitz.v1"`; `index.html` still has `#playBtn` / `#wordEl`; `words.js` evaluates to a non-empty `window.SAT_WORDS`; if a launch env file exists, those PIDs are alive, `GET /` is this arcade, assets 200, and CDP `/json/version` answers. Exit 1 on any FAIL. IDLE (no env file) is OK — doctor then only checks files, tools, and whether 8000/9222 are free.

`puppeteer-core` missing is a WARN, not a FAIL. Install before Drive.

## Drive

Prefer the shipped CDP helper against the Chrome `launch.sh` opened. Selectors below are from `index.html` / `app.js` — use these IDs, ARIA names, and keys. Do not click by coordinates.

```bash
node .cursor/skills/verify-sat-vocab-arcade/scripts/drive.mjs ready
node .cursor/skills/verify-sat-vocab-arcade/scripts/drive.mjs state
node .cursor/skills/verify-sat-vocab-arcade/scripts/drive.mjs shot 01-home
node .cursor/skills/verify-sat-vocab-arcade/scripts/drive.mjs --shot 04-after-key key-correct
```

Each invocation connects to CDP, runs one command, prints JSON, disconnects. The Chrome tab stays up, so state carries across commands.

| Command | What it does |
|---|---|
| `ready` | Wait for `#home.is-active` and visible `#playBtn` |
| `state` | Screen, HUD, choices, results, `localStorage` |
| `shot <name>` | PNG → `$SAT_VOCAB_EVIDENCE/shots/` (or `.verify-run/shots`) |
| `--shot <name>` (flag) | Take that PNG in the **same** CDP session as the command. Required after a hit — a second `drive.mjs` process misses the 280ms `.correct` window. |
| `click-play` / `click-again` / `click-home` / `click-mute` | `#playBtn` `#againBtn` `#homeBtn` `#muteBtn` |
| `key <k>` | `1`–`4`, `a`–`d`, `Enter`, `Space` |
| `key-correct` / `key-wrong` | Map `#wordEl` through `window.SAT_WORDS` to a key, press it, wait 120ms, dump state |
| `answer-correct` / `answer-wrong` | Same mapping, click `.choice` |
| `wait-countdown` / `wait-playing` / `wait-results` | Countdown visible / word+4 choices / `#results` (75s timeout) |
| `wait <ms>` | Sleep |
| `storage` / `clear-storage` | Read or `removeItem("satWordBlitz.v1")` then reload |
| `goto` | Navigate to the arcade URL |

A raw Playwright script may use the same handles. There is no in-repo Playwright config.

### Screens and handles

Three sections. The active one has class `is-active` and no `hidden`. The others have `hidden`.

| Surface | Handle | Notes |
|---|---|---|
| Home | `#home` | `aria-labelledby="title"` |
| Title | `#title` | Visible text SAT / WORD / BLITZ |
| Career stats | `[role=group][aria-label="Career stats"]` | Chips `#homeBest` `#homeCombo` `#homeGames` |
| PLAY | `#playBtn` | Accessible name `PLAY`. Enter or Space on home also starts |
| Play | `#play` | `#playStatus` is `aria-live="polite"` |
| SCORE / TIME / COMBO | `#scoreEl` `#timeEl` `#comboEl` | Combo text is `xN` or briefly `BROKE` |
| Countdown | `#countdown` `#countdownNum` | Sequence `3`, `2`, `1`, `BLITZ` (~550ms × 3 + 450ms ≈ 2.1s) |
| Word | `#wordEl` | Placeholder `—` until the round starts |
| Choices | `#choices` `[role=group][aria-label="Definition choices"]` | Four `button.choice` with `.key` `1`–`4` and `data-idx` |
| Feedback | `#feedback` | `aria-live="assertive"`. Miss: `MISS  —  {def}`. Combo shout at x5+ |
| Results | `#results` | `GAME OVER`, `#finalScore`, `#highNote`, `#comboNote`, `#hitCount` `#missCount` `#runCombo` |
| Missed words | `#missedWrap` `#missedList` | Hidden when the run had no misses |
| PLAY AGAIN / HOME | `#againBtn` `#homeBtn` | Enter/Space on results = play again |
| Mute | `#muteBtn` | `aria-label` `Mute sound` / `Unmute sound`, `aria-pressed`, text `SND` / `MUTED` |

### Timing that will fake a failure if you ignore it

- After PLAY, `#questionWrap` stays hidden until BLITZ finishes. Wait for `wait-playing`, not a fixed 500ms.
- A hit locks choices for **280ms**, then the next word replaces the board. Sample `.choice.correct`, `#scoreEl`, `#comboEl` **before** that swap (`key-correct` already waits 120ms).
- A miss locks for **900ms**, shows `MISS  —  {def}`, and if combo was ≥3, `#comboEl` reads `BROKE` for 400ms then `x0`.
- `#scoreEl` and `#finalScore` tween. Read them after ~250ms (hit) or ~800ms (results) if you need the settled number.
- A full round is **60s** after BLITZ (`ROUND_MS = 60000`). There is no debug URL to shorten it. `wait-results` is the wait.
- PLAY is disabled if `SAT_WORDS` is empty (`Word bank failed to load.` in `.howto`).

### Scoring (so you can assert)

Hit: `combo += 1`, `points = round((100 + speed) * (1 + (combo-1)*0.2))` where `speed = round(80 * (1 - min(elapsed_ms, 5000)/5000))`. First fast hit is about 160–180, combo `x1`. Miss: combo 0, no score change, word appended to the in-memory missed list and to `stats.weak`.

Mapped user paths: `features/README.md`.

## Evidence

Proof is a directory that still exists **after** cleanup. Default: `.cursor/skills/verify-sat-vocab-arcade/evidence/<UTC>-<feature>/`.

A pass needs all four:

1. **Real path** — home → PLAY → countdown → a live word with four choices (and further screens the feature names).
2. **Action + resulting state** — e.g. `key-correct` JSON plus a screenshot where `.choice.correct` is on, score > 0, combo `x1`.
3. **Side effects** — `localStorage` key `satWordBlitz.v1` (`highScore`, `longestCombo`, `gamesPlayed`, `weak`). Empty until a round **ends**. After results, `gamesPlayed` increments; a miss adds `weak[word] = { misses, streak }`. Home chips update on `#home` after `endRound` / HOME.
4. **Artifacts** — `notes.md`, `doctor.txt`, `launch.txt`, `state/*.json`, `shots/*.png`. Name shots after the step (`01-home`, `04-after-key`).

Skip only when doctor FAIL says the machine cannot run the arcade. Record the skip in `notes.md`. Do not skip because the 60s timer is long.

One-command proof of `features/answer-via-keyboard.md`:

```bash
.cursor/skills/verify-sat-vocab-arcade/scripts/prove.sh
```

## Cleanup

```bash
.cursor/skills/verify-sat-vocab-arcade/scripts/cleanup.sh
```

Kills only the PIDs written to `.verify-run/env`, and only if `/proc/<pid>/cmdline` still contains `http.server` or `remote-debugging-port=<CDP>`. Then deletes `.verify-run/` (chrome profile, logs, pid env).

Never delete `evidence/`. Never kill a foreign `python3 -m http.server` or some other Chrome. `SAT_VOCAB_KEEP_RUN=1` keeps the run dir.

If Drive or prove fails mid-run, run `cleanup.sh` before the next launch so 8000/9222 are not stranded. `prove.sh` already traps ERR and cleans up.

## Helpers

All scripts are executable. Run them from any cwd; they resolve the repo root themselves.

```bash
cd .cursor/skills/verify-sat-vocab-arcade
npm install                          # once per machine (puppeteer-core)
./scripts/launch.sh                  # HTTP 8000 + Chrome CDP 9222
./scripts/doctor.sh                  # read-only; prints PASS/FAIL, exit 1 on FAIL
./scripts/drive.mjs ready            # wait for home
./scripts/drive.mjs state            # JSON snapshot
./scripts/drive.mjs shot 01-home     # PNG
./scripts/cleanup.sh                 # kill only what launch.sh started
./scripts/prove.sh                   # launch → doctor → keyboard hit → evidence → cleanup
```

`prove.sh` writes `$SAT_VOCAB_EVIDENCE` (default `evidence/<UTC>-answer-via-keyboard/`), then cleans up, then lists the files that must still be on disk.
