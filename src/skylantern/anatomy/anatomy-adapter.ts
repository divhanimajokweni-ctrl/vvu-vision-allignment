"use client";

/**
 * Anatomy × VVU — The Anatomy Adapter
 *
 * THE CRITICAL BOUNDARY between Skylantern's verification engine and the
 * Anatomy renderer.
 *
 *   Skylantern owns:   verification logic, evidence, the WORM chain
 *   Anatomy owns:       visual representation, geometry, animation
 *   This adapter owns:  the translation between them
 *
 * THE CARDINAL RULE:
 *   The adapter must NEVER return a "success" or "verified" status based on
 *   the animation reaching a certain frame. It only reflects the `state`
 *   object passed to it. If `state.verification.passed` is false, the visual
 *   interlock must remain visibly disengaged, regardless of user interaction.
 *
 *   The visual state is a REPRESENTATION of the authoritative state, not an
 *   alternative decision-making engine.
 */

import {
  RENDER_MODE,
  validateVisualState,
  type VisualState,
  type RenderMode,
} from "./visual-state";

export interface AnatomyAdapterOptions {
  /** Unique identifier for this adapter instance. */
  id: string;
  /** Type of visualisation (e.g. "evidence-instrument"). */
  type: string;
  /** Callback for user interactions from the renderer. */
  onInteraction?: (componentId: string, interactionData: unknown) => void;
  /** Callback fired when state is updated (for re-rendering). */
  onStateChange?: (state: VisualState) => void;
  /** Callback fired when validation fails. */
  onError?: (error: Error) => void;
}

export class AnatomyAdapter {
  readonly id: string;
  readonly type: string;
  private currentState: VisualState;
  private isInitialized = false;
  private onInteraction: (componentId: string, interactionData: unknown) => void;
  private onStateChange: (state: VisualState) => void;
  private onError: (error: Error) => void;

  constructor(options: AnatomyAdapterOptions) {
    this.id = options.id;
    this.type = options.type;
    this.onInteraction = options.onInteraction ?? (() => {});
    this.onStateChange = options.onStateChange ?? (() => {});
    this.onError = options.onError ?? (() => {});

    // Initialise with a READY state.
    this.currentState = {
      id: this.id,
      type: this.type,
      mode: RENDER_MODE.LIVE,
      system: { status: "IDLE", health: "OK" },
      verification: {
        status: "READY",
        confidence: 0,
        blockedReason: null,
        evidenceSummary: "Awaiting inputs…",
        tierTag: 1,
      },
      sources: [],
      events: [],
      metadata: {
        timestamp: new Date().toISOString(),
        version: "anatomy-vvu/v1",
      },
    };
  }

  /**
   * Initialise the adapter. Validates the initial state.
   */
  init(): void {
    const validation = validateVisualState(this.currentState);
    if (!validation.isValid) {
      this.onError(
        new Error(`Invalid initial state: ${validation.errors.join(", ")}`)
      );
    }
    this.isInitialized = true;
    this.onStateChange(this.currentState);
  }

  /**
   * Update the visual state based on authoritative application state.
   *
   * This is the ONLY method that changes the visual state. The renderer
   * cannot call this — only the application can. User interactions from the
   * renderer go through `handleInteraction`, which does NOT change the
   * verification state.
   *
   * Auto-initialises if called before `init()` — safe to call during render.
   */
  update(state: VisualState): void {
    if (!this.isInitialized) {
      this.isInitialized = true;
    }

    const validation = validateVisualState(state);
    if (!validation.isValid) {
      // Log but continue — the operator should see something, even if invalid.
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[anatomy-adapter] Visual state validation failed:",
          validation.errors
        );
      }
    }

    this.currentState = state;
    this.onStateChange(state);
  }

  /**
   * Handle a user interaction from the renderer.
   *
   * CRITICAL: This does NOT change the verification state. It only fires the
   * onInteraction callback so the application can respond (e.g. open the
   * evidence drawer, select a sensor, display a component).
   */
  handleInteraction(componentId: string, interactionData?: unknown): void {
    this.onInteraction(componentId, interactionData);
  }

  /**
   * Set the rendering mode (LIVE / SIMULATION / REPLAY).
   */
  setMode(mode: RenderMode): void {
    if (!Object.values(RENDER_MODE).includes(mode)) {
      this.onError(new Error(`Invalid mode: ${mode}`));
      return;
    }
    this.currentState = { ...this.currentState, mode };
    this.onStateChange(this.currentState);
  }

  /**
   * Get the current visual state (read-only snapshot).
   */
  getState(): Readonly<VisualState> {
    return this.currentState;
  }

  /**
   * Check if the adapter is initialised.
   */
  get ready(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.isInitialized = false;
  }
}
