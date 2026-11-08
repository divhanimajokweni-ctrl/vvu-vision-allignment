# Pull Request

## Summary

<!-- 1–2 sentences describing what this PR changes and why. -->

## Golden Rule check

The VVU Golden Rule: *never adopt a dependency for what a few lines can build.*

- [ ] This PR does **not** add a new dependency.
- [ ] This PR adds a new dependency, and here is why it cannot be built in a few lines of code:
  ```
  <justify here — what does the dep do, why is hand-rolling it impractical, what is the bundle cost?>
  ```

If you added a dep, the `golden-rule-review` label is auto-applied by Dependabot. For manually-added deps, attach the label and ping `@divhanimajokweni`.

## Dashboard impact

- [ ] This PR does **not** add or change a dashboard section.
- [ ] This PR adds/changes a dashboard JSON in `dashboards/`. I ran:
  ```bash
  node scripts/dashboard-panel-validator.mjs dashboards/<file>.json
  ```
  and it exited 0. (Note: `dashboards/water-infrastructure.json` is an intentional broken fixture — do not "fix" it.)

## License impact

- [ ] This PR does **not** touch `/shared/license/` or `/keys/`.
- [ ] This PR touches `/shared/license/` or `/keys/`. I triggered the **License Regen** workflow (Actions tab → "License Regen" → Run workflow) and downloaded the `sample-licenses-<run_id>` artifact. The new `keys/sample-licenses.json` was distributed via secure channel (1Password / founder-to-customer handoff), **not** committed.

## Testing

<!-- How was this PR tested? Attach evidence: -->

- [ ] `bun run lint` — 0 errors (warnings OK).
- [ ] `bash scripts/enforce-boundaries.sh` — exit 0.
- [ ] `node scripts/golden-rule-checker.js` — exit 0.
- [ ] Manual verification (attach screenshot / curl output / agent-browser snapshot):
  ```
  <paste evidence here>
  ```

## Pre-merge checklist

- [ ] No new dependency OR dependency is Golden-Rule-justified.
- [ ] No `bun run build` introduced anywhere (it's a founder-only manual step).
- [ ] No secrets / API keys / `*.pem` files committed.
- [ ] `/keys/`, `golden-rule-report.json`, `dashboard-validator-report.json` are gitignored (verify with `git check-ignore <path>`).
- [ ] If schema changed: `bun run db:push` runs clean locally.
