/**
 * VVU · STUDIO — mobile watch drawer body.
 */
"use client";
import { VideoIcon } from "./Icons";

export function WatchTileMobile() {
  return (
    <div className="space-y-3 p-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <div className="absolute left-0 right-0 h-px bg-[var(--vs-accent)]/40" style={{ animation: "vvu-scan 3s linear infinite" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[var(--vs-dim)]">
          <VideoIcon size={32} className="text-[var(--vs-dimmer)]" />
          <span className="mono text-[10px] tracking-[0.18em]">LIVE SESSION</span>
          <span className="mono text-[9px] text-[var(--vs-dimmer)]">WebRTC stub — 0x0D</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[var(--vs-dim)]">
        <span className="text-[var(--vs-accent)]">● LIVE</span>
        <span>· 24 viewers</span>
        <span className="ml-auto">2.4 Mbps</span>
      </div>
      <div className="rounded-md border border-[var(--vs-border2)] bg-[var(--vs-bg3)] px-3 py-2 text-[12px] text-[var(--vs-dim)]">
        WebRTC session recording is a <span className="text-[var(--vs-amber)]">stub</span> in this prototype.
        The doctrine: a stubbed gate is flagged, never silently computed.
      </div>
    </div>
  );
}
