"use client";
import React from "react";

export class EnvErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[VVU env error]", this.props.name, error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div style={{ padding: 16, fontFamily: "var(--vvu-mono)", fontSize: 12 }}>
          <div className="vvu-panel" style={{ borderColor: "var(--vvu-bad)" }}>
            <div className="vvu-ph" style={{ borderColor: "var(--vvu-bad)" }}>
              <h2 style={{ color: "var(--vvu-bad)" }}>{this.props.name} · render error</h2>
            </div>
            <div className="vvu-pb">
              <pre className="vvu-code" style={{ whiteSpace: "pre-wrap", color: "var(--vvu-bad)" }}>
{e.name}: {e.message}

{e.stack?.slice(0, 1200)}
              </pre>
              <button
                className="vvu-btn"
                onClick={() => this.setState({ error: null })}
                style={{ marginTop: 10 }}
              >
                ↺ retry
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
