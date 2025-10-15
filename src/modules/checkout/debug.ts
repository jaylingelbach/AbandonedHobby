const DEBUG_CART = process.env.NEXT_PUBLIC_DEBUG_CART === '1';

/**
 * Log a labeled cart debug message to the console when cart debugging is enabled.
 *
 * When the environment flag for cart debugging is disabled, this function does nothing.
 *
 * @param label - A short label describing the debug message
 * @param payload - Optional value or object to include in the log
 */
export function cartDebug(label: string, payload?: unknown): void {
  if (!DEBUG_CART) return;
  // Use console.groupCollapsed for readability
  console.groupCollapsed(`[cart] ${label}`);
  console.log(payload);
  console.groupEnd();
}