/**
 * Exit Interceptor
 *
 * Prevents process.exit() from killing the REPL session.
 * Uses a custom SessionExitSignal error class that is caught
 * and converted to a return code instead of a real exit.
 *
 * @module cli/session/exit-interceptor
 * @version 1.0.0
 * @date 2026-03-03
 * @status ACTIVE - Sprint 73
 * @authority TS-011 CLI Session Mode
 * @stage 04 - BUILD
 * @sdlc SDLC Framework 6.4.0
 */

/**
 * Custom error thrown when a command calls process.exit() in session mode.
 * Caught by executeWithExitGuard() to prevent the session from dying.
 */
export class SessionExitSignal extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`SessionExitSignal(${code})`);
    this.name = "SessionExitSignal";
    this.code = code;
  }
}

/**
 * Execute a function with process.exit() intercepted.
 *
 * While the function runs, process.exit() is overridden to throw
 * SessionExitSignal instead. The original process.exit is restored
 * in a finally block to ensure safety.
 *
 * @returns The exit code (0 for success, non-zero for error)
 */
export async function executeWithExitGuard(fn: () => Promise<void>): Promise<number> {
  let exitCode = 0;
  const originalExit = process.exit;

  // Intentional override — intercept process.exit() for session safety
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new SessionExitSignal(exitCode);
  }) as never;

  try {
    await fn();
  } catch (err) {
    if (err instanceof SessionExitSignal) {
      exitCode = err.code;
    } else {
      throw err;
    }
  } finally {
    process.exit = originalExit;
  }

  return exitCode;
}
