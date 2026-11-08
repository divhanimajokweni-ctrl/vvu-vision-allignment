"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Use rAF to avoid setState synchronously in effect body
    const id = requestAnimationFrame(() => {
      // Check if already installed (standalone mode)
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setInstalled(true);
        return;
      }

      function handler(e: Event) {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      }

      function installedHandler() {
        setInstalled(true);
        setDeferredPrompt(null);
      }

      window.addEventListener("beforeinstallprompt", handler);
      window.addEventListener("appinstalled", installedHandler);
      // Cleanup is handled by the outer return
(window as { __vvuPwaCleanup?: () => void }).__vvuPwaCleanup = () => {
        window.removeEventListener("beforeinstallprompt", handler);
        window.removeEventListener("appinstalled", installedHandler);
      };
    });
    return () => {
      cancelAnimationFrame(id);
const cleanup = (window as { __vvuPwaCleanup?: () => void }).__vvuPwaCleanup;
      if (cleanup) cleanup();
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  if (installed) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs border-lime-700/60 bg-lime-950/30 text-lime-300"
        disabled
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Installed</span>
      </Button>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 text-xs border-lime-700/60 bg-lime-950/30 text-lime-300 hover:bg-lime-950 hover:text-lime-200"
      onClick={handleInstall}
    >
      <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Install App</span>
    </Button>
  );
}

/**
 * Service Worker registrar — call once on mount.
 * Registers /sw.js and handles updates.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // Only register in prod

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Check for updates every 60 minutes
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => {
        // Silent fail — SW is a progressive enhancement
        console.warn("[VSW] registration failed:", err.message);
      });
  }, []);
}
