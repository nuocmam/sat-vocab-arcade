#!/usr/bin/env bash
# Prove the verify-sat-vocab-arcade skill: launch, doctor, drive answer-via-keyboard, evidence, cleanup.
set -euo pipefail
. "$(dirname "$0")/common.sh"

STAMP=$(date -u +%Y-%m-%dT%H%MZ)
EVIDENCE="${SAT_VOCAB_EVIDENCE:-$SKILL_DIR/evidence/${STAMP}-answer-via-keyboard}"
export SAT_VOCAB_EVIDENCE="$EVIDENCE"
mkdir -p "$EVIDENCE/shots" "$EVIDENCE/state"

DRIVE="$SCRIPT_DIR/drive.mjs"
cleaned=0

cleanup_now() {
  if [[ "$cleaned" -eq 1 ]]; then
    return 0
  fi
  cleaned=1
  "$SCRIPT_DIR/cleanup.sh" || true
}

on_err() {
  echo "PROVE_FAIL — running cleanup" >&2
  cleanup_now
  echo "Evidence dir (left on disk): $EVIDENCE" >&2
  exit 1
}
trap on_err ERR

if [[ ! -d "$SKILL_DIR/node_modules/puppeteer-core" ]]; then
  echo "Installing puppeteer-core in $SKILL_DIR"
  (cd "$SKILL_DIR" && npm install)
fi

"$SCRIPT_DIR/launch.sh" | tee "$EVIDENCE/launch.txt"
"$SCRIPT_DIR/doctor.sh" | tee "$EVIDENCE/doctor.txt"

node "$DRIVE" ready | tee "$EVIDENCE/state/00-ready.json"
node "$DRIVE" clear-storage | tee "$EVIDENCE/state/01-cleared.json"
node "$DRIVE" shot 01-home
node "$DRIVE" state | tee "$EVIDENCE/state/02-home.json"

node "$DRIVE" click-play | tee "$EVIDENCE/state/03-click-play.json"
node "$DRIVE" wait-countdown | tee "$EVIDENCE/state/04-countdown.json"
node "$DRIVE" shot 02-countdown

node "$DRIVE" wait-playing | tee "$EVIDENCE/state/05-question.json"
node "$DRIVE" shot 03-question

# Same CDP session: the 280ms hit lock is gone if we reconnect for a shot.
node "$DRIVE" --shot 04-after-key key-correct | tee "$EVIDENCE/state/06-after-key.json"

# Next question lands 280ms after a hit; sample it.
node "$DRIVE" wait 400
node "$DRIVE" state | tee "$EVIDENCE/state/07-next-question.json"
node "$DRIVE" shot 05-next-question

python3 - "$EVIDENCE" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
def load(name):
    return json.loads((root / "state" / name).read_text())

home = load("02-home.json")["state"]
q = load("05-question.json")["state"]
hit = load("06-after-key.json")
after = hit["state"]
nxt = load("07-next-question.json")["state"]

score = int(after["score"] or 0)
combo = after["combo"]
has_correct = any("correct" in (c.get("className") or "") for c in after["choices"])
next_word = nxt["word"]
prev_word = hit.get("word") or q["word"]

lines = []
lines.append("# Proof: answer via keyboard")
lines.append("")
lines.append("Feature file: `features/answer-via-keyboard.md`")
lines.append("")
lines.append("## Actions")
lines.append("")
lines.append("1. `launch.sh` — HTTP + Chrome CDP")
lines.append("2. `doctor.sh` — read-only health")
lines.append("3. `drive.mjs clear-storage` — empty `satWordBlitz.v1`")
lines.append("4. `drive.mjs click-play` then `wait-countdown` then `wait-playing`")
lines.append("5. `drive.mjs key-correct` — press the 1–4 key for the right definition")
lines.append("")
lines.append("## Observed")
lines.append("")
lines.append(f"- Home BEST/MAX COMBO/RUNS: {home.get('homeBest')}/{home.get('homeCombo')}/{home.get('homeGames')}")
lines.append(f"- First word: `{q.get('word')}` with {len(q.get('choices') or [])} choices")
lines.append(f"- Key pressed: `{hit.get('key')}` for `{hit.get('def')}`")
lines.append(f"- After key: score={after.get('score')} combo={combo} correct_class={has_correct}")
lines.append(f"- Next word: `{next_word}` (was `{prev_word}`)")
lines.append("")
lines.append("## Pass checks")
lines.append("")
checks = [
    (home.get("screen") == "home", "home screen before PLAY"),
    (q.get("screen") == "play" and q.get("word") not in (None, "", "—"), "question showing after countdown"),
    (len(q.get("choices") or []) == 4, "four definition buttons"),
    (score > 0, "score increased after correct key"),
    (combo == "x1", "combo is x1 after first hit"),
    (has_correct, ".choice.correct present immediately after the key"),
    (next_word not in (None, "", "—") and next_word != prev_word, "next question replaced the word"),
]
ok = True
for passed, label in checks:
    lines.append(f"- {'PASS' if passed else 'FAIL'}: {label}")
    ok = ok and passed
(root / "notes.md").write_text("\n".join(lines) + "\n")
if not ok:
    raise SystemExit("proof checks failed; see notes.md")
print("\n".join(lines))
PY

cleanup_now

echo "---- after cleanup ----"
if [[ -d "$SKILL_DIR/.verify-run" ]]; then
  echo "WARN run dir still present: $SKILL_DIR/.verify-run"
else
  echo "PASS run dir removed"
fi
if port_in_use "$BIND" "$PORT"; then
  echo "WARN port $PORT still listening"
else
  echo "PASS port $PORT is free"
fi

missing=0
for f in notes.md doctor.txt launch.txt shots/01-home.png shots/02-countdown.png shots/03-question.png shots/04-after-key.png shots/05-next-question.png state/06-after-key.json; do
  if [[ -f "$EVIDENCE/$f" ]]; then
    echo "EVIDENCE $EVIDENCE/$f"
  else
    echo "MISSING $EVIDENCE/$f"
    missing=1
  fi
done
if [[ "$missing" -ne 0 ]]; then
  echo "PROVE_FAIL evidence missing after cleanup"
  exit 1
fi
echo "PROVE_OK $EVIDENCE"
