'use client';

// src/components/pools/PoolsWorkspace.tsx — Task 47 · #/pools
// UBUNTU POOLS · COMMUNITY POOL VIEW — the keyboard map's eighth tab.
//
// WHAT THIS IS: the honest, read-only view of the estate's community
// pools — the contribution/access world of TEMPLATE_QR_BRIDGE.md §10
// (ProofBridge/TEMPLATE_QR_BRIDGE.md, the governing spec):
//   * R5 / R10 contribution tiers unlock clearly-bounded Ubuntu
//     participation paths. Contribution and access are SEPARATE FIELDS —
//     never merged, never represented as the purchase of a regulated
//     financial service. A regulator should be able to see the separation
//     with one glance at this screen.
//   * Every pool carries a DIRECTORY STATUS from the fixed catalogue
//     vocabulary (ASSEMBLY READY · DOCUMENTED · DEMONSTRATION · VERIFIED ·
//     PILOT AVAILABLE · UNVERIFIED · BLOCKED). Nothing is VERIFIED without
//     a hash/commit/signature receipt — so nothing here claims it.
//   * Live numbers come from the estate's real funding rail
//     (/api/vvu/support — Mk-I funding progress, honestly zero until a
//     contribution locks in). No invented totals.
//
// Visual language: the IVE estate family (gold #C9A84C · proven #3DFFB0 ·
// ready #F5A623 · blocked #FF4D5F · lime #c8ff00, Geist Mono labels,
// grid-paper hero). Honest footer at the bottom.

import { useEffect, useState } from 'react';
import { Coins, Droplets, HandCoins, Layers, ShieldCheck } from 'lucide-react';

interface SupportProgress {
  targetZar: number;
  targetLabel: string;
  targetProvisional: boolean;
  lockedTotalZar: number;
  lockedCount: number;
  pendingTotalZar: number;
  pendingCount: number;
  supporterCount: number;
  pct: number;
}

type DirStatus = 'ASSEMBLY READY' | 'DOCUMENTED' | 'DEMONSTRATION' | 'VERIFIED' | 'PILOT AVAILABLE' | 'UNVERIFIED' | 'BLOCKED';

const STATUS_COLOR: Record<DirStatus, string> = {
  'ASSEMBLY READY': '#F5A623',
  DOCUMENTED: '#C9A84C',
  DEMONSTRATION: '#2ea8a0',
  VERIFIED: '#3DFFB0',
  'PILOT AVAILABLE': '#8fb35a',
  UNVERIFIED: '#7a8a6e',
  BLOCKED: '#FF4D5F',
};

interface Pool {
  id: string;
  name: string;
  what: string;
  status: DirStatus;
  statusNote: string;
  contribution: string;
  access: string;
  separation: string;
}

/* The pool directory — statuses are the HONEST catalogue state of each
   pool as of Task 47. UNVERIFIED is the default posture; nothing is
   VERIFIED without evidence (hash/commit/signature receipt). */
const POOLS: Pool[] = [
  {
    id: 'winter-pools',
    name: 'WINTER POOLS CO-OP',
    what: 'The neighbourhood foundation layer — consent-gated emergency mesh, hash-chained journals, the operator-side wildfire console. The pools exist so a co-op member can grant and revoke participation in one honest gesture.',
    status: 'DOCUMENTED',
    statusNote: '8-file operator console shipped (Task 41) on the :3006 rail; live mesh service DEMONSTRATION-grade. Co-op pooling engine itself not yet assembled.',
    contribution: 'co-op membership · labour and stewardship, not money',
    access: 'consent-gated mesh participation · revocable per member, journaled per grant',
    separation: 'contribution = membership act · access = consent state — two different records, two different revocations',
  },
  {
    id: 'ubuntu-r5',
    name: 'UBUNTU R5 POOL',
    what: 'The R5 contribution tier of TEMPLATE_QR_BRIDGE.md §10 — a small, clearly-bounded contribution that unlocks a defined Ubuntu participation path (docs access + community pool membership).',
    status: 'ASSEMBLY READY',
    statusNote: 'The template governs the build (ProofBridge/TEMPLATE_QR_BRIDGE.md v1.1.0); the pairing/receipt rails exist (:3004/:3005); no R5 pool engine has been assembled against them yet.',
    contribution: 'R5 once — recorded as a contribution, never as payment for a financial product',
    access: 'documents · community pool view · participation path',
    separation: 'receipt carries contribution and access as two independent fields — one grep shows the split',
  },
  {
    id: 'ubuntu-r10',
    name: 'UBUNTU R10 POOL',
    what: 'The R10 tier — the same bounded participation with the pilot-scoped extras (ProofBridge QR pairing for one device, verified receipt chain visibility).',
    status: 'ASSEMBLY READY',
    statusNote: 'Same template, same rails, same honesty ladder as R5. The tier unlock path is documented; assembly has not started.',
    contribution: 'R10 once — same separation discipline as R5',
    access: 'R5 access + one-device QR pairing path + receipt chain visibility',
    separation: 'tier fields live in the receipt payload as tier: "<product/access tier>" — never merged with the contribution field',
  },
  {
    id: 'mk1-funding',
    name: 'MK-I FABRICATION POOL',
    what: 'The Mk-I prototype fabrication & field validation target — the one pool with a LIVE rail today (/api/vvu/support: locked contributions, honest progress, allocation published up front).',
    status: 'PILOT AVAILABLE',
    statusNote: 'The funding endpoint is live with a real FSM (PAYFAST · EFT · CRYPTO paths specified); zero contributions locked so far — the numbers below are the real zeros, never a warm fake.',
    contribution: 'variable, ZAR — locked only through the funding rail FSM',
    access: 'progress visibility · allocation receipts · supporter updates',
    separation: 'the funding rail is a contribution instrument with an honest progress gauge — it grants no service, so no merge risk exists',
  },
];

export function PoolsWorkspace() {
  const [prog, setProg] = useState<SupportProgress | null>(null);
  const [progError, setProgError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/vvu/support', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { progress?: SupportProgress }) => {
        if (!cancelled && d.progress) setProg(d.progress);
      })
      .catch((e: unknown) => {
        if (!cancelled) setProgError(e instanceof Error ? e.message : 'UNREACHABLE');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pools-root">
      <style>{`
        .pools-root {
          position: absolute; inset: 0; overflow-y: auto;
          background:
            linear-gradient(rgba(107,138,64,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(107,138,64,0.045) 1px, transparent 1px),
            #060806;
          background-size: 28px 28px, 28px 28px, auto;
          color: #c9d4bd;
          font-family: var(--font-geist-sans, Geist, system-ui, sans-serif);
        }
        .pools-inner { max-width: 1080px; margin: 0 auto; padding: 28px 20px 40px; }
        .pools-kicker {
          font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 8.5px; letter-spacing: 0.28em; color: #7a8a6e;
        }
        .pools-title {
          font-size: clamp(20px, 3.4vw, 30px); font-weight: 700; color: #c8ff00;
          letter-spacing: 0.04em; margin: 8px 0 4px;
        }
        .pools-sub { color: #7a8a6e; font-size: 12.5px; max-width: 720px; line-height: 1.65; }
        .pools-honesty {
          display: inline-block; margin-top: 12px;
          font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 8.5px; letter-spacing: 0.18em; color: #F5A623;
          border: 1px solid rgba(245,166,35,0.45); border-radius: 4px; padding: 4px 9px;
        }
        .pools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-top: 26px; }
        .pool-card {
          background: rgba(8,11,7,0.92); border: 1px solid rgba(107,138,64,0.28);
          border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 10px;
        }
        .pool-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .pool-name { font-weight: 700; font-size: 13px; letter-spacing: 0.06em; color: #d7e2c9; }
        .pool-status {
          font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 7.5px; letter-spacing: 0.16em; padding: 3px 7px;
          border: 1px solid currentColor; border-radius: 3px; white-space: nowrap;
        }
        .pool-what { font-size: 11.5px; line-height: 1.7; color: #9aa88d; }
        .pool-note {
          font-size: 10px; line-height: 1.65; color: #7a8a6e;
          border-left: 2px solid rgba(107,138,64,0.4); padding-left: 10px;
        }
        .pool-split { display: grid; gap: 6px; margin-top: 2px; }
        .pool-split .row { display: flex; gap: 8px; font-size: 10px; line-height: 1.6; }
        .pool-split .k {
          font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 7.5px; letter-spacing: 0.16em; color: #7a8a6e;
          min-width: 96px; padding-top: 2px;
        }
        .pool-split .v { color: #c9d4bd; }
        .pool-sep {
          margin-top: 6px; font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 8.5px; line-height: 1.7; color: #2ea8a0;
          border: 1px dashed rgba(46,168,160,0.4); border-radius: 4px; padding: 7px 9px;
        }
        .pools-live {
          margin-top: 26px; background: rgba(8,11,7,0.92);
          border: 1px solid rgba(107,138,64,0.28); border-radius: 6px; padding: 16px;
        }
        .pools-live-title {
          font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 9px; letter-spacing: 0.22em; color: #c8ff00; margin-bottom: 10px;
        }
        .pools-live-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
        .pl-k { font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace); font-size: 7.5px; letter-spacing: 0.16em; color: #7a8a6e; }
        .pl-v { font-size: 16px; font-weight: 600; color: #d7e2c9; margin-top: 3px; }
        .pl-src {
          margin-top: 12px; font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 8.5px; color: #4a5744; letter-spacing: 0.06em;
        }
        .pools-footer {
          margin-top: 30px; border-top: 1px solid rgba(107,138,64,0.25); padding-top: 14px;
          font-family: var(--font-geist-mono, "Geist Mono", Menlo, monospace);
          font-size: 8.5px; line-height: 1.9; color: #7a8a6e; letter-spacing: 0.08em;
        }
      `}</style>

      <div className="pools-inner">
        <div className="pools-kicker">VVU ESTATE · COMMUNITY POOL VIEW · #/POOLS · CTRL+8</div>
        <h1 className="pools-title">Ubuntu Pools</h1>
        <p className="pools-sub">
          The estate&rsquo;s community pools in one honest directory. Contribution and access are
          separate fields everywhere — a regulator can see the split on this screen, and the
          receipts carry it independently. No pool on this page is a regulated financial service,
          and none claims a status it cannot evidence.
        </p>
        <span className="pools-honesty">
          CONTRIBUTION ≠ ACCESS · TWO FIELDS, TWO RECORDS, NEVER MERGED
        </span>

        <div className="pools-grid">
          {POOLS.map((p) => (
            <article key={p.id} className="pool-card">
              <div className="pool-head">
                <span className="pool-name">{p.name}</span>
                <span className="pool-status" style={{ color: STATUS_COLOR[p.status] }} title={p.statusNote}>
                  {p.status}
                </span>
              </div>
              <p className="pool-what">{p.what}</p>
              <p className="pool-note">{p.statusNote}</p>
              <div className="pool-split">
                <div className="row">
                  <span className="k">CONTRIBUTION</span>
                  <span className="v">{p.contribution}</span>
                </div>
                <div className="row">
                  <span className="k">ACCESS</span>
                  <span className="v">{p.access}</span>
                </div>
              </div>
              <div className="pool-sep">SEPARATION · {p.separation}</div>
            </article>
          ))}
        </div>

        <section className="pools-live">
          <div className="pools-live-title">
            <HandCoins size={11} style={{ verticalAlign: '-1px', marginRight: 6 }} />
            MK-I FABRICATION POOL · LIVE RAIL NUMBERS
          </div>
          {prog ? (
            <div className="pools-live-grid">
              <div>
                <div className="pl-k">LOCKED · ZAR</div>
                <div className="pl-v">{prog.lockedTotalZar.toLocaleString('en-ZA')}</div>
              </div>
              <div>
                <div className="pl-k">LOCKED CONTRIBUTIONS</div>
                <div className="pl-v">{prog.lockedCount}</div>
              </div>
              <div>
                <div className="pl-k">PENDING</div>
                <div className="pl-v">{prog.pendingCount}</div>
              </div>
              <div>
                <div className="pl-k">SUPPORTERS</div>
                <div className="pl-v">{prog.supporterCount}</div>
              </div>
              <div>
                <div className="pl-k">TARGET · ZAR {prog.targetProvisional ? '(PROV.)' : ''}</div>
                <div className="pl-v">{prog.targetZar.toLocaleString('en-ZA')}</div>
              </div>
              <div>
                <div className="pl-k">PROGRESS</div>
                <div className="pl-v">{prog.pct}%</div>
              </div>
            </div>
          ) : (
            <div className="pl-v" style={{ color: progError ? '#FF4D5F' : '#7a8a6e' }}>
              {progError ? `RAIL UNREACHABLE (${progError}) — NO NUMBER SHOWN` : 'READING RAIL…'}
            </div>
          )}
          <div className="pl-src">
            source: /api/vvu/support · funding rail FSM · zeros are real zeros, never warm fakes
          </div>
        </section>

        <footer className="pools-footer">
          DIRECTORY VOCABULARY: ASSEMBLY READY · DOCUMENTED · DEMONSTRATION · VERIFIED · PILOT
          AVAILABLE · UNVERIFIED · BLOCKED — nothing is VERIFIED without a hash / commit /
          signature receipt.
          <br />
          GOVERNING SPEC: ProofBridge/TEMPLATE_QR_BRIDGE.md v1.1.0 §10 (contribution/access
          separation, tier unlock paths, no regulated-financial-services representation).
          <br />
          TIER RULES: R5/R10 unlock defined participation paths — the tiers are access labels, the
          contributions are recorded contributions; the receipt keeps them apart.
        </footer>
      </div>
    </div>
  );
}

export default PoolsWorkspace;
