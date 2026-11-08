/**
 * Workspace seed data — founder profile, dev contributions, changelog,
 * roadmap, docs, and incidents. Pure data, no side effects beyond Prisma.
 * Golden Rule: zero new deps.
 */
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto/mmr";

export async function seedWorkspaceIfEmpty(): Promise<void> {
  // ── 1. Founder user + settings ──────────────────────────────────────────
  const userCount = await db.user.count();
  if (userCount === 0) {
    const pub = "1d4e8f9c2a7b6053ed0c9f4a8b1c3d5e7f9a0b2c4d6e8f0a1b3c5d7e9f1a3b5c";
    const fp = sha256(pub).slice(0, 16);
    const user = await db.user.create({
      data: {
        email: "founder@vvu.earth",
        displayName: "Divhani Majokweni",
        avatarColor: "#84cc16",
        role: "FOUNDER",
        orgName: "VVU EARTH TECH",
        orgTier: "GOVERNANCE",
        publicKey: pub,
        keyFingerprint: fp,
        bio: "Founder & principal architect. Building the constitutional fabric for Africa's digital infrastructure — water, identity, mobility.",
        title: "Founder · Principal Architect",
        location: "Gqeberha, South Africa",
        timezone: "Africa/Johannesburg",
        locale: "en-ZA",
        lastLoginAt: new Date(),
        settings: {
          create: {
            theme: "dark",
            accentColor: "vvu-lime",
            density: "comfortable",
            fontSize: "md",
            sidebarCollapsed: false,
            defaultDomain: "WATER",
            defaultShardStrategy: "hash",
            emailNotifications: true,
            inAppNotifications: true,
            slackWebhook: "",
            alertOnViolations: true,
            alertOnMerges: false,
            alertOnShadowTakeover: true,
            alertOnMinedInvariants: false,
            telemetryOptIn: true,
            errorReportingOptIn: true,
            dataRetentionDays: 90,
          },
        },
        sessions: {
          create: [
            {
              label: "Chrome · Gqeberha · this device",
              userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/131",
              lastSeenAt: new Date(),
            },
            {
              label: "Safari · iPhone 15 · mobile",
              userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
              lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
            },
            {
              label: "epd-cli · terminal · WORM nest",
              userAgent: "epd-cli/1.0.0 bun/1.1",
              lastSeenAt: new Date(Date.now() - 1000 * 60 * 30),
            },
          ],
        },
        apiKeys: {
          create: [
            {
              label: "Production dashboard",
              keyHint: "vvu_live_",
              keyHash: sha256("vvu_live_a1b2c3d4e5f6" + Date.now()),
              scopes: "read,write",
              lastUsedAt: new Date(),
            },
            {
              label: "WORM nest ingest",
              keyHint: "vvu_worm_",
              keyHash: sha256("vvu_worm_x1y2z3w4v5u6" + Date.now()),
              scopes: "write",
              lastUsedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
            },
          ],
        },
      },
    });
    void user;
  }

  // ── 2. Dev contributions ─────────────────────────────────────────────────
  const contribCount = await db.contribution.count();
  if (contribCount === 0) {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 86400000);
    await db.contribution.createMany({
      data: [
        { type: "PR", number: 142, title: "feat(air-kernel): CRDT merge with least-divergent correction", author: "divhani", state: "MERGED", labels: "air-kernel,crdt,merge", repo: "air-kernel", commentsCount: 8, upvotes: 14, createdAt: days(2), updatedAt: days(2) },
        { type: "ISSUE", number: 87, title: "Shadow bridge takeover latency exceeds 80ms under load", author: "tumelo", state: "OPEN", labels: "shadow-bridge,perf,p1", repo: "epistemic-runtime", commentsCount: 5, upvotes: 9, createdAt: days(4), updatedAt: days(1) },
        { type: "PR", number: 88, title: "fix(mmr): inclusion proof off-by-one on odd leaf counts", author: "lerato", state: "MERGED", labels: "mmr,proofs,bug", repo: "epistemic-runtime", commentsCount: 3, upvotes: 11, createdAt: days(6), updatedAt: days(5) },
        { type: "ISSUE", number: 86, title: "epd-cli should support --strict flag for soft invariants", author: "divhani", state: "OPEN", labels: "cli,dsl,enhancement", repo: "epistemic-runtime", commentsCount: 2, upvotes: 6, createdAt: days(8), updatedAt: days(3) },
        { type: "PR", number: 56, title: "feat(safe-liner): HMAC-SHA256 device signing primitive", author: "kwanele", state: "MERGED", labels: "safe-liner,crypto,signing", repo: "safe-liner-basic", commentsCount: 4, upvotes: 7, createdAt: days(10), updatedAt: days(9) },
        { type: "DISCUSSION", number: 23, title: "Should we adopt PLONK over Groth16 for ZK ancestry proofs?", author: "divhani", state: "OPEN", labels: "zk,architecture,rfc", repo: "epistemic-runtime", commentsCount: 12, upvotes: 18, createdAt: days(12), updatedAt: days(1) },
        { type: "ISSUE", number: 81, title: "Golden Rule checker misses dynamic property access", author: "thabo", state: "OPEN", labels: "golden-rule,tooling,p2", repo: "epistemic-runtime", commentsCount: 1, upvotes: 4, createdAt: days(14), updatedAt: days(14) },
        { type: "PR", number: 49, title: "feat(hbk-adapter): WORM chain verifier for NMBM telemetry", author: "lerato", state: "MERGED", labels: "hbk,worm,gqeberha", repo: "hbk-adapter", commentsCount: 6, upvotes: 10, createdAt: days(16), updatedAt: days(15) },
        { type: "COMMIT", number: 0, title: "chore(deps): remove clsx + class-variance-authority (Golden Rule)", author: "divhani", state: "MERGED", labels: "deps,golden-rule", repo: "epistemic-runtime", commentsCount: 0, upvotes: 22, createdAt: days(18), updatedAt: days(18) },
        { type: "ISSUE", number: 77, title: "CityTwin3D viewport drops frames on integrated GPU", author: "tumelo", state: "OPEN", labels: "citytwin,perf,p2", repo: "hbk-adapter", commentsCount: 3, upvotes: 5, createdAt: days(20), updatedAt: days(7) },
        { type: "PR", number: 41, title: "docs(safe-krypte): add key-rotation runbook", author: "kwanele", state: "MERGED", labels: "safe-krypte,docs", repo: "safe-krypte-basic", commentsCount: 2, upvotes: 8, createdAt: days(22), updatedAt: days(21) },
        { type: "ISSUE", number: 70, title: "Federation gossip drops messages under NAT churn", author: "thabo", state: "OPEN", labels: "federation,p2p,p1", repo: "air-kernel", commentsCount: 7, upvotes: 12, createdAt: days(25), updatedAt: days(2) },
      ],
    });
  }

  // ── 3. Changelog ──────────────────────────────────────────────────────────
  const clCount = await db.changelogEntry.count();
  if (clCount === 0) {
    const days = (n: number) => new Date(Date.now() - n * 86400000);
    await db.changelogEntry.createMany({
      data: [
        { version: "1.4.0", title: "Workspace & developer surface", kind: "ADDED", publishedAt: days(0), author: "divhani", body: "## Added\n\n- **Account**, **Settings**, **Devices**, **Subscription**, and **Dev** workspace sections.\n- Per-user Ed25519 identity, API key management, and session registry.\n- Dev Docs, Contributions, Changelog, Roadmap, API Reference, and System Status.\n\n## Changed\n\n- Main nav now groups runtime sections and workspace sections separately." },
        { version: "1.3.0", title: "Real spatial intelligence", kind: "ADDED", publishedAt: days(14), author: "divhani", body: "## Added\n\n- Real geospatial world map (maplibre-gl) replacing the SVG placeholder.\n- 10 geographic regions with real lat/lng centroids.\n- Locality-preserving merge link overlays.\n\n## Removed\n\n- Bullshit SVG world map." },
        { version: "1.2.0", title: "Real infrastructure (not simulated)", kind: "ADDED", publishedAt: days(28), author: "divhani", body: "## Added\n\n- SHA-256 Merkle tree with inclusion proofs.\n- Invariant enforcement engine with vector clocks (CRDT semantics).\n- Append-only audit log with hash chain.\n- Evidence chain of custody (intake → verify → seal → archive).\n- Plugin hook system with 9 hook points.\n- Real-time Socket.IO event bus (port 3032)." },
        { version: "1.1.0", title: "VVU EARTH TECH governance", kind: "ADDED", publishedAt: days(42), author: "divhani", body: "## Added\n\n- Ed25519 license validation across 4 tiers (GOVERNANCE, ENTERPRISE, PRO, OPEN_SOURCE).\n- Golden Rule AST checker (22 forbidden product-specific strings).\n- Compile-time commercial boundary enforcement.\n- 14-feature gate matrix per tier." },
        { version: "1.0.0", title: "Initial public release", kind: "ADDED", publishedAt: days(56), author: "divhani", body: "## Added\n\n- `.epd` Policy DSL with parser, validator, compiler.\n- 24 dashboard sections covering the full epistemic runtime.\n- `epd-cli` mini-service on port 3031.\n- WORM nest mini-service on port 3033." },
        { version: "0.9.0", title: "Dependency audit (75 → 28)", kind: "CHANGED", publishedAt: days(70), author: "divhani", body: "## Changed\n\n- Removed 47 unused packages (63% reduction).\n- Replaced `clsx` with custom `cx()` (12 lines).\n- Replaced `class-variance-authority` with custom `cva()` (30 lines).\n- Deleted 30 unused shadcn/ui component files." },
        { version: "0.4.2", title: "Security: tighten WORM seal", kind: "SECURITY", publishedAt: days(84), author: "lerato", body: "## Fixed\n\n- WORM seal now includes custodian identity in the SHA-256 input.\n- Tamper attempts now produce an immutable audit entry before the exception is raised." },
      ],
    });
  }

  // ── 4. Roadmap ─────────────────────────────────────────────────────────────
  const rmCount = await db.roadmapItem.count();
  if (rmCount === 0) {
    await db.roadmapItem.createMany({
      data: [
        { title: "PLONK upgrade for ZK ancestry proofs", description: "Replace Groth16 circuit with PLONK for universal setup & smaller proofs. Affects Shadow Bridge and MMR Proofs sections.", milestone: "Q1", status: "IN_PROGRESS", priority: "HIGH", assignee: "lerato", progressPct: 35, tags: "zk,proofs,shadow-bridge" },
        { title: "Federation gossip NAT traversal", description: "libp2p-style hole-punching so epistemic:// peers behind NAT can gossip without a relay. Cuts cloud egress ~70%.", milestone: "Q1", status: "PLANNED", priority: "HIGH", assignee: "thabo", progressPct: 10, tags: "federation,p2p,nat" },
        { title: "Mobile companion app (Flutter)", description: "Read-only dashboard + push alerts for violations & shadow takeovers. iOS + Android.", milestone: "Q2", status: "PLANNED", priority: "MEDIUM", assignee: "kwanele", progressPct: 5, tags: "mobile,alerts" },
        { title: "Constitutional governance console", description: "On-chain ratification of `.epd` policy changes — founder veto, 2/3 quorum, ancestry proof of every vote.", milestone: "Q2", status: "PLANNED", priority: "CRITICAL", assignee: "divhani", progressPct: 0, tags: "governance,constitutional,voting" },
        { title: "ROCm GPU prover (HBK Mk-II)", description: "Move SNARK prover onto AMD ROCm for HBK water-infrastructure attestation. Targets <500ms proof time.", milestone: "Q2", status: "IN_PROGRESS", priority: "HIGH", assignee: "tumelo", progressPct: 45, tags: "rocm,gpu,zk,hbk" },
        { title: "Worm nest federation (cross-org)", description: "Let multiple orgs share a WORM nest with privacy-preserving cross-org evidence lookup (no plaintext leak).", milestone: "Q3", status: "PLANNED", priority: "MEDIUM", assignee: "lerato", progressPct: 0, tags: "worm,federation,privacy" },
        { title: "CityTwin3D AR overlay (HLK)", description: "HoloLens-class AR overlay for Gqeberha field crews — see telemetry vectors overlaid on real pipes.", milestone: "Q3", status: "PLANNED", priority: "LOW", assignee: "tumelo", progressPct: 0, tags: "citytwin,ar,field" },
        { title: "Audit report PDF export (regulator-grade)", description: "Generate POPIA/FICA-compliant PDF audit packs with embedded MMR ancestry proofs.", milestone: "Q1", status: "SHIPPED", priority: "HIGH", assignee: "divhani", progressPct: 100, tags: "audit,pdf,compliance" },
        { title: "Sso/SAML for enterprise tier", description: "Enterprise SSO via SAML 2.0 — required for Cape Town enterprise customer.", milestone: "Backlog", status: "PLANNED", priority: "MEDIUM", assignee: "kwanele", progressPct: 0, tags: "sso,saml,enterprise" },
        { title: "Telemetry opt-out & data export", description: "POPIA Article 23 compliance — full data export + telemetry opt-out from Settings.", milestone: "Q1", status: "AT_RISK", priority: "HIGH", assignee: "divhani", progressPct: 60, tags: "popia,privacy,export" },
      ],
    });
  }

  // ── 5. Doc pages ──────────────────────────────────────────────────────────
  const docCount = await db.docPage.count();
  if (docCount === 0) {
    const docs = [
      { slug: "quickstart", title: "Quickstart", category: "QUICKSTART", order: 1, body: "# Quickstart\n\nGet a policy deployed in under 5 minutes.\n\n## 1. Install epd-cli\n```bash\ncurl -fsSL https://vvu.earth/install.sh | sh\n```\n\n## 2. Author your first `.epd` policy\n```\npolicy \"hello-water\" {\n  domain = \"WATER\"\n  shard  hash { key = \"meterId\" }\n  invariant \"non_negative\" {\n    expect merge { state.volume >= 0 }\n    on_violation { repair = \"clamp_zero\" }\n  }\n}\n```\n\n## 3. Validate\n```bash\nepd-cli validate hello.epd\n```\n\n## 4. Push to the runtime\n```bash\nepd-cli push hello.epd --org vvu.earth\n```\n\nYou're done. The dashboard will show your shard topology, invariants, and merge health in real time." },
      { slug: "epd-dsl-reference", title: ".epd DSL Reference", category: "DSL", order: 2, body: "# .epd DSL Reference\n\nThe Epistemic Policy DSL is the constitutional fabric of the runtime.\n\n## Top-level blocks\n\n- `policy \"name\" { ... }` — top-level container\n- `shard <strategy> { key = \"...\" }` — sharding config\n- `invariant \"name\" { expect merge { ... } on_violation { ... } }`\n- `ancestry { kind = \"MMR\" zk = true }`\n- `shadow_bridge { mode = \"twin\" takeover_latency_ms = 50 }`\n\n## Sharding strategies\n\n| Strategy | Use case |\n|----------|----------|\n| `hash` | Generic, uniform distribution |\n| `range` | Time-series, locality |\n| `region` | Geographic locality |\n\n## Invariant severity\n\n- **hard** (default): violations BLOCK the transition\n- **soft**: violations fire a callback but allow commit\n\n## Merge repair strategies\n\n- `least_divergent` (default) — pick the merge that minimizes edit distance\n- `clamp_zero`, `last_writer_wins`, `crdt_or` — domain-specific" },
      { slug: "mmr-ancestry-proofs", title: "MMR Ancestry Proofs", category: "ARCHITECTURE", order: 3, body: "# MMR Ancestry Proofs\n\nA Merkle Mountain Range (MMR) is an append-only tree that gives O(log n) inclusion proofs.\n\n## Why MMR?\n\n- **Append-only**: history is immutable\n- **Compact proofs**: log(n) siblings per proof\n- **Federated**: peers can verify each other's history without trusting the source\n\n## Zero-knowledge ancestry\n\nFor policies with `zk = true`, we synthesize a SNARK circuit that proves:\n1. A given leaf exists in the MMR\n2. The MMR root matches the anchored root\n3. Without revealing the leaf contents\n\n## Verification\n\n```typescript\nimport { MerkleTree } from '@/lib/crypto/mmr';\nconst tree = new MerkleTree(leaves);\nconst proof = tree.prove(index);\nconst ok = tree.verify(value, proof); // true or false\n```" },
      { slug: "worm-chain", title: "WORM Chain of Custody", category: "ARCHITECTURE", order: 4, body: "# WORM Chain of Custody\n\nWrite-Once-Read-Many: append-only, hash-linked evidence.\n\n## The pipeline\n\n```\nintake → verify → seal → archive\n```\n\nEach stage produces a new SHA-256 fingerprint:\n```\nseal_fp = SHA256(prev_fp + ref + custodian + ts)\n```\n\n## Sealed records are immutable\n\nEditing a sealed record throws. The only escape hatch is `forceEdit`, which:\n1. Logs a `TAMPER_ATTEMPT` to the audit log\n2. Replaces the record\n3. Breaks the chain (detectable by `verifyWORMChain`)\n\n## Evidence Integrity Score (EIS)\n\n```\nEIS = w1*P + w2*F + w3*A    // pressure, flow, acoustic\n```\n\nCapped by SCADA ceiling. Tier R2 (court-grade) requires ≥2 witnesses." },
      { slug: "golden-rule", title: "The Golden Rule", category: "POLICY", order: 5, body: "# The Golden Rule\n\n> **Never adopt a dependency for something a few lines of code can build.**\n\n## Enforcement\n\nThe `scripts/golden-rule-checker.js` AST-scans the `open-source/` tree for 22 forbidden product-specific strings.\n\nThe `scripts/enforce-boundaries.sh` script runs three checks pre-commit:\n1. No commercial imports from OSS code\n2. Golden Rule string check\n3. License header audit\n\n## Why?\n\nThis is a **constitutional** project. Every dependency is a liability. Every product-specific string in OSS code is a moat leak.\n\n## Exceptions\n\nOnly one dependency has ever been added against the Golden Rule: **maplibre-gl** — because a WebGL vector tile renderer with 3D building extrusions cannot be built in 'a few lines'." },
      { slug: "shadow-bridge", title: "Shadow Bridge", category: "ARCHITECTURE", order: 6, body: "# Shadow Bridge\n\nA digital-twin mode that runs the runtime in parallel with production, evaluating what-if branches before they go live.\n\n## Modes\n\n- **twin**: continuous shadow, divergence <50ms\n- **whatif**: explicit branch, no takeover\n- **replay**: re-run history against a candidate policy\n- **takeover**: promote shadow to authoritative\n\n## Takeover latency\n\nGoverned by `takeover_latency_ms` in the `.epd` policy. Hard cap: 200ms. Anything slower breaks the SLA.\n\n## Handback\n\nReleasing takeover back to twin mode requires:\n1. Audit log entry\n2. MMR ancestry proof of the takeover window\n3. Plugin hook `shadow.handback` fires" },
      { slug: "federation-protocol", title: "epistemic:// Federation", category: "ARCHITECTURE", order: 7, body: "# epistemic:// Federation\n\nMulti-organization verifiable state reconciliation over a gossip protocol.\n\n## Peering\n\nOrgs peer by exchanging Ed25519 public keys. Once peered, shards gossip merge proposals on every commit.\n\n## Conflict resolution\n\nTwo peers with concurrent merges (same vector clock) **reject** the merge and require self-repair. The Invariant Miner surfaces the conflict and proposes a least-divergent correction.\n\n## Privacy\n\nCross-org evidence lookups never reveal plaintext. The requesting peer gets a ZK proof that the evidence exists in the responder's MMR, nothing more.\n\n## Topology\n\nGossip mesh with locality-preserving links (within 2000km) plus a sparse long-haul overlay." },
      { slug: "api-reference", title: "API Reference", category: "REFERENCE", order: 8, body: "# API Reference\n\nAll endpoints are relative; cross-port requests use `?XTransformPort=<port>`.\n\n## Core\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | `/api/stats` | Global dashboard stats |\n| GET | `/api/policies` | List all policies |\n| POST | `/api/policies` | Create a policy |\n| GET | `/api/shards` | List shards |\n| GET | `/api/merges` | List merge proposals |\n| GET | `/api/proofs` | List MMR ancestry proofs |\n| GET | `/api/violations` | List invariant violations |\n\n## Workspace\n\n| Method | Path | Description |\n|--------|------|-------------|\n| GET | `/api/account` | Current user profile |\n| PATCH | `/api/account` | Update profile |\n| GET | `/api/settings` | User settings |\n| PATCH | `/api/settings` | Update settings |\n| GET | `/api/devices` | Registered devices |\n| POST | `/api/devices` | Register a device |\n| GET | `/api/subscriptions` | Active subscription |\n| GET | `/api/dev/contributions` | Open issues & PRs |\n| GET | `/api/dev/changelog` | Versioned changelog |\n| GET | `/api/dev/roadmap` | Roadmap milestones |\n| GET | `/api/dev/docs` | Documentation index |\n| GET | `/api/dev/docs/:slug` | Single doc page |\n| GET | `/api/dev/incidents` | System status incidents |\n\n## Mini-services\n\n| Port | Service |\n|------|---------|\n| 3000 | Next.js dashboard |\n| 3031 | epd-cli HTTP bridge |\n| 3032 | event-bus (Socket.IO) |\n| 3033 | worm-nest (Socket.IO) |" },
    ];
    for (const d of docs) {
      await db.docPage.create({ data: { ...d, updatedAt: new Date() } });
    }
  }

  // ── 6. Incidents ─────────────────────────────────────────────────────────
  const incCount = await db.incident.count();
  if (incCount === 0) {
    const hours = (n: number) => new Date(Date.now() - n * 3600000);
    await db.incident.createMany({
      data: [
        { title: "WORM nest chain head advance slower than expected", severity: "MINOR", status: "RESOLVED", affectedComponents: "worm-nest,evidence", body: "Chain head advancement dropped to 1.2s/block (target 2.5s) due to a hot-loop in the SHA-256 canonical serializer. Patched in v1.4.0.", startedAt: hours(20), resolvedAt: hours(18) },
        { title: "epd-cli validate returns false-positive on empty shard block", severity: "MINOR", status: "RESOLVED", affectedComponents: "epd-cli", body: "Empty `shard {}` block was incorrectly flagged as a parse error. Fixed in v1.3.2.", startedAt: hours(72), resolvedAt: hours(70) },
        { title: "Scheduled maintenance: federation gossip protocol upgrade", severity: "MAINTENANCE", status: "RESOLVED", affectedComponents: "federation", body: "Gossip protocol upgraded to v2 (compression + batching). 14-minute downtime window.", startedAt: hours(120), resolvedAt: hours(119) },
      ],
    });
  }

  // ── 7. Subscriptions (5 tiers per Skylantern pricing) ────────────────────
  const subCount = await db.subscription.count();
  if (subCount === 0) {
    const days = (n: number) => new Date(Date.now() - n * 86400000);
    const future = (n: number) => new Date(Date.now() + n * 86400000);
    await db.subscription.createMany({
      data: [
        { tierKey: "water", tierLabel: "Water Infrastructure · DMA", priceZAR: 9999, cadence: "90 days", customerName: "NMBM · Gqeberha", customerEmail: "water@nmbm.gov.za", status: "ACTIVE", startDate: days(40) },
        { tierKey: "fleet", tierLabel: "Fleet Mobility", priceZAR: 199, cadence: "per mo", customerName: "VVU EARTH TECH", customerEmail: "fleet@vvu.earth", status: "ACTIVE", startDate: days(20) },
        { tierKey: "vehicle", tierLabel: "Vehicle Tracker", priceZAR: 49, cadence: "per mo", customerName: "Polokwane Logistics", customerEmail: "ops@polokwane.co.za", status: "ACTIVE", startDate: days(15) },
        { tierKey: "phone", tierLabel: "Phone Backup", priceZAR: 9, cadence: "per user / mo", customerName: "Cape Town Enterprise", customerEmail: "it@capetownent.co.za", status: "TRIALING", startDate: days(5) },
        { tierKey: "dma", tierLabel: "DMA Water Custodian", priceZAR: 4999, cadence: "per mo", customerName: "Sarah Baartman DMA", customerEmail: "custodian@sbdma.gov.za", status: "ACTIVE", startDate: days(60) },
      ],
    });
    void future;
  }

  // ── 8. Invoices (linked to existing Subscription rows if present) ────────
  const invCount = await db.invoice.count();
  if (invCount === 0) {
    const subs = await db.subscription.findMany({ take: 5 });
    const days = (n: number) => new Date(Date.now() - n * 86400000);
    const make = (sub: { id: string; customerName: string; customerEmail: string; priceZAR: number } | null, number: string, amount: number, ageDays: number) => ({
      subscriptionId: sub?.id ?? null,
      number,
      customerName: sub?.customerName ?? "VVU EARTH TECH",
      customerEmail: sub?.customerEmail ?? "billing@vvu.earth",
      amountZAR: amount,
      taxZAR: Math.round(amount * 0.15),
      totalZAR: Math.round(amount * 1.15),
      status: "PAID",
      issuedAt: days(ageDays),
      dueAt: days(ageDays - 7),
      paidAt: days(ageDays - 5),
      lineItems: JSON.stringify([{ description: "Subscription", amount: amount }]),
    });
    if (subs.length > 0) {
      const invoices: ReturnType<typeof make>[] = [];
      let n = 1;
      for (const s of subs) {
        invoices.push(make(s, `INV-2024-${String(n).padStart(4, "0")}`, s.priceZAR, 30 - n * 5));
        n++;
        if (n > 6) break;
      }
      await db.invoice.createMany({ data: invoices });
    } else {
      // No subscriptions yet — seed a single founder invoice
      await db.invoice.create({
        data: {
          number: "INV-2024-0001",
          customerName: "VVU EARTH TECH",
          customerEmail: "billing@vvu.earth",
          amountZAR: 9999,
          taxZAR: 1500,
          totalZAR: 11499,
          status: "PAID",
          issuedAt: days(30),
          dueAt: days(23),
          paidAt: days(25),
          lineItems: JSON.stringify([{ description: "GOVERNANCE tier — Q4 2024", amount: 9999 }]),
        },
      });
    }
  }
}
