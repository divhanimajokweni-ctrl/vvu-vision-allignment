"use client";
// VVU toast bus — tiny zustand store + fixed container
import { create } from "zustand";

export type ToastKind = "info" | "ok" | "warn" | "bad";
export interface VVUToast { id: string; msg: string; kind: ToastKind; out: boolean; }

interface ToastState {
  toasts: VVUToast[];
  push: (msg: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (msg, kind = "info") => {
    const id = `t${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind, out: false }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, out: true } : t)) }));
    }, 2200);
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(msg: string, kind: ToastKind = "info") {
  useToastStore.getState().push(msg, kind);
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="vvu-toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`vvu-tst ${t.kind} ${t.out ? "out" : ""}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
