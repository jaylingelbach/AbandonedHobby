const DEBUG_CART = process.env.NEXT_PUBLIC_DEBUG_CART === '1';

export function cartDebug(label: string, payload?: unknown): void {
  if (!DEBUG_CART) return;
  // Use console.group for readability
  console.groupCollapsed(`[cart] ${label}`);
  console.log(payload);
  console.groupEnd();
}
