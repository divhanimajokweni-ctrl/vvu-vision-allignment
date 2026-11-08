// VVU Studio lib — fs module
// The virtual file system the explorer renders + the tab metadata the tab
// strip + mobile shell consult. Every node is either a folder (has children)
// or a file (has a view key + an extension badge).

import type { ViewKey } from "./types";

/** A node in the file system tree. Folders have `children`; files have a
 *  `view` (the ViewKey the editor opens) and an `ext` (the badge colour). */
export interface FsNode {
  name: string;
  children?: FsNode[];
  view?: ViewKey;
  ext?: "md" | "py" | "json";
}

/** The root tree — mirrors what the explorer renders. The first level is
 *  always expanded; deeper levels toggle on click. */
export const FILE_SYSTEM: FsNode = {
  name: "vvu-studio",
  children: [
    {
      name: "the loop",
      children: [
        { name: "loop.py", view: "loop", ext: "py" },
        { name: "rules.py", view: "rules", ext: "py" },
        { name: "receipts.json", view: "receipts", ext: "json" },
        { name: "items.py", view: "items", ext: "py" },
        { name: "commit.py", view: "commit", ext: "py" },
        { name: "verify.py", view: "verify", ext: "py" },
        { name: "board.py", view: "board", ext: "py" },
        { name: "tree.py", view: "tree", ext: "py" },
        { name: "stats.py", view: "stats", ext: "py" },
        { name: "stakeholder.md", view: "stakeholder", ext: "md" },
      ],
    },
    {
      name: "docs",
      children: [
        { name: "README.md", view: "readme", ext: "md" },
        { name: "doctrine.md", view: "doctrine", ext: "md" },
        { name: "lesson0.md", view: "lesson0", ext: "md" },
        { name: "lesson1.md", view: "lesson1", ext: "md" },
        { name: "lesson2.md", view: "lesson2", ext: "md" },
        { name: "lesson3.md", view: "lesson3", ext: "md" },
      ],
    },
    {
      name: ".vvu",
      children: [
        { name: "gates.py", view: "gates", ext: "py" },
        { name: "config.json", view: "config", ext: "json" },
      ],
    },
    {
      name: "labs",
      children: [
        { name: "lab0_plane.py", view: "lab0", ext: "py" },
        { name: "lab1_lucky.py", view: "lab1", ext: "py" },
        { name: "lab2_credential.py", view: "lab2", ext: "py" },
      ],
    },
    {
      name: "ive",
      children: [
        { name: "pipeline.py", view: "ive", ext: "py" },
        { name: "hash_builder.py", view: "hash", ext: "py" },
      ],
    },
    {
      name: "depot",
      children: [{ name: "gate_eval.py", view: "depot", ext: "py" }],
    },
    {
      name: "receipts",
      children: [{ name: "ledger.json", view: "ledger", ext: "json" }],
    },
  ],
};

/** Metadata for each open tab. `label` is the tab strip text; `ext` is the
 *  badge colour. The explorer uses the same record to label files in the
 *  tree (so a rename here propagates everywhere). */
export const TAB_META: Record<ViewKey, { label: string; ext: "md" | "py" | "json" }> = {
  loop: { label: "loop.py", ext: "py" },
  rules: { label: "rules.py", ext: "py" },
  receipts: { label: "receipts.json", ext: "json" },
  items: { label: "items.py", ext: "py" },
  commit: { label: "commit.py", ext: "py" },
  verify: { label: "verify.py", ext: "py" },
  board: { label: "board.py", ext: "py" },
  tree: { label: "tree.py", ext: "py" },
  stats: { label: "stats.py", ext: "py" },
  stakeholder: { label: "stakeholder.md", ext: "md" },
  readme: { label: "README.md", ext: "md" },
  doctrine: { label: "doctrine.md", ext: "md" },
  gates: { label: "gates.py", ext: "py" },
  config: { label: "config.json", ext: "json" },
  lab0: { label: "lab0_plane.py", ext: "py" },
  lab1: { label: "lab1_lucky.py", ext: "py" },
  lab2: { label: "lab2_credential.py", ext: "py" },
  ive: { label: "pipeline.py", ext: "py" },
  hash: { label: "hash_builder.py", ext: "py" },
  depot: { label: "gate_eval.py", ext: "py" },
  ledger: { label: "ledger.json", ext: "json" },
  lesson0: { label: "lesson0.md", ext: "md" },
  lesson1: { label: "lesson1.md", ext: "md" },
  lesson2: { label: "lesson2.md", ext: "md" },
  lesson3: { label: "lesson3.md", ext: "md" },
};

/** Walk the FILE_SYSTEM tree once and invert it: view key → containing
 *  folder name. Used by the breadcrumb (group › file) and the mobile tab
 *  strip's compact label. */
function buildGroupIndex(): Record<ViewKey, string> {
  const out: Partial<Record<ViewKey, string>> = {};
  function walk(node: FsNode, group: string | null) {
    if (node.children) {
      for (const child of node.children) walk(child, node.name);
    } else if (node.view) {
      out[node.view] = group ?? node.name;
    }
  }
  walk(FILE_SYSTEM, null);
  return out as Record<ViewKey, string>;
}
const GROUP_INDEX: Record<ViewKey, string> = buildGroupIndex();

/** The folder name a tab lives in — used by the breadcrumb (group › file)
 *  and the mobile label. Returns "studio" for unknown views. */
export function groupOf(tabId: ViewKey): string {
  return GROUP_INDEX[tabId] ?? "studio";
}

/** A compact label for mobile tabs — short enough to fit several across a
 *  360px viewport. Strips the extension and common prefixes. */
export function mobileLabel(tabId: ViewKey): string {
  const meta = TAB_META[tabId];
  if (!meta) return tabId;
  return meta.label.replace(/\.(md|py|json)$/, "");
}
