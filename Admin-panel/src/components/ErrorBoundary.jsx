import { Component } from "react";

// Root error boundary: keeps a blank white screen from swallowing render
// crashes (missing icon imports, bad JSX, etc.). Resets when the user
// navigates (key remount via location change is handled by the parent).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-paper px-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-line p-8 text-center space-y-4">
            <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
            <p className="text-sm text-slate-text">
              An unexpected error occurred while rendering this page. Try
              reloading the application.
            </p>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-ink text-white text-sm font-semibold hover:opacity-90 transition-opacity dark:bg-slate-200 dark:text-ink"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
