"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Move, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type ZoomLevel = 1 | 1.5 | 2 | 3 | 4;
type PanOffset = { x: number; y: number };

interface CssChartZoomProps {
  className?: string;
}

/**
 * CSS-based chart zoom — uses transform: scale() on the chart container.
 * This is a SAFE alternative to the React useChartZoom hook (which crashed recharts).
 * CSS transforms don't modify the data array, so recharts renders normally.
 */
export function CssChartZoom({ className }: CssChartZoomProps) {
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const levels: ZoomLevel[] = [1, 1.5, 2, 3, 4];
      const idx = levels.indexOf(z);
      return levels[Math.min(idx + 1, levels.length - 1)];
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const levels: ZoomLevel[] = [1, 1.5, 2, 3, 4];
      const idx = levels.indexOf(z);
      return levels[Math.max(idx - 1, 0)];
    });
    setPan({ x: 0, y: 0 });
  }, []);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const panLeft = useCallback(() => setPan((p) => ({ ...p, x: p.x + 50 })), []);
  const panRight = useCallback(() => setPan((p) => ({ ...p, x: p.x - 50 })), []);

  const isZoomed = zoom > 1 || pan.x !== 0;

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={panLeft}
        disabled={!isZoomed}
        title="Pan left"
      >
        <Move className="h-3 w-3 -scale-x-100" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={zoomIn}
        disabled={zoom >= 4}
        title="Zoom in"
      >
        <ZoomIn className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={zoomOut}
        disabled={zoom <= 1}
        title="Zoom out"
      >
        <ZoomOut className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={panRight}
        disabled={!isZoomed}
        title="Pan right"
      >
        <Move className="h-3 w-3" />
      </Button>
      {isZoomed && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 text-[9px] text-lime-400"
          onClick={reset}
          title="Reset zoom"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
      {zoom > 1 && <span className="font-mono text-[9px] text-muted-foreground ml-1">{zoom}×</span>}
    </div>
  );
}

/**
 * Hook that provides the CSS transform style for chart containers.
 * Use with the CssChartZoom component for a unified zoom experience.
 * Returns a style object + the zoom level.
 */
export function useCssChartZoom() {
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const levels: ZoomLevel[] = [1, 1.5, 2, 3, 4];
      const idx = levels.indexOf(z);
      return levels[Math.min(idx + 1, levels.length - 1)];
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const levels: ZoomLevel[] = [1, 1.5, 2, 3, 4];
      const idx = levels.indexOf(z);
      return levels[Math.max(idx - 1, 0)];
    });
    setPan({ x: 0, y: 0 });
  }, []);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const panLeft = useCallback(() => setPan((p) => ({ ...p, x: p.x + 50 })), []);
  const panRight = useCallback(() => setPan((p) => ({ ...p, x: p.x - 50 })), []);

  const transform = `scale(${zoom}) translateX(${pan.x}px)`;
  const transformOrigin = "center center";
  const isZoomed = zoom > 1 || pan.x !== 0;

  return {
    zoom,
    pan,
    isZoomed,
    transform,
    transformOrigin,
    zoomIn,
    zoomOut,
    reset,
    panLeft,
    panRight,
    controls: <CssChartZoom className="" />,
  };
}
