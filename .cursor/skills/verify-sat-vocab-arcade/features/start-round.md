# Start a round

Pressing PLAY (or Enter/Space on the home cabinet) leaves `#home`, runs a 3-2-1-BLITZ countdown on `#play`, then reveals a SAT word and four definition buttons for a 60-second clock.

## Sub-features

- PLAY button (`#playBtn`) starts `startRound()` and shows `#play`.
- Enter or Space on the home screen starts the same path.
- Countdown text in `#countdownNum` is `3`, then `2`, then `1`, then `BLITZ`.
- After BLITZ, `#questionWrap` unhides, `#wordEl` is a bank word (not `—`), and `#choices` has four `button.choice` children labeled 1–4.
- HUD resets: `#scoreEl` is `0`, `#comboEl` is `x0`, `#timeEl` is `60` then starts dropping.

## How to get to it (user POV)

Open the arcade. The home screen says SAT WORD BLITZ, shows BEST / MAX COMBO / RUNS, and a PLAY button. Tap PLAY (or press Enter). A yellow countdown fills the cabinet. When it hits BLITZ the word and four definitions appear and TIME begins counting down from 60.

## Driving it with drive.mjs

Preconditions: `launch.sh` ready, `doctor.sh` OK, `drive.mjs ready` sees `#home` with `#playBtn` enabled. Optional: `clear-storage` so the home chips are zeros.

1. Confirm home.
   - Command: `node scripts/drive.mjs state`
   - Result: `state.screen` is `"home"`, `playHidden` is true, `homeBest` / `homeCombo` / `homeGames` are present, `playDisabled` is `false`.
2. Capture the cabinet.
   - Command: `node scripts/drive.mjs shot 01-home`
   - Result: PNG of SAT WORD BLITZ and PLAY.
3. Press PLAY.
   - Command: `node scripts/drive.mjs click-play`
   - Result: `{ "clicked": "#playBtn" }`. Equivalent user key: `node scripts/drive.mjs key Enter`.
4. Wait for the countdown overlay.
   - Command: `node scripts/drive.mjs wait-countdown`
   - Result: `state.screen` is `"play"`, `countdownHidden` is false, `countdown` is `3`, `2`, `1`, or `BLITZ`, `questionHidden` is true.
5. Wait until the first question is live.
   - Command: `node scripts/drive.mjs wait-playing`
   - Result: `questionHidden` is false, `word` is a non-empty string other than `—`, `choices.length` is 4, each choice has `key` `1`–`4` and a definition, `time` is a number ≤ 60, `playStatus` is `Define {word}`.
6. Screenshot the live board.
   - Command: `node scripts/drive.mjs shot 03-question`
   - Result: PNG with DEFINE, the word, and four definitions.

## Gotchas

- `#play` becomes visible immediately, but `#questionWrap` stays `hidden` through the whole countdown (~2.1s: 550ms × 3 + 450ms). Asserting `#wordEl` right after `click-play` still sees `—`.
- Enter/Space on home calls `startRound()` directly. Do not also click PLAY or you stack two countdowns.
- If `words.js` failed to load, `#playBtn` is disabled and `.howto` reads `Word bank failed to load.` Doctor catches an empty bank.
- `#timeEl` is `60` until `state.playing` flips at the end of BLITZ; do not treat a still-60 clock during countdown as a stuck timer.
