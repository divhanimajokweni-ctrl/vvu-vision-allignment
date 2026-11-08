'use client';

// src/components/icsh/IcshWorkspace.tsx — THE 4TH STATE, deployed.
// #/ (default) · contract on chain · THE LEDGER AS STORAGE.
//
// The accepted Manifest artifact (CITY TWIN / RIG / WORM LEDGER / MAP /
// TRUST SPHERE · JOIN METHOD · TOTP wizard · CRT), promoted from a
// localStorage artifact to the estate's on-chain build: every surface on
// this page reads and writes the real WORM ledger through /api/icsh/*.
//
// Surfaces: 14:32 CITY TWIN · 14:34 RIG · 14:35 WORM LEDGER · 14:36 MAP ·
// 14:37 TRUST SPHERE · 14:38 COST MATRIX (run iterations + the cost matrix
// the operator ordered: "you will give the matrix").

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Volume2, VolumeX, Monitor, Radio } from 'lucide-react';
import { ICSH_HONESTY, ICSH_VIEWPORTS } from '@/lib/icsh/contract';
import type { IcshNodeRow, IcshStatus } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, ago, head8 } from './parts';
import { setSoundEnabled, sfx } from './sound';
import { JoinWizard } from './JoinWizard';
import { CityTwinSurface } from './CityTwin';
import { RigSurface } from './Rig';
import { WormLedgerSurface } from './WormLedger';
import { MapSurface } from './MapView';
import { TrustSphereSurface } from './TrustSphere';
import { CostMatrixSurface } from './CostMatrix';
import { SessionLabSurface } from './SessionLab';
import { PyFlywheelSurface } from './PyFlywheel';

type Surface = 'CITY TWIN' | 'RIG' | 'WORM LEDGER' | 'MAP' | 'TRUST SPHERE' | 'COST MATRIX' | 'SESSION LAB' | 'PY FLYWHEEL';

const SURFACES: { key: Surface; clock: string }[] = [
  ...ICSH_VIEWPORTS.map((v) => ({
    key: v.name as Surface,
    clock: v.clock,
  })),
  // PY FLYWHEEL is a UI-level surface reading the live Python flywheel core
  // (vvu-trust) — the on-chain contract (ICSH_VIEWPORTS) is untouched.
  { key: 'PY FLYWHEEL', clock: '14:40' },
];

/** Real measured render FPS (requestAnimationFrame EMA, 2×/s updates). */
function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

export function IcshWorkspace() {
  const queryClient = useQueryClient();
  const fps = useFps();
  const [surface, setSurface] = useState<Surface>('CITY TWIN');
  // lazy init from localStorage — the workspace is a client-only dynamic
  // import, so window exists on first render (no hydration effect needed)
  const [crt, setCrt] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem('icsh:crt') !== '0' : true
  );
  const [sound, setSound] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem('icsh:sound') !== '0' : true
  );
  const [wizardOpen, setWizardOpen] = useState(false);
  const bootPlayed = useRef(false);

  useEffect(() => setSoundEnabled(sound), [sound]);

  useEffect(() => {
    if (!bootPlayed.current) {
      bootPlayed.current = true;
      // first gesture unlocks audio; boot chirp rides any first click
      const once = () => {
        sfx.boot();
        window.removeEventListener('pointerdown', once);
      };
      window.addEventListener('pointerdown', once);
      return () => window.removeEventListener('pointerdown', once);
    }
  }, []);

  const statusQ = useQuery({
    queryKey: ['icsh', 'status'],
    queryFn: async (): Promise<IcshStatus> => {
      const r = await fetch('/api/icsh/status');
      if (!r.ok) throw new Error(`status ${r.status}`);
      return (await r.json()) as IcshStatus;
    },
    refetchInterval: 5000,
  });
  const nodesQ = useQuery({
    queryKey: ['icsh', 'nodes'],
    queryFn: async (): Promise<IcshNodeRow[]> => {
      const r = await fetch('/api/icsh/nodes');
      if (!r.ok) throw new Error(`nodes ${r.status}`);
      const d = (await r.json()) as { nodes: IcshNodeRow[] };
      return d.nodes;
    },
    refetchInterval: 15000,
  });

  const status = statusQ.data ?? null;
  const nodes = nodesQ.data ?? [];
  const activeNodes = useMemo(() => nodes.filter((n) => n.status === 'ACTIVE'), [nodes]);
  const runner = activeNodes[0]?.callsign ?? 'OPERATOR';

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['icsh'] });
  }, [queryClient]);

  const pick = (s: Surface) => {
    if (s !== surface) {
      setSurface(s);
      sfx.tab();
    }
  };

  const st = status;

  return (
    <div className={cn('relative h-full w-full flex flex-col bg-[#040705] font-mono text-[#c9e4cd] select-none', crt && 'icsh-crt')}>
      {crt ? <div className="icsh-scanbeam" aria-hidden="true" /> : null}

      {/* ── TOP STRIP — the artifact's header, now on-chain ───────────────── */}
      <header className="relative z-20 flex h-auto min-h-12 flex-wrap items-center gap-2 border-b border-[#16241a] bg-[#050a07] px-3 py-2 sm:px-4">
        <div className="mr-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#c8ff00] icsh-glow-lime icsh-blink" aria-hidden="true" />
          <div className="leading-none">
            <div className="text-[12px] font-black tracking-[0.3em] text-[#c8ff00] icsh-glow-lime">VVU · MANIFEST</div>
            <div className="mt-1 text-[8px] tracking-[0.34em] text-[#5f7f68]">4TH STATE · ON CHAIN</div>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <Chip label="FPS" value={fps > 0 ? String(fps) : '—'} />
          <Chip
            label="AGENTS"
            value={st ? `${st.nodes?.active ?? 0}${st.peers?.total ? `+${st.peers.total}P` : ''}` : '—'}
          />
          <Chip label="TIER" value={st?.tier ?? '—'} tone="amber" />
          <Chip
            label="TRUST"
            value={st?.trust !== null && st?.trust !== undefined ? st.trust.toFixed(2) : '—'}
            tone={st?.trust !== null && st?.trust !== undefined ? 'green' : 'dim'}
            className="hidden sm:flex"
          />
          <Chip label="FILES" value={st?.vaultNodes?.toLocaleString() ?? '—'} tone="lime" />
          <Chip label="SOURCE" value="ICSH · 11-BEAT" className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title={sound ? 'SOUND ON' : 'SOUND OFF'}
            aria-label={sound ? 'sound on' : 'sound off'}
            onClick={() => {
              const v = !sound;
              setSound(v);
              window.localStorage.setItem('icsh:sound', v ? '1' : '0');
              if (v) sfx.click();
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center border transition-colors',
              sound ? 'border-[#24402c] text-[#7dffa8]' : 'border-[#22301f] text-[#4a5f4e]'
            )}
          >
            {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            title={crt ? 'CRT ON' : 'CRT OFF'}
            aria-label={crt ? 'crt on' : 'crt off'}
            onClick={() => {
              const v = !crt;
              setCrt(v);
              window.localStorage.setItem('icsh:crt', v ? '1' : '0');
              sfx.click();
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center border transition-colors',
              crt ? 'border-[#3d4d12] text-[#c8ff00]' : 'border-[#22301f] text-[#4a5f4e]'
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setWizardOpen(true);
              sfx.seal();
            }}
            className="flex items-center gap-2 border border-[#4d5d12] bg-[#0c0f04] px-3 py-1.5 text-[10px] font-black tracking-[0.24em] text-[#c8ff00] icsh-glow-lime transition-colors hover:bg-[#141a04]"
          >
            <Radio className="h-3.5 w-3.5" />
            JOIN METHOD
          </button>
        </div>
      </header>

      {/* ── TAB RAIL ───────────────────────────────────────────────────────── */}
      <nav
        className="relative z-20 flex overflow-x-auto border-b border-[#16241a] bg-[#060b08] icsh-scroll"
        aria-label="4th state surfaces"
      >
        {SURFACES.map((s) => {
          const active = s.key === surface;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pick(s.key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-baseline gap-2 border-b-2 px-3.5 py-2.5 text-[10px] font-bold tracking-[0.2em] transition-colors sm:px-4',
                active
                  ? 'border-[#c8ff00] bg-[#0a0f06] text-[#c8ff00] icsh-glow-lime'
                  : 'border-transparent text-[#5f7f68] hover:text-[#9dbda4]'
              )}
            >
              <span className={cn('text-[8px]', active ? 'text-[#7dffa8]' : 'text-[#3f5748]')}>{s.clock}</span>
              {s.key}
            </button>
          );
        })}
      </nav>

      {/* ── ZOOM COHERENCE RAIL — the pinch line, live ─────────────────────── */}
      <div className="relative z-20 flex items-center gap-2 overflow-x-auto border-b border-[#111c14] bg-[#040806] px-3 py-1.5 icsh-scroll sm:px-4">
        <span className="text-[8px] tracking-[0.26em] text-[#3f5748] whitespace-nowrap">ZOOM VIEWPORT</span>
        {['14:32 CITY TWIN', '14:34 RIG', '14:36 MAP', '14:37 TRUST SPHERE'].map((v, i) => (
          <span key={v} className="flex items-center gap-2 whitespace-nowrap">
            {i > 0 ? <span className="text-[#2c4433]">──►</span> : null}
            <span
              className={cn(
                'text-[9px] tracking-[0.14em]',
                st?.lastCycle?.viewport?.startsWith(v.slice(0, 5))
                  ? 'text-[#7dffa8] icsh-glow'
                  : 'text-[#5f7f68]'
              )}
            >
              {v}
            </span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 whitespace-nowrap">
          <span className="text-[8px] tracking-[0.2em] text-[#3f5748]">MEM 32 B FLAT</span>
          <span className="text-[8px] tracking-[0.2em] text-[#3f5748]">
            HEAD <span className="text-[#7dffa8]">{st?.head ? head8(st.head) : '—'}</span>
          </span>
          <span className="hidden text-[8px] tracking-[0.2em] text-[#3f5748] sm:inline">
            LEDGER <span className="text-[#c8ff00]">{st?.cycles?.toLocaleString() ?? '—'}</span> LINES
          </span>
        </span>
      </div>

      {/* ── SURFACE ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto icsh-scroll" aria-live="polite">
        <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
          {surface === 'CITY TWIN' ? <CityTwinSurface status={st} /> : null}
          {surface === 'RIG' ? <RigSurface /> : null}
          {surface === 'WORM LEDGER' ? <WormLedgerSurface /> : null}
          {surface === 'MAP' ? <MapSurface status={st} nodes={nodes} /> : null}
          {surface === 'TRUST SPHERE' ? <TrustSphereSurface status={st} nodes={nodes} /> : null}
          {surface === 'COST MATRIX' ? <CostMatrixSurface runner={runner} onRun={refreshAll} /> : null}
          {surface === 'SESSION LAB' ? <SessionLabSurface /> : null}
          {surface === 'PY FLYWHEEL' ? <PyFlywheelSurface /> : null}

          {/* ── the honesty strip — bottom of every surface ── */}
          <footer className="mt-6 border border-dashed border-[#1d3325] bg-[#050a07] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] tracking-[0.16em] text-[#a89f6e]">
                “{ICSH_HONESTY[0]}”
              </p>
              <p className="text-[8px] tracking-[0.16em] text-[#5f7f68]">
                CONTRACT @{st?.contract ? `SEQ ${st.contract.seq}` : '—'} · {st?.contract ? ago(st.contract.deployedAt) : '—'} · LEDGER AS STORAGE
              </p>
            </div>
            <p className="mt-1.5 text-[9px] tracking-[0.12em] text-[#6e8a75]">{ICSH_HONESTY[1]}</p>
          </footer>
        </div>
      </main>

      {/* ── JOIN METHOD — the universal TOTP path ── */}
      <JoinWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onJoined={() => {
          refreshAll();
        }}
      />
    </div>
  );
}
