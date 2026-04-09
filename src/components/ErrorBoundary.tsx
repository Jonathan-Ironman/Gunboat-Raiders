import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors in the component tree and displays an error message
 * instead of a blank white screen.
 *
 * In development mode, caught errors are also pushed to `window.__GAME_ERRORS__`
 * so Playwright tests can detect them via `page.evaluate()`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);

    if (import.meta.env.DEV) {
      // Dynamic import keeps the logger out of the production bundle.
      void import('../utils/errorLogger').then(({ recordBoundaryError }) => {
        recordBoundaryError(error, info.componentStack ?? undefined);
      });
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a1628',
            color: '#ff6b6b',
            fontFamily: 'monospace',
            padding: '2rem',
          }}
        >
          <h1 style={{ marginBottom: '1rem' }}>Something went wrong</h1>
          <pre
            style={{
              maxWidth: '80vw',
              overflow: 'auto',
              padding: '1rem',
              background: '#1a2638',
              borderRadius: '8px',
              color: '#ffa07a',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
