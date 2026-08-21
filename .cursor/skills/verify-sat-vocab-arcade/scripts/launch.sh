#!/usr/bin/env bash
# Start SAT Word Blitz (python http.server) and a Chrome CDP session.
set -euo pipefail
. "$(dirname "$0")/common.sh"
load_run_env

if [[ -z "$CHROME_BIN" ]]; then
  echo "FAIL: no Chrome/Chromium on PATH (set SAT_VOCAB_CHROME)" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "FAIL: python3 is required" >&2
  exit 1
fi

if pid_alive "${SAT_VOCAB_HTTP_PID:-}" && pid_alive "${SAT_VOCAB_CHROME_PID:-}"; then
  echo "ALREADY_RUNNING $URL"
  echo "CDP $CDP_URL"
  echo "ENV $ENV_FILE"
  exit 0
fi

if port_in_use "$BIND" "$PORT"; then
  echo "FAIL: $BIND:$PORT is already in use. Pick SAT_VOCAB_PORT or stop the other http.server" >&2
  exit 1
fi
if port_in_use 127.0.0.1 "$CDP"; then
  echo "FAIL: 127.0.0.1:$CDP is already in use. Pick SAT_VOCAB_CDP or run cleanup.sh" >&2
  exit 1
fi

mkdir -p "$RUN_DIR"
: > "$RUN_DIR/http.log"
: > "$RUN_DIR/chrome.log"

# Redirect in the command so nohup does not swallow the log path.
nohup python3 -m http.server "$PORT" --bind "$BIND" \
  >"$RUN_DIR/http.log" 2>&1 &
SAT_VOCAB_HTTP_PID=$!
disown "$SAT_VOCAB_HTTP_PID" 2>/dev/null || true
write_run_env

ready=0
for _ in $(seq 1 50); do
  if ! pid_alive "$SAT_VOCAB_HTTP_PID"; then
    echo "FAIL: http.server pid $SAT_VOCAB_HTTP_PID exited. See $RUN_DIR/http.log" >&2
    cat "$RUN_DIR/http.log" >&2 || true
    exit 1
  fi
  if curl -sf "$URL" | grep -q "SAT Word Blitz"; then
    ready=1
    break
  fi
  sleep 0.1
done
if [[ "$ready" -ne 1 ]]; then
  echo "FAIL: $URL never served SAT Word Blitz. See $RUN_DIR/http.log" >&2
  exit 1
fi

PROFILE="$RUN_DIR/chrome-profile"
rm -rf "$PROFILE"
mkdir -p "$PROFILE"

chrome_args=(
  --remote-debugging-address=127.0.0.1
  --remote-debugging-port="$CDP"
  --user-data-dir="$PROFILE"
  --no-first-run
  --no-default-browser-check
  --disable-extensions
  --disable-dev-shm-usage
  --disable-gpu
  --mute-audio
  --window-size=390,844
  --hide-scrollbars
)
if [[ "${SAT_VOCAB_HEADED:-}" != "1" ]]; then
  chrome_args+=(--headless=new --no-sandbox)
else
  chrome_args+=(--no-sandbox)
fi

nohup "$CHROME_BIN" "${chrome_args[@]}" "$URL" \
  >"$RUN_DIR/chrome.log" 2>&1 &
SAT_VOCAB_CHROME_PID=$!
disown "$SAT_VOCAB_CHROME_PID" 2>/dev/null || true
write_run_env

cdp_ready=0
for _ in $(seq 1 80); do
  if curl -sf "$CDP_URL/json/version" >/dev/null; then
    cdp_ready=1
    break
  fi
  if ! pid_alive "$SAT_VOCAB_CHROME_PID"; then
    echo "FAIL: Chrome exited. See $RUN_DIR/chrome.log" >&2
    cat "$RUN_DIR/chrome.log" >&2 || true
    exit 1
  fi
  sleep 0.1
done
if [[ "$cdp_ready" -ne 1 ]]; then
  echo "FAIL: CDP $CDP_URL/json/version never came up. See $RUN_DIR/chrome.log" >&2
  exit 1
fi

echo "READY $URL"
echo "CDP $CDP_URL"
echo "HTTP_PID $SAT_VOCAB_HTTP_PID"
echo "CHROME_PID $SAT_VOCAB_CHROME_PID"
echo "ENV $ENV_FILE"
echo "Ready signal: HTTP 200 from $URL whose HTML contains <title>SAT Word Blitz"
