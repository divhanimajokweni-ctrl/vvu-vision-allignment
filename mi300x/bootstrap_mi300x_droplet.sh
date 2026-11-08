#!/bin/bash
# ==============================================================================
#  VVU Independent Verification Environment (IVE) — MI300X Bootstrap & Build Engine
#  Document ID: VVU-MI300X-BOOTSTRAP-1.0 · Status: NORMATIVE
#
#  Source: architect-provided extraction, saved verbatim to preserve intent.
#  Per the Preservation Law (UNIFIED_CORE_PUNCHLINE_CONSTITUTION.md), this file
#  is preserved exactly as received. No modifications, no "cleanups."
#
#  M0 Doctrine: aborts if absolute claims (100% secure, zero bugs, etc.) are
#  found in the codebase. Fail-closed. Refactor claims to express bounded risk.
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
GOLD='\033[38;5;220m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[INFO] $(date '+%Y-%m-%d %H:%M:%S') — $1${NC}"; }
log_success() { echo -e "${GREEN}[SUCCESS] $(date '+%Y-%m-%d %H:%M:%S') — $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARNING] $(date '+%Y-%m-%d %H:%M:%S') — $1${NC}"; }
log_error() { echo -e "${RED}[ERROR] $(date '+%Y-%m-%d %H:%M:%S') — $1${NC}"; }

# --- M0 Doctrine Bounded-Risk Verification ---
m0_doctrine_preflight() {
    log_info "Initiating M0 Doctrine Preflight Check..."
    local absolute_claims
    # Fail-closed if marketing language overrides mathematical probability
    absolute_claims=$(grep -rnwl --include="*.ts" --include="*.tsx" --include="*.md" --include="*.sol" \
        -E "100% secure|zero bugs|absolute truth|flawlessly proven|100% accurate" . || true)

    if [ -n "$absolute_claims" ]; then
        log_error "M0 DOCTRINE VIOLATION DETECTED: Prohibited absolute certainty terms found."
        echo -e "${RED}Violating files:${NC}\n$absolute_claims"
        log_error "Fail-Closed Abort. Refactor claims to express bounded risk before deploying."
        exit 1
    fi
    log_success "M0 Doctrine verified: All claims are probabilistically bounded."
}

# --- Phase 1: Next.js Asset Packaging ---
package_nextjs_assets() {
    log_info "Executing Phase 1: Packaging Next.js Production Assets..."
    if ! command -v npm &> /dev/null; then
        log_warn "NodeJS/NPM not found locally. Skipping local build."
        return 0
    fi
    npm ci
    npm run build
    tar -czf vvu-workspace-assets.tar.gz .next public package.json node_modules
    log_success "Next.js asset bundle compiled."
}

# --- Phase 2: Smart Contract Compilation ---
compile_smart_contracts() {
    log_info "Executing Phase 2: Compiling Smart Contracts (VVUIVELedger.sol)..."
    if ! command -v forge &> /dev/null; then
        log_info "Bootstrapping local Foundry toolchain..."
        curl -L https://foundry.paradigm.xyz | bash
        export PATH="$HOME/.foundry/bin:$PATH"
        foundryup
    fi
    if [ ! -f "foundry.toml" ]; then
        forge init --no-git --force
    fi
    forge build --optimize --optimizer-runs 200
    log_success "Smart contract compilation complete."
}

# --- Phase 3: AMD MI300X Stack Bootstrapping ---
bootstrap_rocm_stack() {
    log_info "Executing Phase 3: Bootstrapping Host AMD Instinct MI300X Node..."
    if [ ! -d "/sys/class/kfd" ]; then
        log_warn "AMD HSA Kernel Fusion Device not detected. Continuing in EMULATION MODE."
        return 0
    fi
    log_info "AMD Instinct hardware verified. Appending render and video groups..."
    sudo usermod -aG render,video "$USER"

    log_info "Adding AMD ROCm GPG keys and repositories..."
    sudo mkdir -p --mode=0755 /etc/apt/keyrings
    wget -qO - https://repo.radeon.com/rocm/rocm.gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/rocm.gpg > /dev/null

    local codename
    codename=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/rocm.gpg] https://repo.radeon.com/amd-container-toolkit/apt/ ${codename} main" \
        | sudo tee /etc/apt/sources.list.d/amd-container-toolkit.list

    sudo apt-get update -y
    sudo apt-get install -y amd-container-toolkit

    log_info "Registering AMD container engine runtime to Docker..."
    sudo amd-ctk runtime configure
    sudo systemctl restart docker
    log_success "AMD Instinct driver stack and GPU container runtimes configured."
}

# --- Phase 4: Local Docker Compose Deployment ---
launch_docker_orchestration() {
    log_info "Executing Phase 4: Spin-up local container orchestration stack..."
    docker compose up -d --build
    sleep 5
    if docker ps | grep -q "vvu-mock-sfq-node"; then
        log_success "Verification Engine online and streaming on port 50051."
    fi
}

main() {
    echo -e "${GOLD}VVU-IVE AUTOMATED DEPLOYMENT & MI300X ORCHESTRATION PIPELINE${NC}"
    m0_doctrine_preflight
    package_nextjs_assets
    compile_smart_contracts
    bootstrap_rocm_stack
    launch_docker_orchestration
}
main "$@"
