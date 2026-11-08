"use client";

// src/components/pwa/InstallButton.tsx — R54: the install path. The page IS
// the app; this button is how it becomes one on the operator's device.
//
//   · Chromium (Chrome/Edge/Samsung/Opera, HTTPS or localhost): calls the
//     deferred beforeinstallprompt — the browser's own install UI.
//   · iOS Safari (no beforeinstallprompt — Apple's design, not a bug we
//     can fix): opens the Share → Add to Home Screen instruction sheet.
//   · Everywhere else: the same instruction sheet, per-platform steps.
//   · HTTP-over-LAN (no secure context): the prompt never fires — the
//     sheet states that plainly instead of failing silently.
//   · Once running standalone (display-mode: standalone /
//     window-controls-overlay / iOS navigator.standalone), the button
//     collapses to an INSTALLED chip.
//
// Install acceptance is WORM-audited (PWA_INSTALL / PWA_INSTALLED ·
// OPERATOR) like every other operator action in the header.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSendWormLog } from "@/hooks/use-vvu-socket";
import "./install-button.css";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "chromium" | "ios" | "other" | "installed";

function detect(): Platform {
  if (typeof window === "undefined") return "other";
  if (window.matchMedia("(display-mode: standalone)").matches) return "installed";
  if (window.matchMedia("(display-mode: window-controls-overlay)").matches) return "installed";
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return "installed";
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return "installed";

  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && touch);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  if (isIOS && isSafari) return "ios";

  if (/Chrome|Edg|SamsungBrowser|Opera/.test(ua) && !/OPR\/(?:[0-6]\.)/.test(ua)) return "chromium";
  return "other";
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [sheetOpen, setSheetOpen] = useState(false);
  // The instruction sheet renders through a PORTAL to document.body: the
  // button lives inside VvuHeader, whose backdrop-blur (backdrop-filter)
  // makes the header a containing block for fixed-position descendants —
  // an in-place position:fixed sheet would anchor to the 56px header box
  // instead of the viewport (observed: sheet rect y=-182 at 390px). The
  // portal escapes every ancestor transform/filter/stacking context.
  const [portalReady, setPortalReady] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const installRef = useRef<HTMLButtonElement | null>(null);
  const sendWormLog = useSendWormLog();

  useEffect(() => {
    // portal-ready arm — named fn (estate idiom; cf. the platform probe)
    const arm = () => setPortalReady(true);
    arm();
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    // Initial platform probe — routed through a named fn (the estate
    // idiom, cf. VvuHeader's tick()): the effect body only wires external
    // subscriptions; the setState lives in the probe/teardown callbacks.
    const probe = () => setPlatform(detect());
    probe();

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setPlatform("installed");
      setDeferred(null);
      setSheetOpen(false);
      sendWormLog(
        "PWA_INSTALLED",
        "OPERATOR",
        "appinstalled fired — the estate now runs standalone on this device",
      );
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Esc closes the sheet; focus lands on the close button when it opens
  // and returns to the install button when it closes.
  useEffect(() => {
    if (!sheetOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      installRef.current?.focus();
    };
  }, [sheetOpen]);

  const onClick = useCallback(async () => {
    if (deferred) {
      // Chromium native-prompt path. The BIP event is one-shot: consume it
      // up front, then call prompt(). RACE: in real browsers the native
      // dialog appears with prompt() itself; contexts that cannot show it
      // (headless/kiosk/embedded webviews) hang the await — a 2s race
      // detects that and falls through to the manual instruction sheet
      // instead of leaving a dead button. userChoice is audited
      // non-blocking (it resolves only when the user answers the dialog).
      const ev = deferred;
      setDeferred(null);
      const prompted = await Promise.race([
        ev
          .prompt()
          .then(() => true)
          .catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
      ]);
      if (prompted) {
        ev.userChoice
          .then(({ outcome }) => {
            if (outcome === "accepted") {
              setPlatform("installed");
              sendWormLog(
                "PWA_INSTALL",
                "OPERATOR",
                "install prompt accepted — standalone window + own icon",
              );
            }
          })
          .catch(() => {});
      } else {
        setSheetOpen(true);
      }
      return;
    }
    setSheetOpen(true);
  }, [deferred, sendWormLog]);

  if (platform === "installed") {
    return (
      <span className="pwa-chip" aria-live="polite" title="This window is the installed app">
        INSTALLED
      </span>
    );
  }

  return (
    <>
      <button
        ref={installRef}
        type="button"
        className="pwa-install"
        onClick={onClick}
        aria-label="Install this app on your device"
        aria-haspopup="dialog"
        title="Install the VVU estate on this device — own icon, own window, offline shell"
      >
        <span className="pwa-install-glyph" aria-hidden>
          ⤓
        </span>
        <span className="pwa-install-label">INSTALL</span>
      </button>

      {sheetOpen &&
        portalReady &&
        createPortal(
          <div
            className="pwa-sheet-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Install instructions"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSheetOpen(false);
            }}
          >
            <div className="pwa-sheet">
              <header className="pwa-sheet-head">
                <h2>INSTALL PROOFBRIDGE VVU</h2>
                <button
                  ref={closeRef}
                  type="button"
                  className="pwa-sheet-close"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>

              {platform === "ios" && (
                <ol className="pwa-steps">
                  <li>
                    Tap the <b>Share</b> icon in Safari&apos;s toolbar.
                  </li>
                  <li>
                    Scroll and tap <b>Add to Home Screen</b>.
                  </li>
                  <li>
                    Name it <b>VVU</b> and tap <b>Add</b>.
                  </li>
                </ol>
              )}

              {platform === "chromium" && (
                <ol className="pwa-steps">
                  <li>
                    Open the browser menu (<b>⋮</b>).
                  </li>
                  <li>
                    Tap <b>Install app</b> or <b>Add to Home screen</b>.
                  </li>
                  <li>Confirm.</li>
                </ol>
              )}

              {platform === "other" && (
                <>
                  <ol className="pwa-steps">
                    <li>
                      <b>Android · Chrome:</b> menu ⋮ → <b>Install app</b>.
                    </li>
                    <li>
                      <b>iOS · Safari:</b> Share → <b>Add to Home Screen</b>.
                    </li>
                    <li>
                      <b>Desktop · Chrome/Edge:</b> install icon in the address bar.
                    </li>
                    <li>
                      <b>Firefox:</b> no install prompt; the page still runs.
                    </li>
                  </ol>
                  <p className="pwa-sheet-note">
                    The install prompt requires the page be served over <b>HTTPS</b> or
                    <b> localhost</b>. On plain HTTP it will not fire — the manual steps above still
                    work where the browser allows them.
                  </p>
                </>
              )}

              <footer className="pwa-sheet-foot">
                <span>Once installed, VVU opens in its own window, with its own icon.</span>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default InstallButton;
