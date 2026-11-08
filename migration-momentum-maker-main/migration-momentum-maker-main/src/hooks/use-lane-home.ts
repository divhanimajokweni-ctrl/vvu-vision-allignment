"use client";

// src/hooks/use-lane-home.ts — R183 · THE LANES' RETURN, the state
// idiom five lane panels share: the asked read's home-flash state —
// the R181 board idiom, lane-sized. A clicked read that LANDS calls
// announceHome(): the arrival instant is captured (the component's own
// clock — the engine never reads one), the button wears the house lime
// for REREAD_HOME_MS (the window's own named constant), and the
// sibling live region speaks the lane's home line once. The unasked
// passes (mount, 60s self-read) never call it; a failed read never
// reaches it — the component announces on success only. The timer is
// a ref — a dismount mid-flash cleans up after itself (the withdraw
// idiom). One idiom, five lanes — composition, not duplication.

import { useCallback, useEffect, useRef, useState } from "react";

import { REREAD_HOME_MS } from "@/lib/watchboard-ledger";

export function useLaneHome() {
  const [justRead, setJustRead] = useState(false);
  const [homeAt, setHomeAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const announceHome = useCallback(() => {
    setHomeAt(new Date().toISOString());
    setJustRead(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustRead(false), REREAD_HOME_MS);
  }, []);

  return { justRead, homeAt, announceHome };
}
