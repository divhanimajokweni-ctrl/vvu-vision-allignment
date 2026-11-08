"use client";
// VVU vim-style command line — press `:` to open a command input.
// Supports: :bench verify, :fire run, :press receipts, :export, :reset bench,
// :theme light, :theme dark, :selftest, :bridge, :overview, :help
import React from "react";
import { create } from "zustand";
import { useNav } from "./nav";
import { allEnvs, EnvId } from "./registry";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";
import { useTheme } from "./theme-toggle";
import { useCmdK } from "./cmdk";

interface CmdLineState {
  open: boolean;
  q: string;
  output: { text: string; kind: string } | null;
  history: string[];
  setQ: (q: string) => void;
  openCL: () => void;
  close: () => void;
  run: (q: string) => void;
}

export const useCmdLine = create<CmdLineState>((set, get) => ({
  open: false,
  q: "",
  output: null,
  history: [],
  setQ: (q) => set({ q }),
  openCL: () => set({ open: true, q: "", output: null }),
  close: () => set({ open: false, q: "", output: null }),
  run: (q) => {
    const raw = q.trim();
    if (!raw) { set({ open: false }); return; }
    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts[1]?.toLowerCase();
    const arg2 = parts[2]?.toLowerCase();
    let output = "";
    let kind = "info";

    const envMap: Record<string, EnvId> = {
      bench: "bench", field: "field", fire: "fire", forge: "forge", press: "press",
      bridge: "bridge", overview: "overview", o: "overview", b: "bench", f: "field",
      i: "fire", r: "forge", p: "press", d: "bridge",
    };

    // :<env> [view]
    if (envMap[cmd] && cmd !== "export" && cmd !== "reset" && cmd !== "theme" && cmd !== "selftest" && cmd !== "help" && cmd !== "clear") {
      const envId = envMap[cmd];
      useNav.getState().go(envId);
      if (arg) {
        // try to match a view id or label
        const m = allEnvs().find((e) => e.id === envId);
        if (m) {
          const item = m.groups.flatMap((g) => g.items).find((it) => it.id === arg || it.label.toLowerCase().includes(arg));
          if (item) useNav.getState().go(envId, item.id);
        }
      }
      output = `→ ${envId.toUpperCase()}${arg ? "/" + arg : ""}`;
      kind = "ok";
    } else if (cmd === "export" || cmd === "x") {
      // trigger the topbar export button
      const btn = document.querySelector(".vvu-topbar button[title*='export']") as HTMLButtonElement | null;
      if (btn) { btn.click(); output = "export triggered"; kind = "ok"; }
      else { output = "no export button in current view (try an env view)"; kind = "warn"; }
    } else if (cmd === "reset" || cmd === "rm") {
      const envId = arg && envMap[arg] ? envMap[arg] : useNav.getState().env;
      if (envId === "overview" || envId === "bridge") { output = "cannot reset overview/bridge"; kind = "bad"; }
      else {
        const stores: Record<string, any> = { bench: useBench, field: useField, fire: useFire, forge: useForge, press: usePress };
        const s = stores[envId];
        if (s) {
          if (typeof window !== "undefined" && window.confirm(`Reset ${envId.toUpperCase()} store?`)) {
            s.getState().reset();
            output = `→ ${envId.toUpperCase()} store reset`; kind = "warn";
          } else { output = "reset cancelled"; kind = "mut"; }
        }
      }
    } else if (cmd === "theme" || cmd === "th") {
      if (arg === "light" || arg === "dark") {
        useTheme.getState().set(arg);
        output = `→ theme: ${arg}`; kind = "ok";
      } else {
        useTheme.getState().toggle();
        output = `→ theme toggled to ${useTheme.getState().theme}`; kind = "ok";
      }
    } else if (cmd === "selftest" || cmd === "st") {
      // navigate to the current env's selftest, or bridge's console self-test
      const envId = useNav.getState().env;
      if (envId === "bridge") {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("console-wide self-test"));
        if (btn) { (btn as HTMLButtonElement).click(); output = "→ console-wide self-test started"; kind = "ok"; }
      } else if (envId !== "overview") {
        useNav.getState().go(envId, "selftest");
        output = `→ ${envId.toUpperCase()} self-test`; kind = "ok";
      } else { output = "go to an env first"; kind = "warn"; }
    } else if (cmd === "palette" || cmd === "cmdk" || cmd === "k") {
      useCmdK.getState().openPal();
      output = "→ command palette opened"; kind = "ok";
    } else if (cmd === "help" || cmd === "?" || cmd === "h") {
      output = "commands: :bench [view] · :fire run · :press receipts · :export · :reset bench · :theme light|dark · :selftest · :bridge · :overview · :palette";
      kind = "info";
    } else if (cmd === "clear" || cmd === "cls") {
      set({ history: [], output: null, open: false });
      return;
    } else {
      output = `unknown command: ${cmd} — try :help`;
      kind = "bad";
    }

    set((s) => ({
      q: "",
      output: { text: output, kind },
      history: [raw, ...s.history].slice(0, 20),
    }));
    // auto-close after 1.5s if it was a navigation
    if (kind === "ok" && output.startsWith("→")) {
      setTimeout(() => set((s) => ({ open: false, output: null })), 1200);
    }
  },
}));

export function CommandLine() {
  const open = useCmdLine((s) => s.open);
  const q = useCmdLine((s) => s.q);
  const output = useCmdLine((s) => s.output);
  const history = useCmdLine((s) => s.history);
  const setQ = useCmdLine((s) => s.setQ);
  const run = useCmdLine((s) => s.run);
  const close = useCmdLine((s) => s.close);
  const [hIdx, setHIdx] = React.useState(-1);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        // only the command-line input itself should capture `:`
        if (e.key === "Escape") close();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ":" && !open) {
        e.preventDefault();
        useCmdLine.getState().openCL();
      } else if (e.key === "Escape" && open) {
        close();
      } else if (open) {
        if (e.key === "Enter") {
          e.preventDefault();
          run(q);
          setHIdx(-1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const next = Math.min(history.length - 1, hIdx + 1);
          setHIdx(next);
          if (history[next]) setQ(history[next]);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.max(-1, hIdx - 1);
          setHIdx(next);
          if (next === -1) setQ("");
          else if (history[next]) setQ(history[next]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, q, history, hIdx, run, setQ, close]);

  if (!open) return null;

  return (
    <div className="vvu-cmdline-overlay" onClick={close}>
      <div className="vvu-cmdline" onClick={(e) => e.stopPropagation()}>
        <div className="vvu-cmdline-prompt">
          <span className="vvu-cmdline-glyph">:</span>
          <input
            className="vvu-cmdline-input"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            ref={(el) => { if (el && open) { try { el.focus(); } catch {} } }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // read the DOM value (robust against programmatic fills that bypass React state)
                const v = (e.currentTarget as HTMLInputElement).value;
                e.preventDefault();
                run(v);
                setHIdx(-1);
              } else if (e.key === "Escape") {
                close();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const next = Math.min(history.length - 1, hIdx + 1);
                setHIdx(next);
                if (history[next]) setQ(history[next]);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = Math.max(-1, hIdx - 1);
                setHIdx(next);
                if (next === -1) setQ("");
                else if (history[next]) setQ(history[next]);
              }
            }}
            placeholder="enter command…  (try: bench verify · fire run · reset bench · theme light · selftest · help)"
            spellCheck={false}
          />
        </div>
        {output && (
          <div className={`vvu-cmdline-output vvu-cmdline-out-${output.kind}`}>{output.text}</div>
        )}
        {history.length > 0 && (
          <div className="vvu-cmdline-history">
            <span className="h">HISTORY</span>
            {history.slice(0, 6).map((h, i) => (
              <span key={i} className="vvu-cmdline-hentry" onClick={() => { setQ(h); run(h); }}>{h}</span>
            ))}
          </div>
        )}
        <div className="vvu-cmdline-foot">
          <span><kbd>↵</kbd> run</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> history</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>press <kbd>:</kbd> anytime</span>
        </div>
      </div>
    </div>
  );
}
