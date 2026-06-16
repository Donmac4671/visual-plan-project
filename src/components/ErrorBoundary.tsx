import React from "react";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to console for debugging
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive mb-1">
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ""}.
          </p>
          <p className="text-destructive/90 font-mono whitespace-pre-wrap break-words">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-xs underline text-destructive"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
