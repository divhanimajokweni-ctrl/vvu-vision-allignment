"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { AnatomyAdapter, type RendererInterface } from "@/adapters/anatomy/AnatomyAdapter";
import { RENDER_MODE, type VisualState, type RenderMode } from "@/lib/anatomy/visual-state";

interface AnatomyPanelProps {
  id: string;
  type: string;
  appState: Partial<VisualState>;
  onInteraction?: (componentId: string, data: unknown) => void;
  className?: string;
  children?: ReactNode;
}

export function AnatomyPanel({
  id,
  type,
  appState,
  onInteraction,
  className = "",
  children,
}: AnatomyPanelProps) {
  const adapterRef = useRef<AnatomyAdapter | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<VisualState | null>(null);

  useEffect(() => {
    adapterRef.current = new AnatomyAdapter({
      id,
      type,
      renderer: null,
      onInteraction: onInteraction ?? (() => {}),
    });

    adapterRef.current.init().then(() => setIsReady(true)).catch((e) => setError(e.message));

    return () => {
      if (adapterRef.current) adapterRef.current.destroy();
    };
  }, [id, type, onInteraction]);

  useEffect(() => {
    if (adapterRef.current && isReady) {
      try {
        adapterRef.current.update(appState);
        setCurrentState(adapterRef.current.getState());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [appState, isReady]);

  return (
    <div
      className={`anatomy-panel rounded-lg border border-border/60 bg-card/40 p-4 ${className}`}
      data-anatomy-id={id}
      data-anatomy-type={type}
    >
      {error && (
        <div
          className="mb-3 rounded border border-[var(--vvu-crimson)]/40 bg-[var(--vvu-crimson)]/10 p-2 text-xs"
          style={{ color: "var(--vvu-crimson)" }}
        >
          ⚠ {error}
        </div>
      )}
      {children}
      {currentState && (
        <div className="mt-2 text-[10px] font-mono text-muted-foreground">
          status: {currentState.verification.status} · confidence:{" "}
          {(currentState.verification.confidence * 100).toFixed(0)}% · sources:{" "}
          {currentState.sources.length} · provenanceRef:{" "}
          {currentState.verification.provenanceRef ? "✓" : "—"}
        </div>
      )}
    </div>
  );
}

export function AnatomyControls({
  adapter,
  currentMode,
}: {
  adapter: AnatomyAdapter | null;
  currentMode: RenderMode;
}) {
  if (!adapter) return null;
  return (
    <div className="flex items-center gap-1">
      {Object.values(RENDER_MODE).map((mode) => (
        <button
          key={mode}
          onClick={() => adapter.setMode(mode)}
          className={
            "rounded px-2 py-1 text-[10px] font-mono transition-colors " +
            (currentMode === mode
              ? "bg-[var(--vvu-lime)]/10 text-[var(--vvu-lime)] border border-[var(--vvu-lime)]/30"
              : "text-muted-foreground hover:bg-muted/40 border border-transparent")
          }
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export function AnatomyReadout({ state }: { state: VisualState | null }) {
  if (!state) return null;
  return (
    <div className="rounded border border-border/40 bg-muted/20 p-3 text-[10px] font-mono">
      <div className="mb-1 text-muted-foreground">VISUAL STATE READOUT</div>
      <div>id: {state.id}</div>
      <div>type: {state.type}</div>
      <div>mode: {state.mode}</div>
      <div>system: {state.system.status} / {state.system.health}</div>
      <div>verification: {state.verification.status}</div>
      <div>confidence: {(state.verification.confidence * 100).toFixed(1)}%</div>
      <div>blockedReason: {state.verification.blockedReason ?? "—"}</div>
      <div>provenanceRef: {state.verification.provenanceRef ?? "—"}</div>
      <div>sources: {state.sources.length}</div>
      <div>events: {state.events.length}</div>
    </div>
  );
}
