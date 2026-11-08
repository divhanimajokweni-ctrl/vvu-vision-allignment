"use client";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

export function KeyboardHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs">
          <Keyboard className="h-3.5 w-3.5" /> Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <div className="space-y-3 py-2">
          <h2 className="text-sm font-semibold">VVU Validation Dashboard — Operator Cheatsheet</h2>
          <p className="text-[11px] text-muted-foreground">
            The dashboard polls the WORM ledger, telemetry log, and audit trail in real time. All
            hash computations are server-side (crypto.subtle.digest SHA-256). Hash is Proof.
          </p>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold">Keyboard</h3>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-mono">
              <kbd className="rounded bg-muted px-1.5 py-0.5">L</kbd>
              <span>
                Dispatch FSM <b>CLICK</b> symbol — start leak simulation
              </span>
              <kbd className="rounded bg-muted px-1.5 py-0.5">T</kbd>
              <span>Run tamper drill — flags a ledger entry (auto-restores 10s)</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5">R</kbd>
              <span>Force re-walk the WORM verification loop</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5">1</kbd>-
              <kbd className="rounded bg-muted px-1.5 py-0.5">3</kbd>
              <span>Switch site (Gqeberha / Mogalakwena / Marikana)</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5">F</kbd>
              <span>Open FSM dispatch panel</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5">?</kbd>
              <span>Toggle this help dialog</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold">Safe-harbour invariants</h3>
            <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px] font-mono">
              <span>Celerity</span>
              <span className="text-lime-400">200–1400 m/s</span>
              <span>FAVAD N1</span>
              <span className="text-lime-400">0.5–2.5</span>
              <span>Factor of safety</span>
              <span className="text-lime-400">1.5–3.0</span>
              <span>APU nominal</span>
              <span className="text-lime-400">&lt; 65 °C</span>
              <span>APU throttle</span>
              <span className="text-orange-400">≥ 65 °C</span>
              <span>APU fail-closed</span>
              <span className="text-red-400">≥ 85 °C</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold">Three Rings (Borromean)</h3>
            <p className="text-[11px] text-muted-foreground">
              Top = <span style={{ color: "#C46D1A" }}>Venture</span> · Bottom-left ={" "}
              <span style={{ color: "#6B8A40" }}>Ubuntu</span> · Bottom-right ={" "}
              <span style={{ color: "#F3E38A" }}>Vision</span> · Center ={" "}
              <span style={{ color: "#FFFAC2" }}>ProofBridge</span>. Borromean topology: pulling one
              ring breaks all three — interdependence.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
