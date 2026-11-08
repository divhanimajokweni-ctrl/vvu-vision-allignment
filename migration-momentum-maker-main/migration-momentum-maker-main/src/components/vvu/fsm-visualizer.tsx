"use client";

import { FSM_STATES, STATE_META, type VvuFsmController } from "@/lib/vvu-fsm-controller";
import { cn } from "@/lib/utils";

interface FsmVisualizerProps {
  controller: VvuFsmController | null;
  currentState: string;
  onDispatch?: (sym: string) => void;
}

const ORDER: Record<string, number> = {
  DISCONNECTED: 0,
  PAIRING_BLE: 1,
  TOTP_VERIFICATION: 2,
  STEADY_STATE_LOCKED: 3,
  LEAK_SIMULATION_ACTIVE: 4,
  THERMAL_THROTTLE: 5,
  FAIL_CLOSED_LOCKDOWN: 6,
};

export function FsmVisualizer({ controller, currentState, onDispatch }: FsmVisualizerProps) {
  const sorted = [...FSM_STATES].sort((a, b) => (ORDER[a] ?? 99) - (ORDER[b] ?? 99));
  const available = controller?.availableSymbols() ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">VVU FSM Controller</h3>
        <span className="text-[10px] text-muted-foreground">
          7-state DFA · 9 symbols · 5°C hysteresis
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {sorted.map((s, i) => {
          const meta = STATE_META[s];
          const active = s === currentState;
          const isPast = (ORDER[s] ?? 0) < (ORDER[currentState] ?? 0);
          const isFailClosed = s === "FAIL_CLOSED_LOCKDOWN";
          return (
            <div key={s}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded border px-3 py-2 transition-all",
                  active ? "shadow-lg" : "",
                )}
                style={{
                  borderColor: active ? meta.color : "#1f2937",
                  background: active ? meta.bg : isPast ? "#0c1018" : "#080b12",
                  boxShadow: active ? `0 0 16px ${meta.color}44` : "none",
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: active ? meta.color : isPast ? meta.color : "#334155",
                    boxShadow: active ? `0 0 6px ${meta.color}` : "none",
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: active ? meta.color : "#cbd5e1" }}
                    >
                      {s.replace(/_/g, " ")}
                    </span>
                    {active && (
                      <span className="rounded bg-lime-500/20 px-1 text-[9px] font-bold text-lime-300">
                        CURRENT
                      </span>
                    )}
                    {isFailClosed && !active && (
                      <span className="rounded bg-red-500/20 px-1 text-[9px] font-bold text-red-300">
                        FAIL-CLOSED
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{meta.description}</div>
                </div>
                {i < sorted.length - 1 && (
                  <span className="text-muted-foreground/40 text-[10px]">▼</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Dispatchable symbols
          </div>
          <div className="flex flex-wrap gap-1.5">
            {available.map((s) => (
              <button
                key={s}
                onClick={() => onDispatch?.(s)}
                className="rounded border border-border bg-card px-2 py-1 font-mono text-[10px] hover:border-lime-700 hover:bg-lime-950 hover:text-lime-300"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {controller && controller.history().length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Recent transitions
          </div>
          <div className="max-h-24 overflow-y-auto rounded border border-border vvu-surface-deep font-mono text-[10px]">
            {controller
              .history()
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <div key={i} className="px-2 py-0.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>{" "}
                  <span className="text-amber-400">{e.symbol}</span>{" "}
                  <span className="text-foreground">{e.from.replace(/_/g, " ")}</span>{" "}
                  <span className="text-muted-foreground">→</span>{" "}
                  <span className="text-lime-400">{e.to.replace(/_/g, " ")}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
