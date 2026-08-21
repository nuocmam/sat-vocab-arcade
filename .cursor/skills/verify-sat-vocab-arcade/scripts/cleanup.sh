#!/usr/bin/env bash
# Stop only the http.server and Chrome this skill launched. Never delete evidence/.
set -euo pipefail
. "$(dirname "$0")/common.sh"
load_run_env

if [[ ! -f "$ENV_FILE" ]]; then
  echo "NOTHING_TO_CLEAN (no $ENV_FILE)"
  echo "Evidence dirs under $SKILL_DIR/evidence/ are left untouched."
  exit 0
fi

http_pid="${SAT_VOCAB_HTTP_PID:-}"
chrome_pid="${SAT_VOCAB_CHROME_PID:-}"

safe_kill "$http_pid" "http.server"
safe_kill "$chrome_pid" "remote-debugging-port=${CDP}"

if [[ "${SAT_VOCAB_KEEP_RUN:-}" != "1" ]]; then
  rm -rf "$RUN_DIR"
  echo "REMOVED_RUN_DIR $RUN_DIR"
else
  echo "KEPT_RUN_DIR $RUN_DIR"
fi

echo "CLEANED http_pid=$http_pid chrome_pid=$chrome_pid"
echo "Evidence under $SKILL_DIR/evidence/ was not deleted."
