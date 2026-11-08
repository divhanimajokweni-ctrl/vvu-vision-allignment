'use client';

// src/components/spatial/WormTicker.tsx — bottom strip: append-only WORM ledger
// marquee. Auto-scrolls slowly, pauses on hover, respects reduced motion.
// R88 — keys carry the position index: a reconnect replay can land the same
// seq+ts in the chain twice, and a data-only key then renders two children
// with the same key (React logs the collision and identity goes undefined).
// The ticker's items are position-shaped (relative-time cells), so the index
// is part of the item's identity by design — dups become impossible.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useWormChain } from '@/hooks/use-vvu-socket';
import type { WormSimEvent } from '@/types/vvu';

const TICKER_KEYFRAMES = `
@keyframes vvuMarquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.vvu-marquee-track {
  animation: vvuMarquee var(--vvu-marquee-dur, 48s) linear infinite;
  will-change: transform;
}
.vvu-marquee-wrap:hover .vvu-marquee-track,
.vvu-marquee-wrap:focus-within .vvu-marquee-track {
  animation-play-state: paused;
}
/* segment zebra tint — every other event reads as its own block (static
   background, no animation: reduced-motion safe by construction) */
.vvu-marquee-track .vvu-tick-item:nth-child(even) {
  background: rgba(107, 138, 64, 0.06);
}
/* R88 — edge fades: the marquee's items hard-clip at the container edge,
   which reads as a rendering bug on wide entries; a static 28px mask fades
   each side out instead (pure CSS, no runtime cost, reduced-motion safe —
   the mask applies identically with the animation off). */
.vvu-marquee-wrap {
  --vvu-marquee-fade: 28px;
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 var(--vvu-marquee-fade),
    #000 calc(100% - var(--vvu-marquee-fade)),
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 var(--vvu-marquee-fade),
    #000 calc(100% - var(--vvu-marquee-fade)),
    transparent 100%
  );
}
@media (prefers-reduced-motion: reduce) {
  .vvu-marquee-track { animation: none; }
}
`;

function relTime(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function TickerItem({ evt, now }: { evt: WormSimEvent; now: number }) {
  return (
    <span className="vvu-tick-item inline-flex items-center gap-1.5 px-3.5 whitespace-nowrap border-l border-[rgba(107,138,64,0.28)]">
      <span className="text-[#8fb35a]">#{String(evt.seq).padStart(3, '0')}</span>
      <span className="text-[#f3e38a]/80">{evt.source}</span>
      <span className="text-[#c9d4bd]">{evt.event}</span>
      <span className="text-[#2ea8a0]">
        {evt.hash ? `∎${evt.hash.slice(0, 8)}` : '∎????????'}
      </span>
      <span className="text-[#7a8a6e]">{relTime(evt.ts, now)}</span>
    </span>
  );
}

export function WormTicker() {
  const chain = useWormChain();
  const [now, setNow] = useState<number>(() => Date.now());

  // Refresh relative timestamps every 10s (events themselves trigger renders).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const events = chain.slice(-16);

  return (
    <>
      <style>{TICKER_KEYFRAMES}</style>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        className="absolute bottom-0 left-0 right-0 z-20 h-7 flex items-stretch bg-[rgba(6,8,6,0.94)] border-t border-[rgba(107,138,64,0.25)] backdrop-blur-sm"
        role="status"
        aria-label="WORM ledger live feed"
      >
        <div className="flex items-center gap-1.5 px-2 sm:px-3 shrink-0 border-r border-[rgba(107,138,64,0.25)] bg-[rgba(11,15,10,0.9)]">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-[#c8ff00] vvu-pulse shrink-0"
            aria-hidden="true"
          />
          <span className="vvu-label text-[6.5px] sm:text-[8px] text-[#c8ff00] font-bold whitespace-nowrap">
            WORM · APPEND-ONLY
          </span>
        </div>

        <div
          className="vvu-marquee-wrap relative flex-1 overflow-hidden vvu-label text-[8px] sm:text-[9px] font-mono"
          tabIndex={0}
        >
          {events.length === 0 ? (
            <div className="flex items-center h-full px-3 text-[#7a8a6e]">
              <span className="vvu-blink">◉</span>
              <span className="ml-2">AWAITING TELEMETRY SERVICE · CHAIN COLD</span>
            </div>
          ) : (
            <div
              className="vvu-marquee-track flex items-center h-full w-max"
              style={{ ['--vvu-marquee-dur' as string]: `${Math.max(32, events.length * 5)}s` }}
            >
              <div className="flex items-center h-full">
                {events.map((e, i) => (
                  <TickerItem key={`a-${e.seq}-${e.ts}-${i}`} evt={e} now={now} />
                ))}
              </div>
              <div className="flex items-center h-full" aria-hidden="true">
                {events.map((e, i) => (
                  <TickerItem key={`b-${e.seq}-${e.ts}-${i}`} evt={e} now={now} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center px-2 shrink-0 border-l border-[rgba(107,138,64,0.25)] text-[#7a8a6e] vvu-label text-[8px]">
          {events.length > 0 ? `EVT/${events[events.length - 1].seq}` : 'EVT/—'}
        </div>
      </motion.div>
    </>
  );
}

export default WormTicker;
