#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# VVU 72-Hour Full Validation Orchestrator
# ═══════════════════════════════════════════════════════════════════════════
#
# Runs the complete 72-hour validation with:
#   - Gaussian noise model training
#   - Predictive watchdog (24h baseline)
#   - Red Team (attacks)
#   - Purple Team (adaptive defense)
#   - SWAT PKTT (circuit breaker nukes)
#   - 72-hour worst-case resilience simulation
#   - Photorealistic quality scoring
#   - Offline/online capability testing
#   - Branded report generation
#
# Usage:
#   ./validation/scripts/run-72h-validation.sh [--duration 72] [--max-loops 500000]
#
# The process runs 3 daemon processes:
#   1. Red Team Daemon (attacks)
#   2. Purple Team Daemon (defense)
#   3. SWAT PKTT Daemon (circuit breaker nukes)
#
# Plus the main simulation loop that orchestrates everything.

set -euo pipefail

VALIDATION_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$(cd "$VALIDATION_DIR/.." && pwd)"
DURATION="${1:-72}"
MAX_LOOPS="${2:-500000}"
TIMESTAMP=$(date -u '+%Y%m%d_%H%M%S')
RESULTS_DIR="$VALIDATION_DIR/results/72h-$TIMESTAMP"

mkdir -p "$RESULTS_DIR"/{logs,metrics,reports,daemons}

# ─── Start Daemons ───────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════════"
echo "  VVU 72-Hour Full Validation"
echo "  Duration: ${DURATION}h | Max loops: ${MAX_LOOPS}"
echo "  Started: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "═══════════════════════════════════════════════════════════════"

# Daemon 1: Red Team
echo "[Daemon 1] Starting Red Team (attacks)..."
python3 "$VALIDATION_DIR/scripts/red-team-daemon.py" \
    --intensity 0.5 \
    --output "$RESULTS_DIR/daemons/red-team.jsonl" \
    > "$RESULTS_DIR/logs/red-team.log" 2>&1 &
RED_PID=$!
echo "  Red Team PID: $RED_PID"

# Daemon 2: Purple Team
echo "[Daemon 2] Starting Purple Team (defense)..."
python3 "$VALIDATION_DIR/scripts/purple-team-daemon.py" \
    --output "$RESULTS_DIR/daemons/purple-team.jsonl" \
    > "$RESULTS_DIR/logs/purple-team.log" 2>&1 &
PURPLE_PID=$!
echo "  Purple Team PID: $PURPLE_PID"

# Daemon 3: SWAT PKTT
echo "[Daemon 3] Starting SWAT PKTT (circuit breaker nukes)..."
python3 "$VALIDATION_DIR/scripts/swat-pktt-daemon.py" \
    --threshold 0.95 \
    --output "$RESULTS_DIR/daemons/swat-pktt.jsonl" \
    > "$RESULTS_DIR/logs/swat-pktt.log" 2>&1 &
SWAT_PID=$!
echo "  SWAT PKTT PID: $SWAT_PID"

# ─── Main Simulation ─────────────────────────────────────────────────────────
echo ""
echo "[Main] Starting 72-hour resilience simulation..."
python3 "$VALIDATION_DIR/scripts/resilience-sim.py" \
    --duration "$DURATION" \
    --max-loops "$MAX_LOOPS" \
    --output "$RESULTS_DIR" \
    > "$RESULTS_DIR/logs/simulation.log" 2>&1 &
SIM_PID=$!
echo "  Simulation PID: $SIM_PID"

# ─── Monitor ─────────────────────────────────────────────────────────────────
echo ""
echo "Monitoring... (Ctrl+C to stop)"
echo "Logs: $RESULTS_DIR/logs/"
echo ""

# Wait for simulation to complete
wait $SIM_PID
SIM_EXIT=$?

# ─── Stop Daemons ────────────────────────────────────────────────────────────
echo ""
echo "Stopping daemons..."
kill $RED_PID $PURPLE_PID $SWAT_PID 2>/dev/null || true
wait $RED_PID $PURPLE_PID $SWAT_PID 2>/dev/null || true

# ─── Generate Branded Report ─────────────────────────────────────────────────
echo ""
echo "Generating branded report..."
python3 "$VALIDATION_DIR/scripts/generate-branded-report.py" \
    --results "$RESULTS_DIR" \
    --output "$RESULTS_DIR/reports/VVU_72H_VALIDATION_REPORT.md" \
    2>&1 | tail -5

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  72-HOUR VALIDATION COMPLETE"
echo "  Exit code: $SIM_EXIT"
echo "  Results: $RESULTS_DIR"
echo "═══════════════════════════════════════════════════════════════"

exit $SIM_EXIT