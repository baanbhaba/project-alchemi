import React from "react";
import { AlertTriangle, RefreshCcw, LayoutDashboard } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // In production, errors are captured by Vercel Analytics automatically.
    // You can also pipe to Sentry here: Sentry.captureException(error, { extra: errorInfo });
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isDev = import.meta.env?.DEV;

      return (
        <div className="min-h-screen bg-[#fdf8f0] dark:bg-zinc-950 text-[#181c24] dark:text-zinc-100 font-mono flex flex-col items-center justify-center p-6 transition-colors">
          <div className="max-w-lg w-full space-y-6">
            {/* Icon + heading */}
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto shadow-[2px_2px_0px_#181c24] dark:shadow-none">
                <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#181c24] dark:text-zinc-100">Something went wrong</h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 font-sans font-medium">
                  An unexpected error occurred. Your data is safe — this is a display issue only.
                </p>
              </div>
            </div>

            {/* Error detail (dev only) */}
            {isDev && this.state.error && (
              <div className="bg-[#fff8f6] dark:bg-zinc-900 border-2 border-[#181c24] dark:border-red-500/30 rounded-xl p-4 space-y-2 text-xs shadow-[3px_3px_0px_#181c24] dark:shadow-none">
                <div className="flex items-center space-x-2 text-rose-600 dark:text-red-400 font-bold">
                  <span>Error</span>
                </div>
                <code className="block text-rose-700 dark:text-red-300 break-all whitespace-pre-wrap font-mono">
                  {this.state.error.message}
                </code>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-zinc-500 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                      Component stack
                    </summary>
                    <code className="block text-zinc-600 dark:text-zinc-500 text-[10px] mt-2 whitespace-pre-wrap break-all font-mono">
                      {this.state.errorInfo.componentStack}
                    </code>
                  </details>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                id="error-boundary-retry"
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-2 border-[#181c24] dark:border-zinc-700 text-[#181c24] dark:text-zinc-200 text-sm font-bold rounded-xl shadow-[2px_2px_0px_#181c24] dark:shadow-none transition-all cursor-pointer"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                id="error-boundary-home"
                onClick={() => {
                  this.handleReset();
                  window.location.hash = "/";
                }}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-black border-2 border-[#181c24] shadow-[2px_2px_0px_#181c24] rounded-xl transition-all cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
            </div>

            <p className="text-center text-xs text-zinc-500 font-sans">
              ALCHEMI &mdash; If this keeps happening, try clearing your browser cache or signing out.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
