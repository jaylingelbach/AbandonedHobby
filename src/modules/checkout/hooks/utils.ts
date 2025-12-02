import type { CartState } from '../store/types';
import type { TenantCartSummary } from './types';
import { isFiniteNumber } from '@/lib/money';
const quantityCache = new WeakMap<
  Record<string, unknown>,
  Record<string, number>
>();

const EMPTY_PRODUCT_IDS: string[] = [];
const EMPTY_QUANTITIES: Record<string, number> = {};

/**
 * Normalize and sanitize a raw quantities map into a mapping of product IDs to positive integer quantities.
 *
 * @param raw - A raw value (typically an object) mapping product IDs to quantities; any non-object value is treated as empty.
 * @returns A `Record<string, number>` containing only entries whose values are finite integers greater than zero. If no valid entries exist, an empty mapping is returned. The result may be cached and reused for the same input object reference.
 */
export function sanitizeQuantities(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return EMPTY_QUANTITIES;

  const map = raw as Record<string, unknown>;
  const cached = quantityCache.get(map);
  if (cached) return cached;

  const entries = Object.entries(map);
  if (entries.length === 0) {
    quantityCache.set(map, EMPTY_QUANTITIES);
    return EMPTY_QUANTITIES;
  }

  const safe: Record<string, number> = {};
  let hasInvalid = false;
  for (const [key, value] of entries) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !Number.isInteger(value)
    ) {
      hasInvalid = true;
      continue;
    }
    safe[key] = value;
  }

  if (!hasInvalid && Object.keys(safe).length === entries.length) {
    const typed = map as Record<string, number>;
    quantityCache.set(map, typed);
    return typed;
  }

  const normalized = Object.keys(safe).length > 0 ? safe : EMPTY_QUANTITIES;
  quantityCache.set(map, normalized);
  return normalized;
}

/**
 * Builds an array of tenant-scoped cart summaries for the current user.
 *
 * Each summary contains the tenant key, the tenant's product id list, and a
 * sanitized mapping of quantities by product id. Tenants with no product ids
 * are omitted from the result.
 *
 * @param state - The current cart state containing the active user key and per-user tenant buckets
 * @returns An array of TenantCartSummary objects for tenants that have one or more product ids; quantities are sanitized to valid positive integers
 */
export function buildTenantSummaries(state: CartState): TenantCartSummary[] {
  const currentUserKey = state.currentUserKey;
  const byTenant = state.byUser[currentUserKey] ?? {};

  const summaries: TenantCartSummary[] = [];

  for (const [tenantKey, bucket] of Object.entries(byTenant)) {
    const productIds = Array.isArray(bucket.productIds)
      ? bucket.productIds
      : EMPTY_PRODUCT_IDS;

    const quantitiesByProductId = sanitizeQuantities(
      bucket.quantitiesByProductId
    );

    if (productIds.length === 0) continue;

    summaries.push({
      tenantKey,
      productIds,
      quantitiesByProductId
    });
  }

  return summaries;
}

/**
 * Compute the total number of items across all tenant carts for the current user.
 *
 * Counts each product in every tenant cart; when a product's quantity is missing or not a finite number, it is counted as 1.
 *
 * @returns The total item count across all tenants for the current user.
 */
export function selectGlobalCartItemCount(state: CartState): number {
  // get current user
  const currentUserKey = state.currentUserKey;
  // get bucket for that user
  const bucket = state.byUser[currentUserKey] ?? {};

  let total = 0;
  for (const cart of Object.values(bucket)) {
    const productIds = Array.isArray(cart.productIds) ? cart.productIds : [];
    const quantities = cart.quantitiesByProductId ?? {};

    for (const productId of productIds) {
      const q = quantities[productId];
      const isSafe = isFiniteNumber(q);
      // Default to 1 to match useCart.totalItems behavior
      total += isSafe ? q : 1;
    }
  }
  return total;
}