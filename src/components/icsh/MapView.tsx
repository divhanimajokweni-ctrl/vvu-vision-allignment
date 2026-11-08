'use client';

// src/components/icsh/MapView.tsx — 14:36 MAP · district head coherence
// folding. Joined farm nodes plot for real; the six horizon regions render
// GHOSTED — red dashed, explicitly NOT YET, never live.

import { useMemo } from 'react';
import { ICSH_GHOST_REGIONS } from '@/lib/icsh/contract';
import type { IcshNodeRow, IcshStatus } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, Empty, KV, Panel, head8 } from './parts';

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function MapSurface({ status, nodes }: { status: IcshStatus | null; nodes: IcshNodeRow[] }) {
  const plotted = useMemo(() => {
    const byDistrict = new Map<string, IcshNodeRow[]>();
    for (const n of nodes) {
      if (n.status !== 'ACTIVE') continue;
      const list = byDistrict.get(n.district) ?? [];
      list.push(n);
      byDistrict.set(n.district, list);
    }
    return [...byDistrict.entries()].map(([district, list]) => {
      const h = hashCode(district);
      const angle = (h % 360) * (Math.PI / 180);
      const r = 96 + (h % 70);
      const cx = 400 + Math.cos(angle) * r;
      const cy = 250 + Math.sin(angle) * r * 0.72;
      return { district, cx, cy, list };
    });
  }, [nodes]);

  const lc = status?.lastCycle ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="VIEWPORT" value="14:36 MAP · COHERENCE FOLDING" tone="lime" />
        <Chip label="DISTRICT HEAD" value={lc ? head8(lc.districtHead) : '—'} tone="green" />
        <Chip label="QUORUM" value={lc ? (lc.agreement ? 'HELD' : `DRIFT ${lc.divergentPeers}`) : '—'} tone={lc?.agreement ? 'green' : 'red'} />
        <Chip label="NODES PLOTTED" value={String(nodes.filter((n) => n.status === 'ACTIVE').length)} />
        <Chip label="GHOST REGIONS" value="6 · NOT YET" tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="ESTATE MAP · GAUTENG ANCHOR + AFRICA HORIZON" className="lg:col-span-3" bodyClass="p-0">
          <svg viewBox="0 0 800 500" className="w-full" role="img" aria-label="estate map with ghosted horizon regions">
            <defs>
              <pattern id="icshgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0c1510" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="800" height="500" fill="#050a07" />
            <rect width="800" height="500" fill="url(#icshgrid)" />

            {/* the estate anchor */}
            <rect x="352" y="212" width="96" height="76" fill="#081009" stroke="#3d5c47" strokeWidth="1.5" />
            <text x="400" y="244" textAnchor="middle" fontSize="10" fill="#7dffa8" fontFamily="monospace" letterSpacing="1">
              FOREST HILL
            </text>
            <text x="400" y="258" textAnchor="middle" fontSize="7" fill="#5f7f68" fontFamily="monospace" letterSpacing="2">
              ESTATE · GAUTENG
            </text>
            <text x="400" y="272" textAnchor="middle" fontSize="7" fill="#3f5748" fontFamily="monospace">
              LIVE
            </text>

            {/* fold lines from estate to district nodes */}
            {plotted.map((p) => (
              <g key={p.district}>
                <line x1="400" y1="250" x2={p.cx} y2={p.cy} stroke="#1d4d2c" strokeWidth="1" strokeDasharray="3 4" />
                <circle cx={p.cx} cy={p.cy} r="5" fill="#04100a" stroke="#c8ff00" strokeWidth="1.6" />
                <text x={p.cx} y={p.cy - 10} textAnchor="middle" fontSize="7.5" fill="#c8ff00" fontFamily="monospace" letterSpacing="1">
                  {p.district}
                </text>
                {p.list.map((n, i) => (
                  <g key={n.id}>
                    <rect x={p.cx - 3 + (i % 3) * 8} y={p.cy + 6 + Math.floor(i / 3) * 8} width="5" height="5" fill="#7dffa8" transform={`rotate(45 ${p.cx - 3 + (i % 3) * 8 + 2.5} ${p.cy + 6 + Math.floor(i / 3) * 8 + 2.5})`} />
                  </g>
                ))}
              </g>
            ))}

            {/* ghost regions — dashed, red, never live */}
            {ICSH_GHOST_REGIONS.map((g) => (
              <g key={g.label}>
                <rect
                  x={(g.x / 100) * 800 - 46}
                  y={(g.y / 100) * 500 - 13}
                  width="92"
                  height="26"
                  fill="rgba(77,32,24,0.16)"
                  stroke="#ff7a6e"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <text x={(g.x / 100) * 800} y={(g.y / 100) * 500 + 3} textAnchor="middle" fontSize="9" fill="#ff7a6e" fontFamily="monospace" letterSpacing="2">
                  {g.label}
                </text>
              </g>
            ))}
            <text x="14" y="486" fontSize="8" fill="#ff7a6e" fontFamily="monospace" letterSpacing="2">
              AFRICA HORIZON · GHOSTED · NOT YET
            </text>
            <text x="786" y="486" textAnchor="end" fontSize="8" fill="#3f5748" fontFamily="monospace">
              no farmer phone on the map
            </text>
          </svg>
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <Panel title="DISTRICT FOLD · LAST CYCLE">
            {lc ? (
              <div>
                <KV k="DISTRICT HEAD" v={head8(lc.districtHead)} tone="text-[#7dffa8]" />
                <KV k="FOLD INPUT" v="25 peer heads → sha256(sorted)" />
                <KV k="AGREEMENT" v={lc.agreement ? 'QUORUM HELD' : `DRIFT · ${lc.divergentPeers} DIVERGENT`} tone={lc.agreement ? 'text-[#7dffa8]' : 'text-[#ff7a6e]'} />
                <KV k="CYCLE" v={`#${lc.cycle.toLocaleString()} · ${lc.viewport}`} />
              </div>
            ) : (
              <Empty lines={['NO CYCLES YET', 'the district head folds once the loop runs']} />
            )}
          </Panel>

          <Panel title="NODES ON CHAIN" bodyClass="p-0">
            <div className="max-h-64 overflow-y-auto icsh-scroll">
              {nodes.length === 0 ? (
                <p className="px-3 py-6 text-center text-[9px] tracking-[0.18em] text-[#5f7f68]">
                  NO FARMERS JOINED YET — JOIN METHOD ▸ TOTP
                </p>
              ) : (
                nodes.map((n) => (
                  <div key={n.id} className="border-b border-[#0e1811] px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className={cn('text-[10px] font-bold tracking-[0.1em]', n.status === 'ACTIVE' ? 'text-[#c8ff00]' : 'text-[#f3e38a]')}>
                        {n.callsign}
                      </span>
                      <span className="text-[8px] text-[#5f7f68]">{n.district}</span>
                      <span className="ml-auto text-[8px] tracking-[0.16em] text-[#5f7f68]">{n.status}</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-[8px] text-[#7d9a84]">{n.farm}</span>
                      <span className="ml-auto text-[8px] tabular-nums text-[#3f5748]">
                        {n.joinCode ? `receipt ${n.joinCode}` : 'no receipt yet'} · trust {n.trust.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
