# VVU Validation Pipeline

Automated end-to-end validation of the VVU Trust OS architecture.

## Usage

```bash
# Run full pipeline (CPU mode)
./validation/scripts/run-pipeline.sh

# Run with GPU mode
./validation/scripts/run-pipeline.sh --mode gpu

# Run with TEE mode
./validation/scripts/run-pipeline.sh --mode tee

# Skip build (faster iteration)
./validation/scripts/run-pipeline.sh --skip-build

# Skip Lighthouse
./validation/scripts/run-pipeline.sh --skip-lighthouse
```

## Output

Results are saved to `validation/results/<timestamp>/`:
- `results.json` — step-by-step results
- `logs/` — build, test, and audit logs
- `metrics/` — platform comparison JSON
- `reports/` — branded validation report + Lighthouse

## Structure

```
validation/
├── scripts/
│   └── run-pipeline.sh    # Main pipeline script
├── results/               # Timestamped results (gitignored)
├── reports/               # Branded reports
└── metrics/               # Platform comparison data
```

## Pipeline Steps

1. **Dependency Generation** — npm install, prisma generate
2. **TypeScript Typecheck** — tsc --noEmit
3. **ESLint** — lint all source files
4. **Unit Tests** — substrate, FFT, Bayesian, GLB, WORM, Catch Metrics
5. **Production Build** — Next.js build + binary check
6. **Lighthouse Audit** — performance, accessibility, best practices, SEO
7. **Metrics Collection** — CPU vs GPU vs TEE comparison
8. **Branded Report** — execution certificate with all results

## Validation Criteria

The pipeline succeeds when:
- TypeScript: 0 errors
- ESLint: 0 errors
- Unit tests: all pass
- Build: successful, no storage-intensive binaries
- Lighthouse: all scores > 50
- Metrics: recorded for all platforms
EOF
echo "README created"