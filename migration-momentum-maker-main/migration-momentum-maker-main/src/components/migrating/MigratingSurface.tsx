// The honest placeholder for estate projections whose migration pass has not
// landed yet. Rendered inside the dashboard's workspace area.

export function MigratingSurface({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-auto bg-[#060806] p-6">
      <div className="max-w-lg text-center">
        <div className="vvu-label text-2xl font-bold tracking-[0.3em] text-[#f3e38a]">VVU</div>
        <div className="vvu-label mt-3 text-[11px] tracking-[0.24em] text-[#c8ff00]">{label}</div>
        <div className="vvu-label mt-6 text-[9px] tracking-[0.18em] text-[#7a8a6e]">
          SURFACE QUEUED · MIGRATING IN A LATER PASS
        </div>
        <div className="vvu-label mt-2 text-[8px] tracking-[0.16em] text-[#4a5744]">
          THE ESTATE'S CORE TEN SURFACES ARE LIVE — THIS PROJECTION FOLLOWS
        </div>
      </div>
    </div>
  );
}

export default MigratingSurface;
