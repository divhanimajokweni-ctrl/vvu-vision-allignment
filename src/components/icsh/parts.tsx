// src/components/icsh/parts.tsx — shared presentational atoms for the 4th
// state surfaces. Terminal DNA: mono, uppercase, tracked labels, lime accents
// on the estate's phosphor field.

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function pad(n: number, w = 5): string {
  return String(n).padStart(w, '0');
}

export function head8(h: string | null | undefined): string {
  if (!h) return '—';
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

export function fmtBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '—';
  if (b < 1024) return `${Math.round(b)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Chip({
  label,
  value,
  tone = 'dim',
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: 'dim' | 'lime' | 'amber' | 'red' | 'green';
  className?: string;
}) {
  const tones: Record<string, string> = {
    dim: 'text-[#7d9a84] border-[#1d2f22] bg-[#070d09]',
    lime: 'text-[#c8ff00] border-[#3d4d12] bg-[#0c0f04]',
    amber: 'text-[#f3e38a] border-[#4d4418] bg-[#0f0d04]',
    red: 'text-[#ff7a6e] border-[#4d2018] bg-[#100604]',
    green: 'text-[#7dffa8] border-[#1d4d2c] bg-[#04100a]',
  };
  return (
    <div className={cn('flex items-baseline gap-1.5 border px-2 py-1', tones[tone], className)}>
      <span className="text-[8px] tracking-[0.22em] opacity-70">{label}</span>
      <span className="text-[11px] font-bold tabular-nums leading-none icsh-glow">{value}</span>
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
  bodyClass,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cn('border border-[#16241a] bg-[#060b08]', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-[#16241a] bg-[#081009] px-3 py-2">
        <h3 className="text-[10px] font-bold tracking-[0.28em] text-[#9dbda4] uppercase">{title}</h3>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </header>
      <div className={cn('p-3', bodyClass)}>{children}</div>
    </section>
  );
}

export function KV({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#142019] py-1.5 last:border-0">
      <span className="text-[9px] tracking-[0.2em] text-[#5f7f68] uppercase whitespace-nowrap">{k}</span>
      <span className={cn('text-[11px] tabular-nums text-right', tone ?? 'text-[#c9e4cd]')}>{v}</span>
    </div>
  );
}

export function Empty({ lines, action }: { lines: string[]; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-[#1d3325] bg-[#050a07] px-6 py-10 text-center">
      {lines.map((l, i) => (
        <p key={i} className={cn('text-[11px] tracking-[0.18em]', i === 0 ? 'text-[#f3e38a]' : 'text-[#5f7f68]')}>
          {l}
        </p>
      ))}
      {action}
    </div>
  );
}

export function HonestyCard({ lines, title = 'HONESTY' }: { lines: readonly string[]; title?: string }) {
  return (
    <div className="border border-dashed border-[#4d4418] bg-[#0a0904] p-3">
      <p className="text-[8px] tracking-[0.3em] text-[#f3e38a] mb-2">{title} — WRITTEN INTO THE PRODUCT SURFACE</p>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-[9px] leading-relaxed text-[#a89f6e]">
            ▸ {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IcshButton({
  children,
  onClick,
  tone = 'ghost',
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'ghost' | 'lime' | 'amber' | 'red';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const tones: Record<string, string> = {
    ghost: 'border-[#24402c] text-[#9dbda4] hover:border-[#7dffa8] hover:text-[#c9e4cd]',
    lime: 'border-[#4d5d12] text-[#c8ff00] hover:bg-[#141a04] icsh-glow-lime',
    amber: 'border-[#4d4418] text-[#f3e38a] hover:bg-[#141104]',
    red: 'border-[#4d2018] text-[#ff7a6e] hover:bg-[#160806]',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'border bg-transparent px-3 py-1.5 text-[10px] font-bold tracking-[0.22em] uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        tones[tone],
        className
      )}
    >
      {children}
    </button>
  );
}
