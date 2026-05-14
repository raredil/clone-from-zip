import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; viewKey: string }
interface State { error: Error | null }

/**
 * Local error boundary for the in-page view switcher.
 * Prevents a single panel crash from bubbling up to the router-level
 * error screen ("Go home"). Shows an inline retry instead, and resets
 * automatically when the user navigates to a different view.
 */
export class ViewBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error("[view error]", error); }
  componentDidUpdate(prev: Props) {
    if (prev.viewKey !== this.props.viewKey && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="board-frame p-6 text-center">
          <div className="flap-text text-amber text-sm tracking-[0.25em] mb-2">PANEL ERROR</div>
          <div className="text-xs text-muted-foreground mb-4 break-words">
            {this.state.error.message || "Something went wrong loading this panel."}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-3 py-1.5 rounded border border-board-divider hover:bg-accent flap-text text-[11px] tracking-[0.25em]"
          >RETRY</button>
        </div>
      );
    }
    return this.props.children;
  }
}
