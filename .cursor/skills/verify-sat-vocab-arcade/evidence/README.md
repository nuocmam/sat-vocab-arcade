# Proof artifacts

Each run of `scripts/prove.sh` writes a directory named `<UTC>-answer-via-keyboard/` (or `$SAT_VOCAB_EVIDENCE` if set).

Canonical run on this branch: [`2026-08-21T1144Z-answer-via-keyboard/`](2026-08-21T1144Z-answer-via-keyboard/).

That directory still existed after `cleanup.sh` removed `.verify-run/` and freed port 8000. It contains:

- `notes.md` — PLAY → countdown → `tenacious` → key `1` → score 126 / combo x1 / `.choice.correct` → next word `respite`
- `launch.txt` / `doctor.txt`
- `state/*.json` — `drive.mjs` snapshots (see `06-after-key.json` for the graded board)
- `shots/*.png` — home, countdown `3`, unanswered `tenacious`, green HIT on choice 1, then `respite`

`cleanup.sh` must not delete this folder. If the newest run is missing, the skill was not proved.
