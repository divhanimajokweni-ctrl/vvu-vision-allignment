# migration-momentum-maker / VVU Control

Operational digital-twin and control-plane workspace for Venture Vision Ubuntu (`venturevisionubuntu.co.za`), integrating fail-closed telemetry, WORM/receipt patterns, Clerk auth DNS, and Vercel/Cloudflare delivery.

## Core doctrine
- **Fail-closed / Digital Turn-Off:** if sensor/asset evidence is absent, render labeled absence (`SENSOR_ABSENT`/`ASSET_MISSING`) — never placeholder geometry, never fabricated values/states.
- **Absence is receipted:** 15s silence → breaker trip + `SENSOR_ABSENT`; reset is receipted. See [`docs/architecture/fail-closed-empty-state.md`](docs/architecture/fail-closed-empty-state.md).
- **No primitives law:** production twins load verified coherent assets only; missing assets fail closed.

## Key surfaces
- `public/twin/vv-fail-closed.html` — mobile-first fail-closed demo (15s breaker, WORM terminal).
- `public/twin/isuzu-industrial-twin.html` — consolidated single-GLB industrial twin (no puzzle/fragment rendering).
- `public/human-twin/index.html` — human/avatar twin asset view (GLBs are inputs; assembly must stay fail-closed/coherent).
- `src/lib/twin-surfaces.ts` + `src/app/api/vvu/twin-scenario/route.ts` — twin registry and disk-canonical artifact serving.
- `wrangler.toml` — Worker observability (logs/invocation logs enabled, traces disabled/persist settings).

## Local dev
```bash
./scripts/dev.sh
# or with Nix bun/node paths configured:
bun run dev
```
Build: `bun run build` (Next.js; see `package.json`).

## Ops scripts (no secrets)
- `scripts/fix-resend-dns.sh` — upserts Resend/Forge sending+DKIM/DMARC records in Cloudflare (keeps root `@` MX unless intentionally changed). Requires `CF_API_TOKEN`, `ZONE_ID`.

## Integrations
- **Vercel (vvu-org):** project `workspace` (`prj_goHaZC9Tjk37iipGq3zfuUej4giu`) serves `venturevisionubuntu.co.za`/`www`; link/deploy target should be `divhanimajokweni-ctrl/migration-momentum-maker` `main`.
- **Cloudflare:** DNS/Clerk/Resend records managed via API token with Zone DNS edit.
- **Clerk:** CNAMEs for `accounts`, `clerk`, DKIM/clkmail as configured in Cloudflare (DNS-only, not proxied).
- **Resend/Forge:** domain verification + DNS records; verify API requires valid `RESEND_API_KEY` and `User-Agent`.

## Safety
- Never commit `.env`/secrets/tokens. Use Replit/Vercel/Cloudflare secret stores.
- No fabricated telemetry in production tests; verify telemetry paths with existing fixtures/non-prod data.
- Treat `vvu-ecosystem` and unrelated remotes as separate unless explicitly instructed.
