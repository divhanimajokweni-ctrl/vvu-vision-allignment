/**
 * VVU · STUDIO — editor router. Maps activeTab to the right view.
 */
"use client";
import { useStudio } from "@/lib/vvu-studio/store";
import { DocView } from "./views/DocView";
import { ConfigView } from "./views/ConfigView";
import { GatesView } from "./views/GatesView";
import { Lab0View } from "./views/Lab0View";
import { Lab1View } from "./views/Lab1View";
import { Lab2View } from "./views/Lab2View";
import { IveView } from "./views/IveView";
import { HashView } from "./views/HashView";
import { DepotView } from "./views/DepotView";
import { LedgerView } from "./views/LedgerView";
import { EmptyView } from "./views/EmptyView";
import { LoopView } from "./views/LoopView";
import { RulesView } from "./views/RulesView";
import { ReceiptsView } from "./views/ReceiptsView";
import { OpenItemsView } from "./views/OpenItemsView";
import { CommitView } from "./views/CommitView";
import { VerifyView } from "./views/VerifyView";
import { BoardView } from "./views/BoardView";
import { TreeView } from "./views/TreeView";
import { StatsView } from "./views/StatsView";
import { StakeholderView } from "./views/StakeholderView";

export function Editor() {
  const active = useStudio((s) => s.activeTab);
  if (!active) return <EmptyView />;
  switch (active) {
    case "stakeholder":
      return <StakeholderView />;
    case "loop":
      return <LoopView />;
    case "rules":
      return <RulesView />;
    case "receipts":
      return <ReceiptsView />;
    case "items":
      return <OpenItemsView />;
    case "commit":
      return <CommitView />;
    case "verify":
      return <VerifyView />;
    case "board":
      return <BoardView />;
    case "tree":
      return <TreeView />;
    case "stats":
      return <StatsView />;
    case "readme":
    case "doctrine":
    case "lesson0":
    case "lesson1":
    case "lesson2":
    case "lesson3":
      return <DocView view={active} />;
    case "config":
      return <ConfigView />;
    case "gates":
      return <GatesView />;
    case "lab0":
      return <Lab0View />;
    case "lab1":
      return <Lab1View />;
    case "lab2":
      return <Lab2View />;
    case "ive":
      return <IveView />;
    case "hash":
      return <HashView />;
    case "depot":
      return <DepotView />;
    case "ledger":
      return <LedgerView />;
    default:
      return <EmptyView />;
  }
}
