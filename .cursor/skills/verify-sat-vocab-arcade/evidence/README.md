# Proof artifacts

Each run of `scripts/prove.sh` writes a directory named `<UTC>-answer-via-keyboard/` (or `$SAT_VOCAB_EVIDENCE` if set).

A finished directory keeps:

- `notes.md` — actions, observed HUD, PASS/FAIL checks
- `launch.txt` / `doctor.txt`
- `state/*.json` — `drive.mjs` snapshots
- `shots/*.png` — home, countdown, question, after-key, next question

`cleanup.sh` must not delete this folder. If the newest run is missing, the skill was not proved.
