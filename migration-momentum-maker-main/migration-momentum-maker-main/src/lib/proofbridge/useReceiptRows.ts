'use client';

// src/lib/proofbridge/useReceiptRows.ts
// Single source of truth for HUD rows (Task 39). Memoized on the receipts
// array — react-query structural sharing keeps the reference stable between
// polls unless the chain content changed, so the projection recomputes
// exactly when new receipts land. (Head-hash/length shortcuts were tried
// and are rejected by react-hooks/preserve-manual-memoization under the
// React Compiler; plain [receipts] is equivalent for an append-only chain.)

import { useMemo } from 'react';
import { projectReceipts, type Receipt, type HudRow } from './receiptProjection';

export function useReceiptRows(receipts: Receipt[]): HudRow[] {
  return useMemo(() => projectReceipts(receipts), [receipts]);
}
