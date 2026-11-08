/**
 * VVU · STUDIO — shared UI primitives for the interactive views.
 */
import type { ReactNode } from "react";
import type { GateStatus } from "@/lib/vvu-studio/types";

export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={"rounded-lg border border-[var(--vs-border)] bg-[var(--vs-bg2)] " + className}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-[var(--vs-border)] px-3 py-2">
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-[var(--vs-dim)]">
            {title}
          </span>
          {right}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "pass" | "fail" | "stub" | "t1" | "t2" | "t3" | "t4";
}) {
  const tones: Record<string, string> = {
    default: "border-[var(--vs-border2)] text-[var(--vs-text2)] bg-[var(--vs-bg3)]",
    pass: "border-[#065f46] text-[var(--vs-accent)] bg-[var(--vs-accentbg)]",
    fail: "border-[#7f1d1d] text-[var(--vs-red)] bg-[var(--vs-redbg)]",
    stub: "border-[#78350f] text-[var(--vs-amber)] bg-[var(--vs-amberbg)]",
    t1: "border-[#065f46] text-[var(--vs-accent)] bg-[var(--vs-accentbg)]",
    t2: "border-[#1e3a8a] text-[#569cd6] bg-[#0a1330]",
    t3: "border-[#78350f] text-[var(--vs-amber)] bg-[var(--vs-amberbg)]",
    t4: "border-[#7f1d1d] text-[var(--vs-red)] bg-[var(--vs-redbg)]",
  };
  return (
    <span
      className={"mono inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] " + tones[tone]}
    >
      {children}
    </span>
  );
}

export function GateBadge({ status }: { status: GateStatus }) {
  if (status === "PASS") return <Badge tone="pass">PASS</Badge>;
  if (status === "FAIL") return <Badge tone="fail">FAIL</Badge>;
  return <Badge tone="stub">STUB</Badge>;
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    default:
      "border border-[var(--vs-border2)] bg-[var(--vs-bg3)] text-[var(--vs-text2)] hover:border-[var(--vs-border3)] hover:text-[var(--vs-text)]",
    primary:
      "border border-transparent bg-[var(--vs-accent2)] text-[#022c22] font-semibold hover:bg-[var(--vs-accent)]",
    ghost:
      "border border-transparent bg-transparent text-[var(--vs-dim)] hover:text-[var(--vs-text2)]",
    danger:
      "border border-[#7f1d1d] bg-[var(--vs-redbg)] text-[var(--vs-red)] hover:bg-[#5a0a0a]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "mono inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] transition-colors disabled:opacity-40 " +
        variants[variant] +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="mono text-[10px] uppercase tracking-[0.1em] text-[var(--vs-dim)]">{label}</span>
      {children}
    </label>
  );
}

export function Term({ lines }: { lines: { t: string; v: string }[] }) {
  return (
    <div className="mono max-h-72 overflow-y-auto rounded-md border border-[var(--vs-border)] bg-[#050507] p-3 text-[12px] leading-[1.65] text-[#c4c4cc]">
      {lines.length === 0 && <div className="text-[var(--vs-dimmer)]"># awaiting</div>}
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            l.t === "err" ? "text-[var(--vs-red)]" :
            l.t === "ok" ? "text-[var(--vs-accent)]" :
            l.t === "warn" ? "text-[var(--vs-amber)]" :
            l.t === "dim" ? "text-[var(--vs-dim)]" :
            l.t === "in" ? "text-[var(--vs-text)]" :
            "text-[#c4c4cc]"
          }
        >
          {l.t === "in" ? "❯ " : ""}
          {l.v || "\u00A0"}
        </div>
      ))}
    </div>
  );
}
