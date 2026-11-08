# Roadmap — VVU Estate migration (Next.js archive → Lovable)

Source: user-uploads://vvu-estate-kate.zip → /tmp/mig/vvu-estate (re-extract if wiped).
Decisions (user-confirmed): core ten surfaces first · mini-services recreated as in-app
feeds · IVE sub-app included. Ledger: .lovable/migrate-external-project/ledger.json.

## Pass 1 (current)

- [x] Inspect archive, write ledger, enable Lovable Cloud
- [x] Migrate Prisma schema (45 tables) → Postgres migration applied (no seed yet — records pending user export)
- [x] Design system: port globals.css → src/styles.css (VVU dark tokens, no remote fonts)
- [x] Static assets: copy public/ into project public/
- [x] Dashboard shell: / renders estate chrome with hash workspace switching (default view spatial; icsh stubbed)
- [x] Core ten workspaces ported (spatial verified live; others compile, awaiting visual pass)
- [ ] Remaining ~20 projections: honest migrating-stub surfaces
- [x] API/data layer: endpoints the ten surfaces consume recreated as simulated in-app feeds; ledger/audit/chronicle contracts matched to client types
- [x] Telemetry / vault-bridge / field-onboard recreated as in-app feeds (vvu-sim.ts, bridge-feed.ts; socket.io-client removed). wildfire-mesh + mesh-demo pending (their views are stubs)
- [x] IVE sub-app routes: 7 leaf routes + layout ported; proof/contact remain placeholders
- [x] Verify: build green, dashboard renders, write/read loop through the outreach form (simulated feed)

## Later passes

- [ ] Remaining projections (outreach, holocom, capability, metro, urllc, fieldkit,
      support, commercial, manifest, wildfire, mesh, docs, ops, sphere, fleet,
      broadcast, trust, governance, firstprinciples, safegrid, records, iveverify,
      studio, fluid)
- [ ] Records import pending user export (Turso/SQLite CSV/JSON)
- [ ] Secrets for preserved providers (Resend, AI keys, anchor/ledger endpoints)
      via secure form at verification time
