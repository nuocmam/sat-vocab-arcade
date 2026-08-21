#!/usr/bin/env bash
# Read-only health check for SAT Word Blitz verification.
set -euo pipefail
. "$(dirname "$0")/common.sh"
load_run_env

fail=0
pass() { echo "PASS  $*"; }
warn() { echo "WARN  $*"; }
bad()  { echo "FAIL  $*"; fail=1; }

echo "REPO $REPO_ROOT"
echo "SKILL $SKILL_DIR"

for f in index.html app.js styles.css words.js favicon.svg .nojekyll; do
  if [[ -f "$REPO_ROOT/$f" ]]; then
    pass "file $f"
  else
    bad "missing $f"
  fi
done

if command -v python3 >/dev/null 2>&1; then
  pass "python3 $(python3 --version 2>&1)"
else
  bad "python3 not on PATH"
fi

if [[ -n "$CHROME_BIN" && -x "$CHROME_BIN" ]]; then
  pass "chrome $CHROME_BIN $($CHROME_BIN --version 2>/dev/null | head -1)"
else
  bad "Chrome/Chromium not found (set SAT_VOCAB_CHROME)"
fi

if command -v node >/dev/null 2>&1; then
  pass "node $(node --version)"
else
  bad "node not on PATH (needed for drive.mjs)"
fi

if [[ -d "$SKILL_DIR/node_modules/puppeteer-core" ]]; then
  pass "puppeteer-core installed"
else
  warn "puppeteer-core missing — run: cd $SKILL_DIR && npm install"
fi

if grep -q 'STORAGE_KEY = "satWordBlitz.v1"' "$REPO_ROOT/app.js"; then
  pass "localStorage key satWordBlitz.v1"
else
  bad "STORAGE_KEY satWordBlitz.v1 not found in app.js"
fi

if grep -q 'id="playBtn"' "$REPO_ROOT/index.html" && grep -q 'id="wordEl"' "$REPO_ROOT/index.html"; then
  pass "stable ids playBtn wordEl choices results"
else
  bad "expected ids missing from index.html"
fi

word_count=$(node --input-type=module -e "
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
const words = ctx.window.SAT_WORDS || [];
if (!words.length) { console.error('empty'); process.exit(2); }
const uniq = new Set(words.map((w) => w.w));
console.log(words.length + ' unique=' + uniq.size);
" "$REPO_ROOT/words.js" 2>/dev/null || true)
if [[ -n "$word_count" && "$word_count" != empty ]]; then
  pass "word bank $word_count"
else
  bad "words.js did not evaluate to window.SAT_WORDS"
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "LAUNCHED env=$ENV_FILE"
  if pid_alive "${SAT_VOCAB_HTTP_PID:-}"; then
    pass "http.server pid=${SAT_VOCAB_HTTP_PID} $(pid_cmdline "$SAT_VOCAB_HTTP_PID")"
  else
    bad "http.server pid ${SAT_VOCAB_HTTP_PID:-unset} is not running"
  fi
  if pid_alive "${SAT_VOCAB_CHROME_PID:-}"; then
    pass "chrome pid=${SAT_VOCAB_CHROME_PID}"
  else
    bad "chrome pid ${SAT_VOCAB_CHROME_PID:-unset} is not running"
  fi
  if curl -sf "$URL" | grep -q "SAT Word Blitz"; then
    pass "GET $URL contains SAT Word Blitz"
  else
    bad "GET $URL is not the arcade"
  fi
  for asset in app.js words.js styles.css favicon.svg; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$URL$asset" || true)
    if [[ "$code" == "200" ]]; then
      pass "GET $asset $code"
    else
      bad "GET $asset -> $code"
    fi
  done
  if curl -sf "$CDP_URL/json/version" >/dev/null; then
    pass "CDP $CDP_URL/json/version"
  else
    bad "CDP $CDP_URL/json/version not reachable"
  fi
else
  echo "IDLE (no launch env). Ports default to HTTP $PORT and CDP $CDP."
  if port_in_use "$BIND" "$PORT"; then
    warn "port $PORT is in use by something else"
  else
    pass "port $PORT is free"
  fi
  if port_in_use 127.0.0.1 "$CDP"; then
    warn "port $CDP is in use by something else"
  else
    pass "port $CDP is free"
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  echo "DOCTOR_FAIL"
  exit 1
fi
echo "DOCTOR_OK"
