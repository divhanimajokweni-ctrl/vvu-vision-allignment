import type { ReactNode } from "react";

export function IveBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="ive-site relative flex min-h-screen flex-col overflow-hidden antialiased">
      <div className="ive-scanline relative flex min-h-screen w-full flex-col">
        <div className="ive-grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(circle at 50% 45%, rgba(201,168,76,.1), transparent 55%)",
          }}
        />
        {children}
      </div>
    </div>
  );
}
