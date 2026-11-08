"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Smartphone, Download, Loader2 } from "lucide-react";

interface QrInstallDialogProps {
  /** The URL to encode in the QR code. Defaults to the current page URL. */
  url?: string;
}

export function QrInstallDialog({ url }: QrInstallDialogProps) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get the current URL on mount (client-side only)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const target =
        url ?? (typeof window !== "undefined" ? window.location.href : "http://localhost:3000");
      setOrigin(target);
    });
    return () => cancelAnimationFrame(id);
  }, [url]);

  const generateQr = useCallback(async (target: string) => {
    if (!target) return;
    try {
      setError(null);
      // Generate as data URL for the download button
      const dataUrl = await QRCode.toDataURL(target, {
        width: 320,
        margin: 2,
        color: {
          dark: "#06080c",
          light: "#c8ff00",
        },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);

      // Also render to canvas for crisp display
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, target, {
          width: 320,
          margin: 2,
          color: {
            dark: "#06080c",
            light: "#c8ff00",
          },
          errorCorrectionLevel: "M",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR generation failed");
    }
  }, []);

  useEffect(() => {
    if (!open || !origin) return;
    // Use rAF to avoid setState synchronously in effect body
    const id = requestAnimationFrame(() => generateQr(origin));
    return () => cancelAnimationFrame(id);
  }, [open, origin, generateQr]);

  function downloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = "vvu-dashboard-install-qr.png";
    link.href = qrDataUrl;
    link.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          title="Show QR code for mobile install"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span className="sr-only">QR code for mobile install</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-lime-400" />
            Install on Mobile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            Scan this QR code with your phone camera to open the VVU Dashboard on mobile. Then use
            your browser&apos;s &quot;Add to Home Screen&quot; option to install it as a PWA.
          </p>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-border vvu-surface-deep p-4">
            {error ? (
              <div className="text-[11px] text-red-400">Error: {error}</div>
            ) : !origin ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  className="rounded-md max-w-full"
                  aria-label="QR code for VVU Dashboard URL"
                />
                <div className="text-[10px] font-mono text-muted-foreground text-center break-all">
                  {origin}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">PWA</span> · offline-capable ·{" "}
              {qrDataUrl ? "320×320" : "…"}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={downloadQr}
              disabled={!qrDataUrl}
            >
              <Download className="h-3 w-3" /> Download PNG
            </Button>
          </div>

          <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> The QR uses the Borromean
            brand colors (lime on near-black) for instant VVU recognition.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
