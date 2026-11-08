'use client';

// src/components/icsh/Rig.tsx — 14:34 RIG · 25km peer sync · 32-byte gossip.
// The 25-peer registry (peers_seed.py lineage) with the live drift state the
// SYNC/COMPARE beats produce. local:// peers are in-process sims — labelled.

import { useQuery } from '@tanstack/react-query';
import type { IcshCycleRow, IcshPeerRow } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, Panel, ago, head8 } from './parts';

export function RigSurface() {
  const peersQ = useQuery({
    queryKey: ['icsh', 'peers'],
    queryFn: async (): Promise<IcshPeerRow[]> => {
      const r = await fetch('/api/icsh/peers');
      if (!r.ok) throw new Error(`peers ${r.status}`);
      const d = (await r.json()) as { peers: IcshPeerRow[] };
      return d.peers;
    },
    refetchInterval: 10000,
  });
  const cyclesQ = useQuery({
    queryKey: ['icsh', 'cycles', 8],
    queryFn: async (): Promise<IcshCycleRow[]> => {
      const r = await fetch('/api/icsh/ledger?mode=cycles&limit=8');
      if (!r.ok) throw new Error(`cycles ${r.status}`);
      const d = (await r.json()) as { cycles: IcshCycleRow[] };
      return d.cycles;
    },
    refetchInterval: 8000,
  });

  const peers = peersQ.data ?? [];
  const cycles = cyclesQ.data ?? [];
  const divergent = peers.filter((p) => p.divergentNow).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="REGISTRY" value={`${peers.length} PEERS`} tone="lime" />
        <Chip label="REACHABLE" value={`${peers.filter((p) => p.reachable).length}/${peers.length}`} tone="green" />
        <Chip label="DIVERGENT NOW" value={String(divergent)} tone={divergent > 0 ? 'red' : 'dim'} />
        <Chip label="QUORUM RULE" value="≥ 18 OF 25" tone="amber" />
        <Chip label="GOSSIP" value="32 B / PEER / CYCLE" className="hidden sm:flex" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          title="PEER REGISTRY · EDGE_GQ_001…025"
          className="lg:col-span-3"
          bodyClass="p-0"
          right={<span className="text-[8px] tracking-[0.2em] text-[#3f5748]">LOCAL:// = IN-PROCESS SIM</span>}
        >
          <div className="max-h-96 overflow-y-auto icsh-scroll">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#081009] text-[8px] tracking-[0.22em] text-[#5f7f68]">
                <tr>
                  <th className="px-3 py-2 font-normal">NODE</th>
                  <th className="px-3 py-2 font-normal">ENDPOINT</th>
                  <th className="px-3 py-2 font-normal">BUCKET</th>
                  <th className="px-3 py-2 font-normal">HEAD (8)</th>
                  <th className="px-3 py-2 font-normal">SYNC</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.nodeId} className="border-t border-[#0e1811] hover:bg-[#081009]">
                    <td className="px-3 py-1.5 text-[10px] font-bold text-[#9dbda4]">{p.nodeId}</td>
                    <td className="px-3 py-1.5 text-[9px] text-[#5f7f68]">{p.endpoint}</td>
                    <td className="px-3 py-1.5 text-[10px] tabular-nums text-[#7d9a84]">b{p.bucket}</td>
                    <td className="px-3 py-1.5 text-[10px] tabular-nums text-[#7dffa8]">{head8(p.simulatedHead)}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          'text-[8px] font-bold tracking-[0.18em]',
                          p.divergentNow ? 'text-[#ff7a6e]' : 'text-[#7dffa8]'
                        )}
                      >
                        {p.divergentNow ? 'DRIFT' : 'MATCH'}
                      </span>
                    </td>
                  </tr>
                ))}
                {peers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[9px] tracking-[0.2em] text-[#5f7f68]">
                      SEEDING REGISTRY…
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <Panel title="GOSSIP FEED · LAST 8 CYCLES" bodyClass="p-0">
            <div className="max-h-56 overflow-y-auto icsh-scroll">
              {cycles.map((c) => (
                <div key={c.seq} className="flex items-baseline gap-2 border-b border-[#0e1811] px-3 py-1.5">
                  <span className="text-[9px] tabular-nums text-[#3f5748]">#{c.cycle}</span>
                  <span className="text-[9px] tabular-nums text-[#7dffa8]">{head8(c.head)}</span>
                  <span
                    className={cn(
                      'ml-auto text-[8px] font-bold tracking-[0.14em]',
                      c.agreement ? 'text-[#7dffa8]' : 'text-[#ff7a6e]'
                    )}
                  >
                    {c.agreement ? 'QUORUM' : `DRIFT ${c.divergentPeers}`}
                  </span>
                  <span className="text-[8px] tabular-nums text-[#3f5748]">{ago(c.at)}</span>
                </div>
              ))}
              {cycles.length === 0 ? (
                <p className="px-3 py-6 text-center text-[9px] tracking-[0.2em] text-[#5f7f68]">NO CYCLES YET — RUN THE LOOP</p>
              ) : null}
            </div>
          </Panel>

          <Panel title="SYNC BEAT · HOW DRIFT WORKS">
            <div className="space-y-2 text-[9px] leading-relaxed tracking-[0.08em] text-[#7d9a84]">
              <p>
                ▸ Each peer holds one 32-byte bucket head. Buckets roll every 2,500 cycles, staggered 25 cycles per peer — the registry SIMULATES drift and the sync beat DETECTS it.
              </p>
              <p>
                ▸ Divergence after a rollover is correct behaviour: those peers have not yet seen the new bucket. Quorum (≥ 18 of 25) is what the COMPARE beat asserts.
              </p>
              <p>
                ▸ To join real farms: replace <span className="text-[#7dffa8]">local://</span> endpoints with LAN IPs (<span className="text-[#7dffa8]">http://192.168.x.x:8080</span>) — the sync beat reads the registry the same way.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
