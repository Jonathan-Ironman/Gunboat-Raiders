/**
 * Development-only error logging system.
 *
 * Captures uncaught exceptions, unhandled promise rejections, and console
 * errors. All errors are accumulated in `window.__GAME_ERRORS__` so Playwright
 * tests can read them via `page.evaluate()`.
 *
 * This module must ONLY be imported / called in development mode. It is a
 * no-op in production — the `import.meta.env.DEV` guards ensure that tree-
 * shaking removes every trace of it from the production bundle.
 */

export interface GameError {
  timestamp: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  type: 'uncaught' | 'unhandled-rejection' | 'console-error' | 'error-boundary';
}

/** Push a recorded error into the window-level accumulator. */
function pushError(entry: GameError): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;

  const store = (window as Window & { __GAME_ERRORS__?: GameError[] }).__GAME_ERRORS__;
  if (store) {
    store.push(entry);
  }
}

/**
 * Install all error listeners. Call once from `main.tsx` in dev mode.
 * Safe to call multiple times — installs are idempotent.
 */
let installed = false;

export function installErrorLogger(): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;
  if (installed) return;
  installed = true;

  // ---- 1. Uncaught exceptions ------------------------------------------------
  window.onerror = (
    message: string | Event,
    source?: string,
    line?: number,
    column?: number,
    error?: Error,
  ): boolean => {
    const errorEntry: GameError = {
      timestamp: new Date().toISOString(),
      type: 'uncaught',
      message:
        typeof message === 'string'
          ? message
          : message instanceof Event
            ? 'Window error event'
            : 'Unknown error',
    };
    if (error?.stack !== undefined) errorEntry.stack = error.stack;
    if (source !== undefined) errorEntry.source = source;
    if (line !== undefined) errorEntry.line = line;
    if (column !== undefined) errorEntry.column = column;
    pushError(errorEntry);
    // Return false so the browser still logs the error to its console.
    return false;
  };

  // ---- 2. Unhandled promise rejections ----------------------------------------
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    let message = 'Unhandled promise rejection';
    let stack: string | undefined;

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else if (reason !== null && reason !== undefined) {
      // Safely stringify unknown rejection reasons without triggering base-to-string
      try {
        message = JSON.stringify(reason);
      } catch {
        message = 'Non-serializable rejection reason';
      }
    }

    const rejectionEntry: GameError = {
      timestamp: new Date().toISOString(),
      type: 'unhandled-rejection',
      message,
    };
    if (stack !== undefined) rejectionEntry.stack = stack;
    pushError(rejectionEntry);
  });

  // ---- 3. console.error interception ------------------------------------------
  const originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]): void => {
    // Always call the original so DevTools still shows the error.
    originalConsoleError(...args);

    // Stringify all arguments into a single message.
    const parts = args.map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a);
        } catch {
          return '[non-serializable object]';
        }
      }
      // For primitives (number, boolean, bigint, symbol), convert safely
      if (typeof a === 'symbol') return a.toString();
      return String(a as string | number | boolean | null | undefined | bigint);
    });

    pushError({
      timestamp: new Date().toISOString(),
      type: 'console-error',
      message: parts.join(' '),
    });
  };
}

/**
 * Record an error caught by a React Error Boundary.
 * This is the only function called from outside this module (by ErrorBoundary).
 */
export function recordBoundaryError(error: Error, componentStack?: string): void {
  if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;

  const boundaryEntry: GameError = {
    timestamp: new Date().toISOString(),
    type: 'error-boundary',
    message: error.message,
  };
  if (componentStack) {
    boundaryEntry.stack = `${error.stack ?? ''}\n\nComponent stack:${componentStack}`;
  } else if (error.stack !== undefined) {
    boundaryEntry.stack = error.stack;
  }
  pushError(boundaryEntry);
}
