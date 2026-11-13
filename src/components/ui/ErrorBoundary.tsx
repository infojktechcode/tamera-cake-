"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches render errors in its subtree and shows a
 * fallback instead of crashing the whole page.
 *
 * Only class components can be Error Boundaries (they need
 * `componentDidCatch` / `getDerivedStateFromError`).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console in development; in production you'd send to an error
    // tracking service (Sentry, LogRocket, etc.).
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback provided by parent
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16" role="alert">
          <div className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-8 text-center">
            <p aria-hidden className="text-4xl">
              ⚠️
            </p>
            <h2 className="mt-3 font-display text-xl font-semibold text-cocoa">
              Something went wrong
            </h2>
            <p className="mt-2 text-ink-muted">
              We couldn&apos;t load this part of the page. Please try refreshing or
              come back in a moment.
            </p>
            {this.state.error && process.env.NODE_ENV === "development" && (
              <details className="mt-6 text-left text-xs text-ink-muted">
                <summary className="cursor-pointer font-mono">Error details (dev)</summary>
                <pre className="mt-2 overflow-auto rounded bg-cocoa/5 p-3 font-mono text-[10px]">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a client component with an Error Boundary.
 * Usage: `const SafeComponent = withErrorBoundary(Component, fallback);`
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}