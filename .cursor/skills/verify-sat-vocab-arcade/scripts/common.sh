# Shared paths and env for SAT Word Blitz verification helpers.
# Source from scripts in this directory:  . "$(dirname "$0")/common.sh"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" && pwd)
SKILL_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$SKILL_DIR/../../.." && pwd)
RUN_DIR="${SAT_VOCAB_RUN_DIR:-$SKILL_DIR/.verify-run}"
ENV_FILE="$RUN_DIR/env"

PORT="${SAT_VOCAB_PORT:-8000}"
CDP="${SAT_VOCAB_CDP:-9222}"
BIND="${SAT_VOCAB_BIND:-127.0.0.1}"
URL="http://${BIND}:${PORT}/"
CDP_URL="http://127.0.0.1:${CDP}"
CHROME_BIN="${SAT_VOCAB_CHROME:-}"
EVIDENCE_DIR="${SAT_VOCAB_EVIDENCE:-}"

if [[ -z "$CHROME_BIN" ]]; then
  if command -v google-chrome >/dev/null 2>&1; then
    CHROME_BIN=$(command -v google-chrome)
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    CHROME_BIN=$(command -v google-chrome-stable)
  elif command -v chromium >/dev/null 2>&1; then
    CHROME_BIN=$(command -v chromium)
  elif [[ -x /usr/bin/google-chrome ]]; then
    CHROME_BIN=/usr/bin/google-chrome
  fi
fi

load_run_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
    PORT="${SAT_VOCAB_PORT:-$PORT}"
    CDP="${SAT_VOCAB_CDP:-$CDP}"
    BIND="${SAT_VOCAB_BIND:-$BIND}"
    URL="${SAT_VOCAB_URL:-http://${BIND}:${PORT}/}"
    CDP_URL="${SAT_VOCAB_CDP_URL:-http://127.0.0.1:${CDP}}"
  fi
}

pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" && -d "/proc/$pid" ]]
}

pid_cmdline() {
  local pid="${1:-}"
  if pid_alive "$pid"; then
    tr '\0' ' ' < "/proc/$pid/cmdline"
  fi
}

safe_kill() {
  local pid="${1:-}"
  local needle="${2:-}"
  if ! pid_alive "$pid"; then
    return 0
  fi
  local cmd
  cmd=$(pid_cmdline "$pid")
  if [[ -n "$needle" && "$cmd" != *"$needle"* ]]; then
    echo "skip kill pid=$pid (cmdline does not match $needle)" >&2
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if ! pid_alive "$pid"; then
      return 0
    fi
    sleep 0.1
  done
  kill -9 "$pid" 2>/dev/null || true
}

write_run_env() {
  mkdir -p "$RUN_DIR"
  cat > "$ENV_FILE" <<EOF
SAT_VOCAB_PORT=$PORT
SAT_VOCAB_CDP=$CDP
SAT_VOCAB_BIND=$BIND
SAT_VOCAB_URL=$URL
SAT_VOCAB_CDP_URL=$CDP_URL
SAT_VOCAB_HTTP_PID=${SAT_VOCAB_HTTP_PID:-}
SAT_VOCAB_CHROME_PID=${SAT_VOCAB_CHROME_PID:-}
SAT_VOCAB_REPO_ROOT=$REPO_ROOT
SAT_VOCAB_SKILL_DIR=$SKILL_DIR
SAT_VOCAB_RUN_DIR=$RUN_DIR
SAT_VOCAB_CHROME=$CHROME_BIN
SAT_VOCAB_PROFILE=$RUN_DIR/chrome-profile
EOF
}

# True when a process is LISTENING on host:port.
# Bind() is the wrong test here: TIME_WAIT leftovers from curl make bind
# fail even when nothing is accepting (ss is also missing on this image).
port_in_use() {
  local host="$1"
  local port="$2"
  python3 - "$host" "$port" <<'PY'
import socket, sys
host, port = sys.argv[1], int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(0.4)
try:
    s.connect((host, port))
except ConnectionRefusedError:
    sys.exit(1)
except OSError:
    sys.exit(1)
else:
    sys.exit(0)
finally:
    s.close()
PY
}

