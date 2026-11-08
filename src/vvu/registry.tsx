"use client";
// VVU environment registry — types + runtime registration.
import React from "react";

export type Accent = "acc" | "warn" | "bad" | "pur" | "acc2";
export type EnvId = "overview" | "bench" | "field" | "fire" | "forge" | "press" | "bridge";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  count?: number | string;
}
export interface NavGroup { label: string; items: NavItem[]; }

export interface EnvModule {
  id: EnvId;
  label: string;
  icon: string;
  accent: Accent;
  brand: string;
  sub: string;
  spec: string; // e.g. VVU-ENV-BENCH-2026-001
  maxim: string; // footer maxim line, e.g. "chain: local · persisted"
  groups: NavGroup[];
  defaultView: string;
  counts?: () => Record<string, number | string>;
  render: (viewId: string) => React.ReactNode;
  topbar?: (viewId: string) => { title: string; sub: string; actions?: React.ReactNode };
  footerStatus?: string; // first line of footer, before maxim
  vsubSuffix?: string; // appended to vsub, e.g. "· VVU-GLOSS-2026-001"
}

const registry = new Map<EnvId, EnvModule>();

export function registerEnv(m: EnvModule) { registry.set(m.id, m); }
export function getEnv(id: EnvId): EnvModule | undefined { return registry.get(id); }
export function allEnvs(): EnvModule[] {
  // fixed order
  const order: EnvId[] = ["bench", "field", "fire", "forge", "press"];
  return order.map((id) => registry.get(id)).filter(Boolean) as EnvModule[];
}
