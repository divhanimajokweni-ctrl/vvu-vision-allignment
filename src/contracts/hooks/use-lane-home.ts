'use client';
import { useCallback, useState } from 'react';

/** Tracks which lane (surface) is the user's "home" and announces completed reads. */
export function useLaneHome(defaultLane: string = 'icsh') {
  const [home, setHome] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultLane;
    return localStorage.getItem('vvu.lane-home') ?? defaultLane;
  });
  const [justRead, setJustRead] = useState(false);
  const [homeAt, setHomeAt] = useState<number | null>(null);

  const announceHome = useCallback(() => {
    setHomeAt(Date.now());
    setJustRead(true);
    window.setTimeout(() => setJustRead(false), 2600);
  }, []);

  const update = useCallback((lane: string) => {
    setHome(lane);
    if (typeof window !== 'undefined') localStorage.setItem('vvu.lane-home', lane);
  }, []);

  return { home, update, justRead, homeAt, announceHome };
}
