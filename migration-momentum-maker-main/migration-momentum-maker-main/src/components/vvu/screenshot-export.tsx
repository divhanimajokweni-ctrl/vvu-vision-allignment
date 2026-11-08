"use client";

import { useState, useCallback, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Download, FileImage, Loader2, X } from "lucide-react";

interface ScreenshotExportProps {
  /** Ref to the element to capture. If not provided, captures the whole page. */
  targetRef?: RefObject<HTMLElement>;
  /** Filename prefix */
  filenamePrefix?: string;
}

export function ScreenshotExport({
  targetRef,
  filenamePrefix = "vvu-dashboard",
}: ScreenshotExportProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      // Dynamically import to reduce bundle size
      const { toPng, toJpeg } = await import("html-to-image");
      const target = targetRef?.current ?? document.body;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      // Capture as PNG
      const dataUrl = await toPng(target, {
        quality: 0.92,
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#06080c",
        pixelRatio: 2,
        filter: (node) => {
          // Skip elements that shouldn't be in the screenshot
          if (node instanceof HTMLElement) {
            // Skip the screenshot dialog itself
            if (node.getAttribute("role") === "dialog") return false;
            // Skip elements with data-screenshot-skip
            if (node.dataset.screenshotSkip !== undefined) return false;
          }
          return true;
        },
      });

      setPreviewUrl(dataUrl);
      // Auto-download
      const link = document.createElement("a");
      link.download = `${filenamePrefix}-${stamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "capture failed");
    } finally {
      setCapturing(false);
    }
  }, [targetRef, filenamePrefix]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" data-screenshot-skip>
          <Camera className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Screenshot</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" data-screenshot-skip>
        <DialogHeader>
          <DialogTitle>Dashboard Screenshot Export</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            Capture the current dashboard view as a high-resolution PNG (2x pixel ratio). The
            screenshot is automatically downloaded.
          </p>

          {error && (
            <div className="rounded border border-red-700 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
              Error: {error}
            </div>
          )}

          {previewUrl && (
            <div className="rounded border border-border overflow-hidden max-h-80 overflow-y-auto">
              <img src={previewUrl} alt="Dashboard screenshot preview" className="w-full" />
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPreviewUrl(null);
                setOpen(false);
              }}
              disabled={capturing}
            >
              <X className="h-3.5 w-3.5" /> Close
            </Button>
            <Button size="sm" onClick={capture} disabled={capturing} className="gap-1.5">
              {capturing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileImage className="h-3.5 w-3.5" />
              )}
              {capturing ? "Capturing…" : previewUrl ? "Re-capture" : "Capture PNG"}
            </Button>
          </div>

          {previewUrl && (
            <div className="flex items-center gap-2 rounded border border-lime-700/40 bg-lime-950/20 px-3 py-2 text-[11px] text-lime-300">
              <Download className="h-3.5 w-3.5" />
              Screenshot downloaded. Right-click the preview above to save manually if needed.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
