/**
 * Skylantern — formatting helpers shared by the UI.
 */

import type { VerificationState } from "../types";
import { VERIFICATION_COLORS } from "../types";

export function shortHash(hash: string | null, head = 6, tail = 4): string {
  if (!hash) return "—";
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function absoluteTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Africa/Johannesburg",
  });
}

export function verificationColor(state: VerificationState): string {
  return VERIFICATION_COLORS[state] ?? "#6b7280";
}

export function verificationLabel(state: VerificationState): string {
  switch (state) {
    case "CANDIDATE":
      return "Candidate";
    case "VERIFIED":
      return "Verified";
    case "TAMPER_DETECTED":
      return "Tamper";
    case "ARCHIVED":
      return "Archived";
  }
}

export function verificationToneClass(
  state: VerificationState
): { bg: string; text: string; ring: string; dot: string } {
  switch (state) {
    case "CANDIDATE":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-300",
        ring: "ring-amber-500/30",
        dot: "bg-amber-400",
      };
    case "VERIFIED":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-300",
        ring: "ring-emerald-500/30",
        dot: "bg-emerald-400",
      };
    case "TAMPER_DETECTED":
      return {
        bg: "bg-rose-500/10",
        text: "text-rose-300",
        ring: "ring-rose-500/30",
        dot: "bg-rose-400",
      };
    case "ARCHIVED":
      return {
        bg: "bg-slate-500/10",
        text: "text-slate-300",
        ring: "ring-slate-500/30",
        dot: "bg-slate-400",
      };
  }
}

export function domainLabel(d: string): string {
  switch (d) {
    case "WATER":
      return "Water";
    case "CELLPHONE":
      return "Cellphone";
    case "VEHICLE":
      return "Vehicle";
    default:
      return d;
  }
}

export function primitiveLabel(p: string): string {
  return p.charAt(0) + p.slice(1).toLowerCase();
}

export function formatZAR(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}
