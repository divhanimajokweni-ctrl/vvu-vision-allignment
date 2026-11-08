"use client";
// VVU console shell — top env switcher + sidebar + topbar + main view router.
import React from "react";
import { EnvId, allEnvs, getEnv } from "./registry";
import { ToastContainer, toast } from "./toast";
import { EnvErrorBoundary } from "./error-boundary";
import { CommandPalette, useCmdK } from "./cmdk";
import { StatusHeader } from "./status-header";
import { ThemeToggle } from "./theme-toggle";
import { KeyHints } from "./key-hints";
import { BridgeView } from "./bridge";
import { TourAutostart, TourOverlay } from "./tour";
import { NotificationsBell, hookToastCapture } from "./notifications";
import { CommandLine } from "./cmdline";
import { EnvStats } from "./env-stats";
import { FindBar } from "./find";
import { ShareButton } from "./share";
import { initCrossTabSync, startPresenceMonitor, TabPresenceBadge } from "./sync";
import { download } from "@/lib/vvu-utils";
import { useBench } from "./envs/bench/store";
import { useField } from "./envs/field/store";
import { useFire } from "./envs/fire/store";
import { useForge } from "./envs/forge/store";
import { usePress } from "./envs/press/store";

// nav store lives in ./nav to avoid circular imports (env views need useNav)
import { useNav } from "./nav";
export { useNav };
export function useEnv() {
  const env = useNav((s) => s.env);
  return env;
}

function setHtmlEnv(id: EnvId) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-env", id);
  }
}

export function VVUShell() {
  const env = useNav((s) => s.env);
  const view = useNav((s) => s.view);
  const recent = useNav((s) => s.recent);
  const go = useNav((s) => s.go);
  const hydrateFromHash = useNav((s) => s.hydrateFromHash);

  // hydrate from URL hash on mount + listen for hashchange (back/forward buttons)
  React.useEffect(() => {
    hydrateFromHash();
    const onHash = () => hydrateFromHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [hydrateFromHash]);

  // boot animation class on first paint + hook toast capture for notifications
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("vvu-booted");
    }
    hookToastCapture();
    initCrossTabSync();
    startPresenceMonitor();
  }, []);

  React.useEffect(() => { setHtmlEnv(env); }, [env]);

  // pick module
  const mod = env === "overview" || env === "bridge" ? null : getEnv(env);

  // overview = landing (bridge handled separately below)
  if (env === "overview" || (!mod && env !== "bridge")) {
    return (
      <>
        <div className="vvu-app vvu-boot-fade">
          <EnvSwitcher env={env} onPick={(id) => go(id)} />
          <StatusHeader />
          <Landing onPick={(id) => go(id)} recent={recent} onJump={(e, v) => go(e, v)} />
          <footer className="vvu-foot">
            <span>VVU CONSOLE</span>
            <span className="grow" />
            <span>VENTURE VISION UBUNTU · ONE VERIFICATION LAYER · FIVE ENVIRONMENTS</span>
            <span>·</span>
            <span>THE BROWSER IS THE VALIDATOR</span>
            <span>·</span>
            <ThemeToggle />
            <button
              className="vvu-iconbtn"
              onClick={() => useCmdK.getState().openPal()}
              title="command palette (⌘K)"
              aria-label="command palette"
            >⌘K</button>
          </footer>
        </div>
        <CommandPalette />
        <TourOverlay />
        <CommandLine />
        <TourAutostart />
        <KeyHints />
        <ToastContainer />
        <FindBar />
      </>
    );
  }

  // bridge = cross-environment evidence flow console (no own store)
  if (env === "bridge") {
    return (
      <>
        <div className="vvu-app vvu-boot-fade" data-env="bridge">
          <EnvSwitcher env={env} onPick={(id) => go(id)} />
          <StatusHeader />
          <div className="vvu-shell single">
            <main className="vvu-main">
              <header className="vvu-topbar">
                <Breadcrumb env="bridge" mod={BRIDGE_PSEUDO_MOD as any} currentView="flow" onJump={(e, v) => go(e, v)} recent={recent} />
                <span className="sub" style={{ marginLeft: 8 }}>· cross-environment · evidence flows in one direction</span>
                <div className="spacer" />
                <ThemeToggle />
                <button
                  className="vvu-iconbtn"
                  onClick={() => useCmdK.getState().openPal()}
                  title="command palette (⌘K)"
                  aria-label="open command palette"
                >⌘K</button>
              </header>
              <div className="vvu-view">
                <EnvErrorBoundary name="bridge" key="bridge">
                  <BridgeView />
                </EnvErrorBoundary>
              </div>
            </main>
          </div>
          <footer className="vvu-foot">
            <span>BRIDGE · CROSS-ENVIRONMENT CONSOLE</span>
            <span className="grow" />
            <span style={{ color: "var(--vvu-txt)" }}>ONE LAYER · FIVE JOBS · EVIDENCE FLOWS IN ONE DIRECTION</span>
            <span>·</span>
            <span>VENTURE VISION UBUNTU</span>
          </footer>
        </div>
        <CommandPalette />
        <TourOverlay />
        <CommandLine />
        <TourAutostart />
        <KeyHints />
        <ToastContainer />
        <FindBar />
      </>
    );
  }

  // resolve current view (per env) or default
  const currentView = view[env] ?? mod.defaultView;
  const groupOf = (vid: string) => {
    for (const g of mod.groups) if (g.items.some((i) => i.id === vid)) return g.label;
    return "";
  };
  const tb = mod.topbar?.(currentView) ?? { title: currentView, sub: "" };
  const vsubParts = [`· ${groupOf(currentView)}`];
  if (mod.vsubSuffix) vsubParts.push(mod.vsubSuffix);
  const vsub = vsubParts.join(" ");

  // compute counts (defensive — never let badge counts crash the shell)
  let counts: Record<string, number | string> = {};
  if (mod) {
    try { counts = mod.counts?.() ?? {}; }
    catch (e) { console.error("[counts error]", mod.id, e); }
  }

  const exportAll = () => {
    download(`${env}-export.json`, JSON.stringify({ environment: env, exported_at: new Date().toISOString() }, null, 2));
    toast(`exported ${env} package`);
  };

  // wire reset to the active env's store
  const reset = () => {
    const stores: Record<string, () => void> = {
      bench: () => { useBench.getState().reset(); toast("BENCH store reset", "warn"); },
      field: () => { useField.getState().reset(); toast("FIELD store reset", "warn"); },
      fire: () => { useFire.getState().reset(); toast("FIRE store reset", "warn"); },
      forge: () => { useForge.getState().reset(); toast("FORGE store reset", "warn"); },
      press: () => { usePress.getState().reset(); toast("PRESS store reset", "warn"); },
    };
    const fn = stores[env];
    if (fn) {
      if (typeof window !== "undefined" && window.confirm(`Reset the ${mod.brand} store to its initial state? This clears all local data for this environment.`)) {
        fn();
      }
    } else {
      toast(`${mod.brand}: reset not available`, "warn");
    }
  };

  return (
    <>
      <div className="vvu-app">
        <EnvSwitcher env={env} onPick={(id) => go(id)} />
        <StatusHeader />
        <div className="vvu-shell">
          <aside className="vvu-nav" aria-label="environment navigation">
            <div className="vvu-brand">
              <b>{mod.brand}</b>
              <span>{mod.sub} · {mod.spec}</span>
            </div>
            <nav className="vvu-navlist">
              {mod.groups.map((g, gi) => (
                <React.Fragment key={gi}>
                  <div className="vvu-ngroup">{g.label}</div>
                  {g.items.map((it) => (
                    <a
                      key={it.id}
                      className={`vvu-nitem ${currentView === it.id ? "on" : ""}`}
                      onClick={() => { go(env, it.id); }}
                    >
                      <span className="ic">{it.icon}</span>
                      <span>{it.label}</span>
                      {(counts[it.id] ?? it.count) != null && (
                        <span className="ct">{counts[it.id] ?? it.count}</span>
                      )}
                    </a>
                  ))}
                </React.Fragment>
              ))}
            </nav>
            <NavRecent env={env} mod={mod} onJump={(e, v) => go(e, v)} recent={recent} />
            <EnvStats env={env} />
            <div className="vvu-navfoot">
              <span style={{ color: "var(--vvu-accent)" }}>●</span> {mod.footerStatus ?? mod.maxim}
              <br />
              <span>{mod.maxim}</span>
            </div>
          </aside>

          <main className="vvu-main">
            <header className="vvu-topbar">
              <Breadcrumb env={env} mod={mod} currentView={currentView} onJump={(e, v) => go(e, v)} recent={recent} />
              <span className="sub" style={{ marginLeft: 8 }}>{vsub}</span>
              <div className="spacer" />
              <NotificationsBell />
              <ShareButton />
              <ThemeToggle />
              <button
                className="vvu-iconbtn"
                onClick={() => useCmdK.getState().openPal()}
                title="command palette (⌘K)"
                aria-label="open command palette"
              >
                ⌘K
              </button>
              {tb.actions ?? (
                <>
                  <button className="vvu-btn" onClick={exportAll} title="export environment package">⬇ export</button>
                  <button className="vvu-btn danger" onClick={reset} title="reset store">↺ reset</button>
                </>
              )}
            </header>
            <div className="vvu-view">
              <EnvErrorBoundary name={mod.id} key={mod.id}>
                {mod.render(currentView)}
              </EnvErrorBoundary>
            </div>
          </main>
        </div>
        <footer className="vvu-foot">
          <span>{mod.brand} · {mod.spec}</span>
          <TabPresenceBadge />
          <span className="grow" />
          <span style={{ color: "var(--vvu-accent)" }}>{mod.maxim}</span>
          <span>·</span>
          <span>VENTURE VISION UBUNTU</span>
        </footer>
      </div>
      <CommandPalette />
        <TourOverlay />
        <CommandLine />
        <TourAutostart />
      <KeyHints />
      <ToastContainer />
        <FindBar />
    </>
  );
}

function NavRecent({ env, mod, onJump, recent }: {
  env: EnvId;
  mod: NonNullable<ReturnType<typeof getEnv>>;
  onJump: (e: EnvId, v?: string) => void;
  recent: { env: EnvId; view: string; ts: number }[];
}) {
  // show up to 3 recently-visited views IN THIS ENV (excluding the current one)
  const envRecent = recent.filter((r) => r.env === env).slice(0, 3);
  if (envRecent.length === 0) return null;
  return (
    <div className="vvu-navrecent">
      <div className="h">RECENT IN {mod.brand}</div>
      <div className="chips">
        {envRecent.map((r, i) => {
          const item = mod.groups.flatMap((g) => g.items).find((x) => x.id === r.view);
          if (!item) return null;
          return (
            <span key={i} className="chip" onClick={() => onJump(r.env, r.view)} title={`${mod.brand} · ${item.label}`}>
              {item.icon} {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Breadcrumb({ env, mod, currentView, onJump, recent }: {
  env: EnvId;
  mod: NonNullable<ReturnType<typeof getEnv>>;
  currentView: string;
  onJump: (e: EnvId, v?: string) => void;
  recent: { env: EnvId; view: string; ts: number }[];
}) {
  const [open, setOpen] = React.useState(false);
  const viewLabel = mod.groups.flatMap((g) => g.items).find((i) => i.id === currentView)?.label ?? currentView;
  const viewIcon = mod.groups.flatMap((g) => g.items).find((i) => i.id === currentView)?.icon ?? "▸";
  const recentFiltered = recent.filter((r) => !(r.env === env && r.view === currentView)).slice(0, 5);
  return (
    <div className="vvu-crumb">
      <a className="vvu-crumb-link" onClick={() => onJump("overview")} title="back to overview">◆</a>
      <span className="vvu-crumb-sep">/</span>
      <a className="vvu-crumb-link env" onClick={() => onJump(env)} title={`${mod.brand} · ${mod.sub}`}>{mod.brand}</a>
      <span className="vvu-crumb-sep">/</span>
      <span className="vvu-crumb-cur"><span className="ic">{viewIcon}</span> {viewLabel}</span>
      {recentFiltered.length > 0 && (
        <button
          className="vvu-crumb-recent-btn"
          onClick={() => setOpen((o) => !o)}
          title="recently visited"
          aria-expanded={open}
        >
          ⏱ {recentFiltered.length}
        </button>
      )}
      {open && recentFiltered.length > 0 && (
        <div className="vvu-crumb-menu" onMouseLeave={() => setOpen(false)}>
          <div className="vvu-crumb-menu-h">RECENT</div>
          {recentFiltered.map((r, i) => {
            const m = getEnv(r.env);
            if (!m) return null;
            const item = m.groups.flatMap((g) => g.items).find((x) => x.id === r.view);
            const agoS = (() => {
              const s = Math.max(0, Math.floor((Date.now() - r.ts) / 1000));
              if (s < 60) return `${s}s`;
              const mm = Math.floor(s / 60); if (mm < 60) return `${mm}m`;
              return `${Math.floor(mm / 60)}h`;
            })();
            return (
              <a key={i} className="vvu-crumb-menu-row" onClick={() => { onJump(r.env, r.view); setOpen(false); }}>
                <span className="ic" style={{ color: "var(--vvu-accent)" }}>{m.icon}</span>
                <span className="lbl">{m.brand} · {item?.label ?? r.view}</span>
                <span className="ago">{agoS}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EnvSwitcher({ env, onPick }: { env: EnvId; onPick: (e: EnvId) => void }) {
  const envs = allEnvs();
  return (
    <div className="vvu-envbar" role="tablist" aria-label="environment switcher">
      <a
        className={`vvu-envtab ${env === "overview" ? "on" : ""}`}
        onClick={() => onPick("overview")}
        role="tab"
        aria-selected={env === "overview"}
      >
        <span className="vu-ic">◆</span>
        OVERVIEW
      </a>
      {envs.map((m) => (
        <a
          key={m.id}
          className={`vvu-envtab ${env === m.id ? "on" : ""}`}
          onClick={() => onPick(m.id)}
          role="tab"
          aria-selected={env === m.id}
        >
          <span className="vu-dot" style={env === m.id ? { background: "var(--vvu-accent)" } : undefined} />
          <span className="vu-ic">{m.icon}</span>
          {m.label}
        </a>
      ))}
      <a
        className={`vvu-envtab ${env === "bridge" ? "on" : ""}`}
        onClick={() => onPick("bridge" as EnvId)}
        role="tab"
        aria-selected={env === "bridge"}
        title="cross-environment evidence flow console"
      >
        <span className="vu-dot" style={env === "bridge" ? { background: "var(--vvu-txt)" } : undefined} />
        <span className="vu-ic">⇄</span>
        BRIDGE
      </a>
      <span style={{ flex: 1 }} />
      <span className="vvu-envtab" style={{ cursor: "default", color: "var(--vvu-dim2)" }}>
        <span className="vu-ic">⌁</span>
        VVU-CONSOLE · WORM LOCAL · POPIA-RESPECT
      </span>
    </div>
  );
}

function Landing({ onPick, recent, onJump }: {
  onPick: (id: EnvId) => void;
  recent: { env: EnvId; view: string; ts: number }[];
  onJump: (e: EnvId, v?: string) => void;
}) {
  const envs = allEnvs();
  const openCmdK = () => useCmdK.getState().openPal();
  return (
    <div className="vvu-view" style={{ paddingTop: 0 }}>
      <TelemetryTicker />
      <section className="vvu-hero" style={{ marginBottom: 18 }}>
        <div className="vvu-row" style={{ marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
          <span className="vvu-tag a">VVU-CONSOLE-2026-001</span>
          <span className="vvu-tag">PARANOIA-FIRST</span>
          <span className="vvu-tag b">FAIL-CLOSED</span>
          <span className="vvu-tag w">SYNTHETIC-ONLY UNTIL PROVEN</span>
          <span style={{ flex: 1 }} />
          <button className="vvu-btn sm" onClick={openCmdK} title="open command palette (⌘K)">
            ⌘K · jump to anything
          </button>
        </div>
        <h1>One verification layer.<br />Five environments.</h1>
        <p className="lead">
          The <b>Venture Vision Ubuntu</b> console unifies five terminal-style environments
          built over a single evidence layer: a SHA-256 hash-linked WORM ledger, Ed25519
          receipts, canonical envelope hashing, and a fail-closed voice law. Each environment
          has one job and is forbidden from doing another's. <b>The browser is the validator</b> —
          every hash, signature and receipt on this page recomputes locally, and every
          "PROVEN" you see is earned, never asserted.
        </p>
        <div className="vvu-row" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
          <span className="vvu-b ok">SHA-256 · FIPS 180-4 · KAT-verified</span>
          <span className="vvu-b info">Ed25519 · receipt-signed</span>
          <span className="vvu-b warn">WORM · append-only · genesis-linked</span>
          <span className="vvu-b pur">PROPOSED-only · Forge cannot write VERIFIED</span>
          <span className="vvu-b bad">Fire never emits PROVEN</span>
        </div>
        <div className="vvu-row" style={{ marginTop: 14, flexWrap: "wrap", gap: 8 }}>
          {envs.map((m) => (
            <button key={m.id} className="vvu-btn" onClick={() => onPick(m.id)} title={`enter ${m.brand}`}>
              <span style={{ color: "var(--vvu-accent)" }}>{m.icon}</span> {m.brand}
            </button>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="vvu-panel vvu-recent-strip" style={{ marginBottom: 14 }}>
          <header className="vvu-ph">
            <h2>JUMP BACK IN</h2>
            <span className="hint">recently visited · {recent.length}</span>
          </header>
          <div className="vvu-pb">
            <div className="vvu-row wrap" style={{ gap: 8 }}>
              {recent.slice(0, 6).map((r, i) => {
                const m = getEnv(r.env); if (!m) return null;
                const item = m.groups.flatMap((g) => g.items).find((x) => x.id === r.view);
                return (
                  <button key={i} className="vvu-btn" onClick={() => onJump(r.env, r.view)}>
                    <span style={{ color: "var(--vvu-accent)" }}>{m.icon}</span>
                    {m.brand} · {item?.label ?? r.view}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="vvu-cards vvu-envcards-grid">
        {envs.map((m) => (
          <div key={m.id} className="vvu-envcard" onClick={() => onPick(m.id)} data-env-hint={m.id}>
            <div className="h">
              <span className="ic" style={{ color: "var(--vvu-accent)" }}>{m.icon}</span>
              <div>
                <div className="t" style={{ color: "var(--vvu-accent)" }}>{m.brand}</div>
                <div className="s">{m.sub} · {m.spec}</div>
              </div>
            </div>
            <div className="d">{envDescriptions[m.id]}</div>
            <div className="vvu-row wrap" style={{ gap: 4, marginTop: 4 }}>
              {m.groups.flatMap((g) => g.items).slice(0, 5).map((it) => (
                <span key={it.id} className="vvu-tag" style={{ fontSize: 8.5 }}>{it.icon} {it.label}</span>
              ))}
              {m.groups.flatMap((g) => g.items).length > 5 && (
                <span className="vvu-tag" style={{ fontSize: 8.5 }}>+{m.groups.flatMap((g) => g.items).length - 5} more</span>
              )}
            </div>
            <div className="mx">{m.maxim}</div>
          </div>
        ))}
      </div>

      <div className="vvu-grid g21" style={{ marginTop: 18 }}>
        <ActivityFeed onPick={onPick} />
        <section className="vvu-panel">
          <header className="vvu-ph">
            <h2>VOICE LAW</h2>
            <span className="hint">banned words · enforced by every self-test</span>
          </header>
          <div className="vvu-pb">
            <div className="vvu-row" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="vvu-b bad">unassailable</span>
              <span className="vvu-b bad">fully operational</span>
              <span className="vvu-b bad">production-ready</span>
              <span className="vvu-b bad">certified</span>
            </div>
            <p className="vvu-hint" style={{ marginTop: 10 }}>
              Every environment runs a self-test that includes a voice-law check. A banned word in any generated
              receipt, report or claim text fails the suite loudly. Evidence is graded by independence, integrity
              and risk bounds — never by adjective.
            </p>
            <div className="vvu-row wrap" style={{ marginTop: 12, gap: 6 }}>
              <span className="vvu-tag a">SHA-256 KAT ✓</span>
              <span className="vvu-tag b">Ed25519 verify ✓</span>
              <span className="vvu-tag w">chain linkage ✓</span>
              <span className="vvu-tag p">canonical JSON ✓</span>
              <span className="vvu-tag r">tamper-detection ✓</span>
            </div>
          </div>
        </section>
      </div>

      <section className="vvu-panel" style={{ marginTop: 14 }}>
        <header className="vvu-ph">
          <h2>HOW THE ENVIRONMENTS FIT</h2>
          <span className="hint">one layer · five jobs · no environment asserts another's verdict</span>
        </header>
        <div className="vvu-pb">
          <div className="vvu-kv" style={{ gridTemplateColumns: "120px 1fr" }}>
            <dt>FIELD</dt><dd>captures observations offline-first with synthetic-only provenance until a real device is bound.</dd>
            <dt>FORGE</dt><dd>creates envelopes (claims, models, submissions) and may only write status <b>PROPOSED</b>.</dd>
            <dt>BENCH</dt><dd>verifies evidence against a named policy and emits a receipt with a real Ed25519 signature.</dd>
            <dt>FIRE</dt><dd>adversarially tests the same targets and preserves every counterexample as the smallest reproducible failure.</dd>
            <dt>PRESS</dt><dd>publishes only what a Bench receipt permits, holds the rest, and treats publication as irreversible.</dd>
          </div>
        </div>
      </section>
    </div>
  );
}

function TelemetryTicker() {
  // live reads of the 5 env stores for the ticker values
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 2500);
    return () => clearInterval(id);
  }, []);
  let wormHead = "0".repeat(12) + "…";
  let benchReceipts = 0, fieldQueued = 0, fieldDelivered = 0, fireRuns = 0, fireCx = 0, forgeArts = 0, pressPubs = 0;
  try {
    const b = useBench.getState().d;
    if (b.chain.length) wormHead = b.chain[b.chain.length - 1].digest.slice(0, 12) + "…";
    benchReceipts = b.receipts.length;
  } catch {}
  try { const f = useField.getState().d; fieldQueued = f.queue.length; fieldDelivered = f.delivered.length; } catch {}
  try { const fi = useFire.getState().d; fireRuns = fi.runs.length; fireCx = fi.counterexamples.length; } catch {}
  try { const fo = useForge.getState().d; forgeArts = fo.artefacts.length + fo.claims.length; } catch {}
  try { const p = usePress.getState().d; pressPubs = p.publications.length; } catch {}
  const now = new Date().toISOString().slice(11, 19) + "Z";
  const items: { k: string; v: string; cls?: string }[] = [
    { k: "WORM", v: wormHead, cls: "acc" },
    { k: "BENCH", v: `${benchReceipts} rcpt` },
    { k: "FIELD", v: `${fieldQueued}q/${fieldDelivered}d`, cls: "warn" },
    { k: "FIRE", v: `${fireRuns}r/${fireCx}cx`, cls: "bad" },
    { k: "FORGE", v: `${forgeArts} art`, cls: "pur" },
    { k: "PRESS", v: `${pressPubs} pub` },
    { k: "UTC", v: now },
    { k: "STATUS", v: "STEADY_STATE", cls: "acc" },
  ];
  // duplicate the items so the scroll loops seamlessly
  const doubled = [...items, ...items];
  return (
    <div className="vvu-ticker" aria-label="live telemetry ticker">
      <div className="vvu-ticker-track">
        {doubled.map((it, i) => (
          <span key={i} className={`vvu-ticker-item ${it.cls ?? ""}`}>
            <span className="k">{it.k}</span>
            <span className="v">{it.v}</span>
            <span className="sep">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ onPick }: { onPick: (id: EnvId) => void }) {
  // Merge the latest log entries from all 5 env stores.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(id);
  }, []);
  const entries: { env: string; envId: EnvId; type: string; time: number; detail: string }[] = [];
  const push = (envLabel: string, envId: EnvId, log: { type: string; time: number; detail: string }[] | undefined) => {
    if (!log) return;
    for (const e of log.slice(0, 6)) entries.push({ env: envLabel, envId, ...e });
  };
  try { push("BENCH", "bench", readBenchLog()); } catch {}
  try { push("FIELD", "field", readFieldLog()); } catch {}
  try { push("FIRE", "fire", readFireLog()); } catch {}
  try { push("FORGE", "forge", readForgeLog()); } catch {}
  try { push("PRESS", "press", readPressLog()); } catch {}
  entries.sort((a, b) => b.time - a.time);
  const top = entries.slice(0, 14);
  const kindOf = (t: string): "ok" | "info" | "warn" | "bad" | "mut" => {
    if (/fail|tamper|reset|reject|block/.test(t)) return "bad";
    if (/seed|repair|verify|append|capture|publish|create|scaffold|approve|import|run/.test(t)) return "ok";
    if (/sync|export|deliver/.test(t)) return "info";
    return "mut";
  };
  const envColor = (e: string): string => ({
    BENCH: "var(--vvu-acc)", FIELD: "var(--vvu-warn)", FIRE: "var(--vvu-bad)",
    FORGE: "var(--vvu-pur)", PRESS: "var(--vvu-acc2)",
  } as Record<string, string>)[e] || "var(--vvu-dim)";
  return (
    <section className="vvu-panel">
      <header className="vvu-ph">
        <h2>LIVE ACTIVITY</h2>
        <span className="hint">merged append-only log · all 5 environments · refreshes every 3s</span>
      </header>
      <div className="vvu-pb" style={{ padding: 0 }}>
        {top.length === 0 ? (
          <div className="vvu-tempty">no activity yet — visit an environment and capture / verify / run something</div>
        ) : (
          <table className="vvu-tbl">
            <thead>
              <tr>
                <th>ENV</th>
                <th>TYPE</th>
                <th>AGO</th>
                <th>DETAIL</th>
              </tr>
            </thead>
            <tbody>
              {top.map((e, i) => (
                <tr key={i} onClick={() => onPick(e.envId)} style={{ cursor: "pointer" }}>
                  <td style={{ color: envColor(e.env), fontWeight: 600, fontSize: 10 }}>{e.env}</td>
                  <td><span className={`vvu-b ${kindOf(e.type)}`} style={{ fontSize: 8.5 }}>{e.type}</span></td>
                  <td className="mono" style={{ fontSize: 10 }}>{agoSafe(e.time)}</td>
                  <td className="wrap" style={{ fontSize: 10.5 }}>{e.detail.slice(0, 120)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// defensive log readers (in case a store is mid-initialization)
// NOTE: named readBenchLog etc. (not use*) so they are not treated as hooks.
function readBenchLog() { try { return useBench.getState().log as any[]; } catch { return []; } }
function readFieldLog() { try { return useField.getState().log as any[]; } catch { return []; } }
function readFireLog() { try { return useFire.getState().log as any[]; } catch { return []; } }
function readForgeLog() { try { return useForge.getState().log as any[]; } catch { return []; } }
function readPressLog() { try { return usePress.getState().log as any[]; } catch { return []; } }
function agoSafe(t: number) {
  try {
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  } catch { return "?"; }
}

// imports for the activity feed (top of file)

// Pseudo-module for the BRIDGE view (not registered, used only for the breadcrumb)
const BRIDGE_PSEUDO_MOD = {
  id: "bridge" as EnvId,
  label: "BRIDGE",
  icon: "⇄",
  accent: "acc" as const,
  brand: "BRIDGE",
  sub: "CROSS-ENVIRONMENT",
  spec: "VVU-CONSOLE-BRIDGE",
  maxim: "evidence flows in one direction",
  footerStatus: "cross-env · live",
  defaultView: "flow",
  groups: [{ label: "console", items: [{ id: "flow", label: "Evidence Flow", icon: "⇄" }] }],
  render: () => null,
};

const envDescriptions: Record<string, string> = {
  bench: "Verify evidence against a named policy. Real SHA-256, Ed25519-signed receipts, an independent verifier that names the exact broken row.",
  field: "Capture observations offline-first. Durable queue, idempotent sync, gap facts, a synthetic 72-hour disconnection test.",
  fire: "Adversarially test the targets. Threat & expectation registries, authorisation gate, preserved counterexamples, regression replay.",
  forge: "Create envelopes and propose claims. Canonical hashing, four surfaces, tier tags — but the status may only ever be PROPOSED.",
  press: "Communicate what the evidence supports. Extract statements, bind Bench receipts, gate by POPIA consent, version & retract irreversibly.",
};
