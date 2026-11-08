"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RefreshCw, Maximize2, Move } from "lucide-react";

export interface ZoomState {
  startX: number; // index of the first visible data point
  endX: number; // index of the last visible data point
}

interface ChartZoomControlsProps {
  totalPoints: number;
  zoom: ZoomState;
  onZoomChange: (z: ZoomState) => void;
  minWindow?: number; // minimum number of points to show
}

/**
 * Chart zoom/pan controls — lets the user zoom into a sub-range of the data.
 * Used with recharts charts via the `data={data.slice(zoom.startX, zoom.endX)}` pattern.
 */
export function ChartZoomControls({
  totalPoints,
  zoom,
  onZoomChange,
  minWindow = 5,
}: ChartZoomControlsProps) {
  const [isPanning, setIsPanning] = useState(false);

  const windowSize = zoom.endX - zoom.startX;
  const canZoomIn = windowSize > minWindow;
  const canZoomOut = zoom.startX > 0 || zoom.endX < totalPoints;
  const canPanLeft = zoom.startX > 0;
  const canPanRight = zoom.endX < totalPoints;
  const isZoomed = zoom.startX > 0 || zoom.endX < totalPoints;

  const zoomIn = useCallback(() => {
    if (!canZoomIn) return;
    const margin = Math.max(1, Math.floor(windowSize * 0.15));
    onZoomChange({
      startX: zoom.startX + margin,
      endX: zoom.endX - margin,
    });
  }, [canZoomIn, zoom, windowSize, onZoomChange]);

  const zoomOut = useCallback(() => {
    if (!canZoomOut) return;
    const margin = Math.max(1, Math.floor(windowSize * 0.2));
    onZoomChange({
      startX: Math.max(0, zoom.startX - margin),
      endX: Math.min(totalPoints, zoom.endX + margin),
    });
  }, [canZoomOut, zoom, windowSize, totalPoints, onZoomChange]);

  const panLeft = useCallback(() => {
    if (!canPanLeft) return;
    const step = Math.max(1, Math.floor(windowSize * 0.25));
    onZoomChange({
      startX: Math.max(0, zoom.startX - step),
      endX: Math.max(zoom.endX - Math.min(step, zoom.startX), zoom.startX + minWindow),
    });
  }, [canPanLeft, zoom, windowSize, minWindow, onZoomChange]);

  const panRight = useCallback(() => {
    if (!canPanRight) return;
    const step = Math.max(1, Math.floor(windowSize * 0.25));
    const newEnd = Math.min(totalPoints, zoom.endX + step);
    const overflow = newEnd - zoom.endX;
    onZoomChange({
      startX: Math.min(zoom.startX + overflow, totalPoints - minWindow),
      endX: newEnd,
    });
  }, [canPanRight, zoom, windowSize, totalPoints, minWindow, onZoomChange]);

  const reset = useCallback(() => {
    onZoomChange({ startX: 0, endX: totalPoints });
    setIsPanning(false);
  }, [totalPoints, onZoomChange]);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={panLeft}
        disabled={!canPanLeft}
        title="Pan left"
      >
        <Move className="h-3 w-3 -scale-x-100" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={zoomIn}
        disabled={!canZoomIn}
        title="Zoom in"
      >
        <ZoomIn className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={zoomOut}
        disabled={!canZoomOut}
        title="Zoom out"
      >
        <ZoomOut className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={panRight}
        disabled={!canPanRight}
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
          <RefreshCw className="h-3 w-3" /> Reset
        </Button>
      )}
      {isZoomed && (
        <span className="font-mono text-[9px] text-muted-foreground ml-1">
          {zoom.startX}–{zoom.endX}/{totalPoints}
        </span>
      )}
    </div>
  );
}

/**
 * Hook that manages the zoom state for a chart with N total data points.
 * Returns the zoom state, the ChartZoomControls component, and the sliced data.
 *
 * SIMPLIFIED VERSION: No auto-follow effect (which caused client-side crash).
 * The zoom window stays fixed until the user explicitly changes it.
 * If data grows beyond the zoom window, the user can click "Reset" to see all.
 */
export function useChartZoom<T>(data: T[]) {
  const total = data.length;
  const [zoom, setZoom] = useState<ZoomState>({ startX: 0, endX: 0 });

  // Sync zoom endX to total when total increases AND we're at the end
  // (simple clamping — no rAF, no auto-follow complexity)
  const safeStart = Math.max(0, Math.min(zoom.startX, Math.max(0, total)));
  const safeEnd = total === 0 ? 0 : Math.max(safeStart + 1, Math.min(zoom.endX || total, total));

  // If zoom hasn't been set yet (endX === 0) or endX exceeds total, reset to full range
  const effectiveZoom: ZoomState =
    safeEnd === 0 && total > 0 ? { startX: 0, endX: total } : { startX: safeStart, endX: safeEnd };

  const slicedData = data.slice(effectiveZoom.startX, effectiveZoom.endX);

  return {
    zoom: effectiveZoom,
    setZoom,
    slicedData,
    controls: <ChartZoomControls totalPoints={total} zoom={effectiveZoom} onZoomChange={setZoom} />,
  };
}
