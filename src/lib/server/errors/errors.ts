/**
 * Detects whether an error represents a unique-constraint (duplicate-key) violation.
 *
 * Checks common indicators for MongoDB (error code 11000 or message containing "E11000 duplicate key error")
 * and PostgreSQL (error code '23505' or message containing "duplicate key value", case-insensitive).
 *
 * @param err - The error value to inspect (any object with optional `code` or `message` properties).
 * @returns `true` if the error appears to be a duplicate-key/unique-constraint violation, otherwise `false`.
 */

export function isUniqueViolation(err: unknown): boolean {
  const anyErr = err as { code?: number | string; message?: string };
  if (anyErr?.code === 11000 || anyErr?.code === '23505') return true; // Mongo / Postgres
  if (typeof anyErr?.message === 'string') {
    return (
      anyErr.message.includes('E11000 duplicate key error') || // Mongo message
      anyErr.message.toLowerCase().includes('duplicate key value') // PG message
    );
  }
  return false;
}
