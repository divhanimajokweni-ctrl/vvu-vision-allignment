#!/usr/bin/env bash
# Persist the Kilo CLI and its config/auth inside the project so a Repl restart does not wipe them.
# Run from the project root:  bash persist-kilo.sh
# Re-running is safe. Uses the npm install route documented by Kilo (npm install -g @kilocode/cli),
# with the npm prefix redirected into the workspace, so no installer-script flags are guessed.
set -euo pipefail

ROOT="$(pwd -P)"
TOOLS="$ROOT/.tools"
mkdir -p "$TOOLS/npm" "$TOOLS/xdg/config" "$TOOLS/xdg/data" "$TOOLS/xdg/cache" "$TOOLS/xdg/state"

# 1. Keep credentials out of git. Kilo auth and config will live under .tools/.
touch "$ROOT/.gitignore"
grep -qxF ".tools/" "$ROOT/.gitignore" || echo ".tools/" >> "$ROOT/.gitignore"

# 2. Environment for this shell and for every future shell that sources the file.
cat > "$TOOLS/env.sh" <<ENV
export XDG_CONFIG_HOME="$TOOLS/xdg/config"
export XDG_DATA_HOME="$TOOLS/xdg/data"
export XDG_CACHE_HOME="$TOOLS/xdg/cache"
export XDG_STATE_HOME="$TOOLS/xdg/state"
export NPM_CONFIG_PREFIX="$TOOLS/npm"
export PATH="$TOOLS/npm/bin:\$PATH"
ENV
# shellcheck disable=SC1091
source "$TOOLS/env.sh"

# 3. Install once; skip if already present.
if ! command -v kilo >/dev/null 2>&1; then
  npm install -g @kilocode/cli
fi

echo
echo "kilo resolves to: $(command -v kilo || echo 'NOT FOUND')"
kilo --version || true
echo
echo "Add this line to ~/.bashrc, or run it at the start of each shell, so new shells pick it up:"
echo "  source $TOOLS/env.sh"
echo
echo "For non-shell processes, paste literal values into the [env] block of .replit (it does not expand variables):"
echo "  [env]"
echo "  XDG_CONFIG_HOME = \"$TOOLS/xdg/config\""
echo "  XDG_DATA_HOME = \"$TOOLS/xdg/data\""
echo "  XDG_CACHE_HOME = \"$TOOLS/xdg/cache\""
echo "  XDG_STATE_HOME = \"$TOOLS/xdg/state\""
echo
echo "After sign-in, confirm state really landed in the workspace:  find $TOOLS/xdg -type f | head"
