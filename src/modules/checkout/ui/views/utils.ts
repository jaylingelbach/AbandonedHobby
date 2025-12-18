import { TRPCClientError } from '@trpc/client';
import { CheckoutGroup, TrpcErrorShape } from './types';
import { readQuantityOrDefault } from '@/lib/validation/quantity';
import { usdNumberToCents } from '@/lib/money';

/**
 * Extracts valid missing product IDs from a TRPCClientError error payload.
 *
 * @param error - The value to inspect; typically an error thrown by a tRPC call.
 * @returns An array of non-empty `string` product IDs found under `missingProductIds` in the error payload, or an empty array if none are present or the input is not a `TRPCClientError`.
 */
export function getMissingProductIdsFromError(error: unknown): string[] {
  if (!(error instanceof TRPCClientError)) return [];

  const data = error.data as unknown;
  if (!data || typeof data !== 'object') return [];

  const missingProductIds = (data as { missingProductIds?: unknown })
    .missingProductIds;

  if (Array.isArray(missingProductIds)) {
    return missingProductIds.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    );
  }

  return [];
}

/**
 * Determines whether a value matches the expected TRPC error object shape.
 *
 * @param value - The value to test for the TRPC error shape
 * @returns `true` if `value` is an object and either has no `data` property or its `data` is `undefined`, `null`, or an object; `false` otherwise.
 */
export function isTrpcErrorShape(value: unknown): value is TrpcErrorShape {
  if (typeof value !== 'object' || value === null) return false;
  if (!('data' in value)) return true; // allow absence of data
  const data = (value as { data?: unknown }).data;
  return data === undefined || data === null || typeof data === 'object';
}

export function computeGroupTotals(group: CheckoutGroup) {
  let totalQuantity = 0;
  let totalCents = 0;

  for (const product of group.products) {
    const rawQuantity = group.quantitiesByProductId[String(product.id)];
    const quantity = readQuantityOrDefault(rawQuantity, 0);

    if (quantity <= 0) continue;

    totalQuantity += quantity;
    totalCents += quantity * usdNumberToCents(product.price ?? 0);
  }

  return { totalQuantity, totalCents };
}
