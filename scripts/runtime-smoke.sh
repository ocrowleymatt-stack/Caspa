#!/usr/bin/env bash
# CASPA runtime smoke dispatcher — fast by default, full with --full.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
CASPA runtime smoke

  bash scripts/runtime-smoke.sh            Run fast smoke (default, seconds)
  bash scripts/runtime-smoke.sh --fast     Run fast smoke
  bash scripts/runtime-smoke.sh --full     Run full authenticated AI workflow (~8 min)
  bash scripts/runtime-smoke.sh --help     Show this help

Fast smoke checks health, doctor, auth, Ollama tags, port 3000, and PM2.
Full smoke runs the Phase 13 authenticated workflow (imports, Pier, Gold, NWP, etc.).
EOF
}

case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  --full)
    exec bash "$SCRIPT_DIR/runtime-smoke-full.sh"
    ;;
  --fast|"")
    exec bash "$SCRIPT_DIR/runtime-smoke-fast.sh"
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 1
    ;;
esac
