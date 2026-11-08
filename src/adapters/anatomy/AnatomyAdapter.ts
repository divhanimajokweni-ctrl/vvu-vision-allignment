/**
 * Anatomy Adapter — bridges application state and the Anatomy renderer.
 *
 * CRITICAL ARCHITECTURAL RULE: The adapter is a GATE, not a pass-through.
 * It rejects invalid state BEFORE it reaches the renderer. Specifically:
 *   - PROVEN/RELEASED without provenanceRef → REJECTED (no display)
 *   - PROVEN/RELEASED without INDEPENDENT source → REJECTED
 *   - Unknown status → REJECTED (never silently coerced)
 *   - The renderer NEVER receives invalid state
 *
 * @license Apache-2.0
 */

import {
  createVisualState,
  updateVerificationState,
  validateVisualState,
  VERIFICATION_STATUS,
  RENDER_MODE,
  type VisualState,
  type RenderMode,
} from "../../lib/anatomy/visual-state";

export interface RendererInterface {
  init(state: VisualState): Promise<void> | void;
  render(state: VisualState): void;
  setMode(mode: RenderMode): void;
  destroy(): void;
}

export interface AdapterOptions {
  id: string;
  type: string;
  renderer: RendererInterface | null;
  onInteraction?: (componentId: string, interactionData: unknown) => void;
}

export class AnatomyAdapter {
  readonly id: string;
  readonly type: string;
  private renderer: RendererInterface | null;
  private onInteraction: (componentId: string, interactionData: unknown) => void;
  private currentState: VisualState;
  private isInitialized: boolean = false;

  constructor(options: AdapterOptions) {
    this.id = options.id;
    this.type = options.type;
    this.renderer = options.renderer;
    this.onInteraction = options.onInteraction ?? (() => {});
    this.currentState = createVisualState(this.id, this.type);
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    const validation = validateVisualState(this.currentState);
    if (!validation.isValid) {
      throw new Error(`Invalid initial state: ${validation.errors.join(", ")}`);
    }

    if (this.renderer) {
      await this.renderer.init(this.currentState);
    }
    this.isInitialized = true;
  }

  /**
   * Updates the visual state. This is the GATE — invalid state is rejected
   * and NEVER reaches the renderer.
   */
  update(appState: Partial<VisualState> & { verification?: Partial<VisualState["verification"]> }): void {
    if (!this.isInitialized) {
      throw new Error("Adapter not initialized. Call init() first.");
    }

    const visualState = this.transformAppState(appState);
    const validation = validateVisualState(visualState);

    if (!validation.isValid) {
      // ABORT — do NOT render invalid state. Log + throw.
      const msg = `Visual state validation failed: ${validation.errors.join(", ")}`;
      console.warn(`[AnatomyAdapter:${this.id}] ${msg}`);
      throw new Error(msg);
    }

    this.currentState = visualState;

    if (this.renderer) {
      this.renderer.render(visualState);
    }
  }

  private transformAppState(
    appState: Partial<VisualState> & { verification?: Partial<VisualState["verification"]> },
  ): VisualState {
    const visualState: VisualState = {
      ...this.currentState,
      system: appState.system
        ? { ...this.currentState.system, ...appState.system }
        : this.currentState.system,
      verification: appState.verification
        ? { ...this.currentState.verification, ...appState.verification }
        : this.currentState.verification,
      sources: appState.sources ?? this.currentState.sources,
      events: appState.events ?? this.currentState.events,
      mode: appState.mode ?? this.currentState.mode,
      metadata: {
        ...this.currentState.metadata,
        timestamp: new Date().toISOString(),
      },
    };

    return visualState;
  }

  handleInteraction(componentId: string, interactionData: unknown): void {
    // Interactions emit intent events — they NEVER change verification status.
    this.onInteraction(componentId, interactionData);
  }

  setMode(mode: RenderMode): void {
    if (!Object.values(RENDER_MODE).includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.currentState.mode = mode;
    if (this.renderer) {
      this.renderer.setMode(mode);
    }
  }

  getState(): VisualState {
    return this.currentState;
  }

  destroy(): void {
    if (this.renderer) {
      this.renderer.destroy();
    }
    this.isInitialized = false;
  }
}

export default AnatomyAdapter;
