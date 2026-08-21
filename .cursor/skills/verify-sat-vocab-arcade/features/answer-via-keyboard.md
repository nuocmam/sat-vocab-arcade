# Answer via keyboard

During a live question, keys `1`–`4` and `A`–`D` pick the matching `.choice` by index. A right key paints that button `.correct`, adds score, and bumps combo; a wrong key paints `.wrong`, shows the real definition in `#feedback`, and dumps combo.

## Sub-features

- `1` / `a` → index 0, `2` / `b` → 1, `3` / `c` → 2, `4` / `d` → 3 (`app.js` `KEYS` + `LETTERS`).
- Correct: clicked/keyed button gets `.correct` (and `::after` “✓ HIT”), others `.dim`; `#scoreEl` rises; `#comboEl` becomes `xN`.
- Wrong: keyed button gets `.wrong` (“✕ MISS”), the true option still gets `.correct`; `#feedback` is `MISS  —  {def}`.
- Keys are ignored while `state.locked` (the 280ms / 900ms pause) and while countdown is still running (`state.playing` is false).
- Mouse path is the same grading: `answer-correct` / `answer-wrong` click `.choice` instead of sending a key.

## How to get to it (user POV)

From home, hit PLAY and wait out 3-2-1-BLITZ. Read the word under DEFINE. Press the number (or letter) next to the matching definition. The chosen row flashes green or red, then the next word replaces it.

## Driving it with drive.mjs

Preconditions: baseline from `features/README.md`, then the start-round path through `wait-playing` so `state.word !== "—"` and four choices exist. Prefer `clear-storage` first so score starts at 0.

1. Snapshot the unanswered question.
   - Command: `node scripts/drive.mjs state`
   - Result: `screen` is `"play"`, `choices.length` is 4, every choice `disabled` is false, `score` is `"0"`, `combo` is `"x0"`.
2. Screenshot the unanswered board.
   - Command: `node scripts/drive.mjs shot 03-question`
   - Result: PNG of the word and four enabled definitions.
3. Press the correct number key.
   - Command: `node scripts/drive.mjs key-correct`
   - Result: JSON includes `key` (`"1"`–`"4"`), `word`, `def`. `state.choices` has one `className` containing `correct`. `state.score` is an integer string > 0. `state.combo` is `"x1"`. `state.feedback` is empty on a first hit (shouts start at combo ≥ 5).
4. Screenshot the graded board immediately.
   - Command: `node scripts/drive.mjs shot 04-after-key`
   - Result: PNG still showing the same word with a green HIT row. Take this before 280ms elapses; `key-correct` already waited 120ms.
5. Wait for the next prompt.
   - Command: `node scripts/drive.mjs wait 400` then `node scripts/drive.mjs state`
   - Result: `word` is a different SAT word, four new enabled choices, score still ≥ the post-hit value.
6. Optional — prove a miss with a letter key.
   - Command: `node scripts/drive.mjs key-wrong` (or `node scripts/drive.mjs key a` after you know index 0 is wrong)
   - Result: one choice has `wrong` in `className`, `feedback` starts with `MISS  —  `, `combo` is `"x0"` (or `"BROKE"` if combo was ≥ 3).

`prove.sh` runs steps 1–5 as the canonical proof of this feature.

## Gotchas

- `key 1` always picks the first button, not “the right answer”. Use `key-correct` unless you have just read `state.choices` and know the index.
- The correct definition is `window.SAT_WORDS` entry whose `w` equals `#wordEl`. Compare the second `<span>` text, not `innerText` (that also includes the `1`–`4` key glyph).
- Sampling after 280ms on a hit (900ms on a miss) is the *next* question — `.correct` / `.wrong` will be gone.
- Modifier keys are ignored (`meta` / `ctrl` / `alt`). Numpad keys send `1`–`4` the same as the top row in Chrome.
- `A`–`D` are matched case-insensitively. Do not send `Digit1` vs `1` confusion: `drive.mjs key 1` presses `"1"`, which is what `onKey` reads.
