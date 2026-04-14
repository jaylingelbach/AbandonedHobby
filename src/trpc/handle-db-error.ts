import { TRPCError } from '@trpc/server';

/**
 * Normalizes a caught DB/unknown error into a TRPCError.
 * Re-throws TRPCError instances unchanged, logs raw detail in dev, then throws
 * INTERNAL_SERVER_ERROR with the provided user-facing message.
 */
export function handleDbError(
  error: unknown,
  tag: string,
  message: string
): never {
  if (error instanceof TRPCError) throw error;
  const detail = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${tag}]`, detail);
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}
