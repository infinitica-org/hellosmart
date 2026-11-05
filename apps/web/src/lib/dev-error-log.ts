/**
 * Server/client helper: log full stack traces in development; message-only in production.
 */
export function logDevError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const prefix = `[HelloSmart:${context}]`;
  if (extra && Object.keys(extra).length > 0) {
    console.error(prefix, extra);
  }
  if (error instanceof Error) {
    console.error(prefix, error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error(error.stack);
    }
    return;
  }
  console.error(prefix, error);
}
