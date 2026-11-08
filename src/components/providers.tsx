'use client';

// src/components/providers.tsx — QueryClient + socket bootstrap + toasts
// + PWA registration (R54: canonical ServiceWorkerRegistrar under
// src/components/pwa/ — network-first for the app shell so dev HMR is
// never stale; see public/sw.js header for the full strategy notes).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';
import { useVvuSocketBootstrap } from '@/hooks/use-vvu-socket';

function SocketBootstrap() {
  useVvuSocketBootstrap();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    // Task 16-a — DAYSHIFT light ops mode. next-themes drives a single
    // `data-theme` attribute on <html> ("dark" default, persisted to
    // localStorage, enableSystem off so the SCADA dark look is deterministic).
    // The visual flip lives in globals.css on html[data-theme="light"]
    // (root-level invert + hue-rotate — re-themes DOM AND WebGL/canvas);
    // components never branch on the theme at render time, so dark output
    // stays pixel-identical and there are no hydration mismatches.
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SocketBootstrap />
        <ServiceWorkerRegistrar />
        {children}
        {/* Toast queue hardening: sonner 2.x defaults are visibleToasts=3 and
            duration=4000 (VISIBLE_TOASTS_AMOUNT / TOAST_LIFETIME in dist) — both
            restated explicitly here so the flood behaviour is pinned, not
            inherited. visibleToasts (sonner 2.x has no `limit` prop) caps the
            visible stack at 3; duration 3500ms drains the queue ~0.5s faster
            under palette stress (18 rapid commands). Repetitive feedback
            (fsm-emit / fsm-rejected / route-noop) is deduped with stable toast
            ids at the call sites, so rapid repeats REPLACE instead of stack. */}
        <Toaster position="top-center" offset={72} richColors closeButton visibleToasts={3} duration={3500} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
