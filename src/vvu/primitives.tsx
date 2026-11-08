"use client";
// VVU shared UI primitives — React equivalents of the HTML designs.
import React from "react";
import { toast } from "./toast";
import { download } from "@/lib/vvu-utils";

// ---------- Panel ----------
export function Panel({
  title, hint, right, children, bodyClass,
}: {
  title?: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="vvu-panel">
      {(title || hint || right) && (
        <header className="vvu-ph">
          {title && <h2>{title}</h2>}
          {hint && <span className="hint">{hint}</span>}
          {right && <div className="right">{right}</div>}
        </header>
      )}
      <div className={`vvu-pb ${bodyClass ?? ""}`}>{children}</div>
    </section>
  );
}

// ---------- Grid ----------
export function Grid({ cls = "", children }: { cls?: string; children: React.ReactNode }) {
  return <div className={`vvu-grid ${cls}`}>{children}</div>;
}

// ---------- KPI ----------
export interface KPIItem {
  l: string;
  v: React.ReactNode;
  d?: React.ReactNode;
  c?: "a" | "b" | "w" | "r" | "p";
  spark?: number[]; // optional sparkline data (recent values)
}
export function KPIs({ items }: { items: KPIItem[] }) {
  return (
    <div className="vvu-kpis">
      {items.map((it, i) => (
        <div key={i} className={`vvu-kpi ${it.c ?? ""} ${it.spark ? "with-spark" : ""}`}>
          <div className="l">{it.l}</div>
          <div className="v">{it.v}</div>
          {it.spark && it.spark.length > 1 && <Sparkline data={it.spark} kind={it.c} />}
          {it.d && <div className="d">{it.d}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- Sparkline ----------
export function Sparkline({ data, kind, width = 80, height = 18 }: {
  data: number[];
  kind?: "a" | "b" | "w" | "r" | "p";
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M${points.join(" L")}`;
  const areaPath = `M0,${height} L${points.join(" L")} L${width},${height} Z`;
  const colorVar = kind === "a" ? "var(--vvu-acc)" : kind === "b" ? "var(--vvu-acc2)" : kind === "w" ? "var(--vvu-warn)" : kind === "r" ? "var(--vvu-bad)" : kind === "p" ? "var(--vvu-pur)" : "var(--vvu-accent)";
  const last = data[data.length - 1];
  const prev = data[data.length - 2] ?? last;
  const trendUp = last > prev;
  const trendDown = last < prev;
  return (
    <svg className="vvu-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }}>
      <path className="area" d={areaPath} style={{ fill: colorVar }} />
      <path d={linePath} style={{ stroke: colorVar }} />
      {trendUp && (
        <circle cx={width} cy={height - ((last - min) / range) * (height - 2) - 1} r="1.5" style={{ fill: colorVar }} />
      )}
      <span style={{ display: "none" }} data-trend={trendUp ? "up" : trendDown ? "down" : "flat"} />
    </svg>
  );
}

// ---------- Badge ----------
export function Badge({
  children, kind = "mut",
}: {
  children: React.ReactNode;
  kind?: "ok" | "info" | "warn" | "bad" | "pur" | "mut";
}) {
  return <span className={`vvu-b ${kind}`}>{children}</span>;
}

export function Tag({ children, kind }: { children: React.ReactNode; kind?: "a" | "b" | "w" | "r" | "p" }) {
  return <span className={`vvu-tag ${kind ?? ""}`}>{children}</span>;
}

export function Mono({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span className="vvu-mono" title={title}>{children}</span>;
}

// ---------- CodeBlock ----------
export function Code({ children, empty }: { children?: React.ReactNode; empty?: boolean }) {
  return <pre className={`vvu-code ${empty ? "empty" : ""}`}>{children ?? "—"}</pre>;
}

// ---------- KV ----------
export function KV({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className="vvu-kv">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ---------- Alist ----------
export interface Arow {
  dot?: "ok" | "warn" | "info" | "crit" | "mut";
  title: React.ReactNode;
  lines?: React.ReactNode[];
  side?: React.ReactNode;
}
export function Alist({ rows }: { rows: Arow[] }) {
  return (
    <div className="vvu-alist">
      {rows.map((r, i) => (
        <div key={i} className="vvu-arow">
          <span className={`sv ${r.dot ?? "mut"}`} />
          <div className="body">
            <b>{r.title}</b>
            {r.lines?.map((ln, j) => (
              <div key={j} className="ln">{ln}</div>
            ))}
          </div>
          {r.side && <div className="side">{r.side}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- Checklist ----------
export interface ChkRow { pass?: "pass" | "fail" | "run"; name: string; detail?: string }
export function Checklist({ rows }: { rows: ChkRow[] }) {
  return (
    <div className="vvu-alist">
      {rows.map((r, i) => (
        <div key={i} className={`vvu-chk ${r.pass ?? "run"}`}>
          <span className="mk">{r.pass === "pass" ? "✓" : r.pass === "fail" ? "✗" : "·"}</span>
          <span className="nm">{r.name}</span>
          {r.detail && <span className="dt">{r.detail}</span>}
        </div>
      ))}
    </div>
  );
}

// ---------- Gate ----------
export function Gate({
  ok, children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`vvu-gate ${ok ? "ok" : "no"}`}>
      <span className="dot" />
      <div>{children}</div>
    </div>
  );
}

// ---------- Timeline ----------
export function Timeline({ steps, on }: { steps: string[]; on: number }) {
  return (
    <div className="vvu-tl">
      {steps.map((s, i) => (
        <div key={i} className={`step ${i < on ? "on" : ""}`}>{s.replace(/_/g, " ")}</div>
      ))}
    </div>
  );
}

// ---------- Form ----------
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="vvu-fld">
      <label>{label}</label>
      {children}
    </div>
  );
}

export const inputCls = "vvu-input";
export const selectCls = "vvu-select";
export const textareaCls = "vvu-textarea";

// ---------- Table ----------
export interface Col {
  k: string;
  l: string;
  num?: boolean;
  mono?: boolean;
  wrap?: boolean;
  badge?: boolean; // render cell value as Badge (value must be a kind string like "ok")
  sort?: (a: any, b: any) => number;
}
export interface TableOpts {
  name?: string; // for csv/json filename
  onSelect?: (row: any) => void;
  selectedId?: string | null;
  selectedKey?: string; // which field is the id
}
export function Table({
  cols, rows, opts = {},
}: {
  cols: Col[];
  rows: Record<string, any>[];
  opts?: TableOpts;
}) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<{ k: string; dir: 1 | -1 } | null>(null);
  const [renderKey, setRenderKey] = React.useState(0);

  const filtered = React.useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      r = r.filter((row) =>
        cols.some((c) => String(row[c.k] ?? "").toLowerCase().includes(ql))
      );
    }
    if (sort) {
      const col = cols.find((c) => c.k === sort.k);
      r = [...r].sort((a, b) => {
        const av = a[sort.k], bv = b[sort.k];
        let cmp = 0;
        if (col?.num) cmp = Number(av) - Number(bv);
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return cmp * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort, cols]);

  const toggleSort = (k: string) => {
    setSort((prev) => {
      if (!prev || prev.k !== k) return { k, dir: 1 };
      if (prev.dir === 1) return { k, dir: -1 };
      return null;
    });
    setRenderKey((x) => x + 1);
  };

  const exportCsv = () => {
    const header = cols.map((c) => c.l).join(",");
    const lines = filtered.map((row) =>
      cols.map((c) => `"${String(row[c.k] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    download(`${opts.name ?? "table"}.csv`, header + "\n" + lines.join("\n"), "text/csv");
    toast(`exported ${filtered.length} rows · csv`);
  };
  const exportJson = () => {
    download(`${opts.name ?? "table"}.json`, JSON.stringify(filtered, null, 2));
    toast(`exported ${filtered.length} rows · json`);
  };

  return (
    <div className="vvu-panel" style={{ marginBottom: 14 }}>
      <div className="vvu-twrap" style={{ border: "none", borderRadius: 0 }}>
        <div className="vvu-tbar">
          <input
            placeholder="filter…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="filter rows"
          />
          <span className="cnt">{filtered.length} rows</span>
          <div className="right">
            <button className="vvu-btn sm" onClick={exportCsv}>csv</button>
            <button className="vvu-btn sm" onClick={exportJson}>json</button>
          </div>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          <table className="vvu-tbl">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.k} onClick={() => toggleSort(c.k)}>
                    {c.l}
                    {sort?.k === c.k ? <span className="ar">{sort.dir === 1 ? "▲" : "▼"}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className="vvu-tempty">no records</td>
                </tr>
              ) : (
                filtered.map((row, i) => {
                  const isSel =
                    opts.selectedId != null &&
                    opts.selectedKey &&
                    row[opts.selectedKey] === opts.selectedId;
                  return (
                    <tr
                      key={i}
                      className={isSel ? "sel" : ""}
                      onClick={() => opts.onSelect?.(row)}
                      style={{ cursor: opts.onSelect ? "pointer" : "default" }}
                    >
                      {cols.map((c) => {
                        const v = row[c.k];
                        if (c.badge && typeof v === "string") {
                          return <td key={c.k}><Badge kind={v as any}>{v}</Badge></td>;
                        }
                        return (
                          <td
                            key={c.k}
                            className={`${c.mono ? "mono" : ""} ${c.num ? "num" : ""} ${c.wrap ? "wrap" : ""}`}
                            onClick={c.mono && v ? (e) => {
                              e.stopPropagation();
                              const text = String(v);
                              try {
                                navigator.clipboard?.writeText(text);
                              } catch {}
                              const el = e.currentTarget as HTMLElement;
                              el.classList.add("copied");
                              setTimeout(() => el.classList.remove("copied"), 600);
                              toast(`copied · ${text.slice(0, 20)}${text.length > 20 ? "…" : ""}`, "ok");
                            } : undefined}
                            title={c.mono && v ? "click to copy" : undefined}
                          >
                            {v ?? "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- Button ----------
export function Btn({
  children, onClick, kind = "", sm, disabled, title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "p" | "danger" | "";
  sm?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const cls = ["vvu-btn"];
  if (sm) cls.push("sm");
  if (kind) cls.push(kind);
  return (
    <button
      className={cls.join(" ")}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

// ---------- Cards ----------
export function Cards({ children }: { children: React.ReactNode }) {
  return <div className="vvu-cards">{children}</div>;
}
export function Card({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="vvu-card">
      {title && <div className="t">{title}</div>}
      <div className="m">{children}</div>
    </div>
  );
}

// ---------- Progress bar ----------
export function Bar({ value, kind }: { value: number; kind?: "lo" | "md" | "" }) {
  const cls = ["vvu-bar"];
  if (kind) cls.push(kind);
  return (
    <div className={cls.join(" ")}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// ---------- Hint ----------
export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="vvu-hint">{children}</p>;
}

// ---------- Row ----------
export function Row({ children, wrap, className = "", style }: { children: React.ReactNode; wrap?: boolean; className?: string; style?: React.CSSProperties }) {
  return <div className={`vvu-row ${wrap ? "wrap" : ""} ${className}`}>{children}</div>;
}
