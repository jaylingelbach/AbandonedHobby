import { z } from 'zod';

/**
 * Canonical schema for quantities of physical items.
 *
 * Semantics:
 * - Must be a finite integer
 * - Must be at least 1
 *
 * If you ever need "0 allowed" (e.g. "quantity to refund"), create a separate schema
 * like quantityToRefundSchema instead of weakening this one.
 */

export const quantitySchema = z
  .number({
    required_error: 'Quantity is required',
    invalid_type_error: 'Quantity must be a number'
  })
  .int('Quantity must be a whole number')
  .finite('Quantity must be a finite number')
  .min(1, 'Quantity must be at least 1');

export type Quantity = z.infer<typeof quantitySchema>;

/**
 * Strict parser for quantities.
 *
 * Use when invalid input should throw (e.g. validating API input).
 */
export function parseQuantity(value: unknown): Quantity {
  return quantitySchema.parse(value);
}

/**
 * Safe reader for historical / loosely-typed data.
 *
 * Use when reading from the database or third-party payloads where older
 * records may have:
 *   - undefined
 *   - null
 *   - 0
 *   - non-integer values
 *
 * Any invalid value falls back to the provided default (1 by default).
 */
export function readQuantityOrDefault(
  value: unknown,
  defaultValue: Quantity = 1
): Quantity {
  // First try the primary value
  const parsed = quantitySchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  // Then validate the caller-provided default at runtime too
  const parsedDefault = quantitySchema.safeParse(defaultValue);
  if (parsedDefault.success) {
    return parsedDefault.data;
  }

  // Absolute last-resort fallback so we *never* return an invalid quantity
  return 1;
}

/**
 * Type guard to check if an unknown value is a valid Quantity.
 *
 * Useful in places where you need a runtime check before narrowing.
 */
export function isQuantity(value: unknown): value is Quantity {
  return quantitySchema.safeParse(value).success;
}

export const refundSelectionQuantitySchema = quantitySchema.max(
  100,
  'Cannot refund more than 100 units per selection'
);

export type RefundSelectionQuantity = z.infer<
  typeof refundSelectionQuantitySchema
>;
