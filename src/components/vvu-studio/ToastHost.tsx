/**
 * VVU · STUDIO — toast host.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";

export function ToastHost() {
  const toast = useStudio((s) => s.toast);
  return (
    <div
      className={
        "fixed left-1/2 z-[200] -translate-x-1/2 rounded-md border px-4 py-2 text-center text-[12px] transition-all duration-200 " +
        (toast ? "opacity-100" : "pointer-events-none opacity-0") +
        " " +
        (toast?.kind === "ok"
          ? "border-[#065f46] bg-[var(--vs-accentbg)] text-[var(--vs-accent)]"
          : toast?.kind === "err"
          ? "border-[#7f1d1d] bg-[var(--vs-redbg)] text-[var(--vs-red)]"
          : "border-[var(--vs-border2)] bg-[var(--vs-bg3)] text-[var(--vs-text)]")
      }
      style={{ bottom: "calc(var(--vs-nav-h) + var(--vs-safe-bot) + 16px)", maxWidth: "90vw" }}
    >
      {toast?.msg ?? ""}
    </div>
  );
}
