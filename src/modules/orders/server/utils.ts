import { isObjectRecord } from '@/lib/server/utils';
import { TRPCError } from '@trpc/server';
import type {
  OrderConfirmationDTO,
  OrderItemDTO,
  OrderSummaryDTO
} from '../types';

/**
 * Assert a value is a string.
 * @param value - Unknown input to validate.
 * @param path  - JSON-path-like hint for error messages (e.g., "order.id").
 * @returns The value as a string.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if value is not a string.
 */

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected string at ${path}`
    });
  }
  return value;
}

/**
 * Assert a value is a finite number.
 * @param value - Unknown input to validate.
 * @param path  - JSON-path-like hint used in error messages.
 * @returns The value as a number.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if value is NaN or not finite.
 */

function assertNumber(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected finite number at ${path}`
    });
  }
  return value;
}

/**
 * Assert a value is a positive integer (> 0).
 * @param value - Unknown input to validate.
 * @param path  - JSON-path-like hint used in error messages.
 * @returns The value as a number.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if not a positive integer.
 */

function assertPositiveInt(value: unknown, path: string): number {
  const n = assertNumber(value, path);
  if (!Number.isInteger(n) || n <= 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected positive integer at ${path}`
    });
  }
  return n;
}

/**
 * Assert a value is a non-negative integer (>= 0).
 * @param value - Unknown input to validate (e.g., amounts in cents).
 * @param path  - JSON-path-like hint used in error messages.
 * @returns The value as a number.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if not a non-negative integer.
 */

function assertNonNegativeInt(value: unknown, path: string): number {
  const n = assertNumber(value, path);
  if (!Number.isInteger(n) || n < 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected non-negative integer (cents) at ${path}`
    });
  }
  return n;
}

/**
 * Assert a value is either null/undefined or a non-negative integer.
 * @param value - Unknown optional input to validate.
 * @param path  - JSON-path-like hint used in error messages.
 * @returns The value as a number, or null if undefined/null.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if provided and invalid.
 */

function assertOptionalNonNegativeInt(
  value: unknown,
  path: string
): number | null {
  if (value == null) return null;
  return assertNonNegativeInt(value, path);
}

/**
 * Coerce an unknown value to an optional string.
 * @param v - Unknown value to test.
 * @returns `v` if it is a string; otherwise `null`.
 */

function asOptionalString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers (no `any`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard: checks that a value is a non-empty string.
 * @param v - Unknown value to test.
 * @returns True if `v` is a string with length > 0 after trim.
 */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shipping reader (accepts group or legacy array[0])
// Essentials: line1 + postalCode + country; tolerates missing city/state.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a normalized shipping snapshot from an order's `shipping` field.
 *
 * Accepts either:
 *  - an object: `{ name?, line1, line2?, city?, state?, postalCode, country }`
 *  - a legacy array: `[{ ...same fields... }]` (uses first item)
 *
 * Required fields: `line1`, `postalCode`, `country`.
 * Missing non-required fields are returned as `null`.
 *
 * @param shippingRaw - Unknown value from an order document.
 * @returns A normalized shipping object, or `undefined` if insufficient data.
 */

export function readShippingFromOrder(
  shippingRaw: unknown
): OrderSummaryDTO['shipping'] {
  const toSnapshot = (
    obj: Record<string, unknown>
  ): OrderSummaryDTO['shipping'] => {
    const name = isNonEmptyString(obj.name) ? obj.name : 'Customer';
    const line1 = isNonEmptyString(obj.line1) ? obj.line1 : null;
    const line2 = isNonEmptyString(obj.line2) ? obj.line2 : null;
    const city = isNonEmptyString(obj.city) ? obj.city : null;
    const state = isNonEmptyString(obj.state) ? obj.state : null;
    const postalCode = isNonEmptyString(obj.postalCode) ? obj.postalCode : null;
    const country = isNonEmptyString(obj.country) ? obj.country : null;

    if (!line1 || !postalCode || !country) return undefined;

    return {
      name,
      line1,
      line2,
      city,
      state,
      postalCode,
      country
    };
  };

  if (
    shippingRaw &&
    typeof shippingRaw === 'object' &&
    !Array.isArray(shippingRaw)
  ) {
    return toSnapshot(shippingRaw as Record<string, unknown>);
  }
  if (Array.isArray(shippingRaw) && shippingRaw.length > 0) {
    const first = shippingRaw[0];
    if (first && typeof first === 'object') {
      return toSnapshot(first as Record<string, unknown>);
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Main mapper
// ─────────────────────────────────────────────────────────────

/**
 * Map a raw order document to an `OrderSummaryDTO`.
 *
 * Validates the document shape and extracts:
 *  - order metadata (id, number, createdAt, currency, total)
 *  - per-order shipping snapshot
 *  - quantity sum across items
 *  - product ids from items (normalized)
 *
 * Accepted `items[]` product identifier shapes (priority order):
 *  1. `productId: string`        (preferred)
 *  2. `id: string`               (legacy fallback)
 *  3. `product: string`          (relationship by id)
 *  4. `product: { id: string }`  (populated relationship)
 *
 * @param orderDocument - Unknown raw order record (from Payload).
 * @returns A strict `OrderSummaryDTO`.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) on shape/type violations.
 */

export function mapOrderToSummary(orderDocument: unknown): OrderSummaryDTO {
  if (!isObjectRecord(orderDocument)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Order must be an object'
    });
  }

  const orderId = assertString(orderDocument.id, 'order.id');
  const orderNumber = assertString(
    orderDocument.orderNumber,
    'order.orderNumber'
  );
  const orderDateISO = assertString(orderDocument.createdAt, 'order.createdAt');
  const currency = assertString(orderDocument.currency, 'order.currency');
  const totalCents = assertNonNegativeInt(orderDocument.total, 'order.total');

  // Items array (non-empty)
  const itemsUnknown = (orderDocument as Record<string, unknown>).items;
  if (!Array.isArray(itemsUnknown) || itemsUnknown.length === 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Order.items must be a non-empty array'
    });
  }

  // Sum quantity and collect productIds
  let quantitySum = 0;
  const productIds: string[] = itemsUnknown.map((rawItem, index) => {
    if (!isObjectRecord(rawItem)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `items[${index}] must be an object`
      });
    }

    // quantity
    quantitySum += assertPositiveInt(
      rawItem.quantity,
      `items[${index}].quantity`
    );

    // product id (priority: productId → id → product (string) → product.id)
    const item = rawItem as Record<string, unknown>;
    const candidateId =
      typeof item.productId === 'string'
        ? item.productId
        : typeof item.id === 'string'
          ? item.id
          : typeof item.product === 'string'
            ? item.product
            : isObjectRecord(item.product) &&
                typeof item.product.id === 'string'
              ? item.product.id
              : null;

    if (!candidateId) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `items[${index}].product (or productId/id) is required`
      });
    }

    return candidateId;
  });

  // Primary product id for back-compat UI links
  const primaryProductIdCandidate = productIds[0];
  if (typeof primaryProductIdCandidate !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to resolve primary product ID from order items'
    });
  }
  const productId = primaryProductIdCandidate;

  // Order-level returns cutoff → normalize to null if absent
  const returnsRaw = (orderDocument as Record<string, unknown>)
    .returnsAcceptedThrough;
  const returnsAcceptedThroughISO =
    typeof returnsRaw === 'string' && returnsRaw.length > 0 ? returnsRaw : null;

  // Shipping snapshot (group or array[0])
  const shippingRaw = (orderDocument as Record<string, unknown>).shipping;
  const shipping = readShippingFromOrder(shippingRaw);

  return {
    orderId,
    orderNumber,
    orderDateISO,
    returnsAcceptedThroughISO,
    currency,
    totalCents,
    quantity: quantitySum,
    productId,
    productIds,
    shipping
  };
}

/**
 * Map a raw order item to an `OrderItemDTO`.
 *
 * Accepted `product` shapes:
 *  - `product: string`           (id)
 *  - `product: { id: string }`   (populated)
 *
 * Required numeric fields are validated as integers (quantity) and
 * non-negative integers for monetary amounts in cents.
 *
 * @param orderItemRaw - Unknown raw item object.
 * @param index        - Index in the items array (for error messages).
 * @returns A strict `OrderItemDTO`.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) on shape/type violations.
 */

function mapOrderItem(orderItemRaw: unknown, index: number): OrderItemDTO {
  if (!isObjectRecord(orderItemRaw)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `items[${index}] must be an object`
    });
  }

  // product can be a string id OR a populated object with { id: string }
  const productRef = (orderItemRaw as Record<string, unknown>).product;
  const productId =
    typeof productRef === 'string'
      ? productRef
      : isObjectRecord(productRef) && typeof productRef.id === 'string'
        ? productRef.id
        : (() => {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Expected string or {id} at items[${index}].product`
            });
          })();

  const name = assertString(
    orderItemRaw.nameSnapshot,
    `items[${index}].nameSnapshot`
  );
  const quantity = assertPositiveInt(
    orderItemRaw.quantity,
    `items[${index}].quantity`
  );
  const unitAmountCents = assertNonNegativeInt(
    orderItemRaw.unitAmount,
    `items[${index}].unitAmount`
  );
  const amountSubtotalCents = assertNonNegativeInt(
    orderItemRaw.amountSubtotal,
    `items[${index}].amountSubtotal`
  );
  const amountTotalCents = assertNonNegativeInt(
    orderItemRaw.amountTotal,
    `items[${index}].amountTotal`
  );

  const amountTaxRaw = (orderItemRaw as Record<string, unknown>).amountTax;
  const amountTaxCents = assertOptionalNonNegativeInt(
    amountTaxRaw,
    `items[${index}].amountTax`
  );

  const returnsRaw = (orderItemRaw as Record<string, unknown>)
    .returnsAcceptedThrough;
  const returnsAcceptedThroughISO =
    typeof returnsRaw === 'string' ? returnsRaw : null;

  const thumbnailRaw = (orderItemRaw as Record<string, unknown>).thumbnailUrl;
  const thumbnailUrl = typeof thumbnailRaw === 'string' ? thumbnailRaw : null;

  return {
    productId,
    name,
    quantity,
    unitAmountCents,
    amountSubtotalCents,
    amountTaxCents,
    amountTotalCents,
    thumbnailUrl,
    returnsAcceptedThroughISO
  };
}

/**
 * Map a raw order document to an `OrderConfirmationDTO`.
 *
 * Validates essential order fields, maps each item via `mapOrderItem`,
 * resolves an optional tenant slug (prefers `sellerTenant`, falls back
 * to `tenant`), and includes an optional normalized shipping snapshot.
 *
 * @param orderDocument - Unknown raw order record (from Payload).
 * @returns A strict `OrderConfirmationDTO`.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) on shape/type violations.
 */

export function mapOrderToConfirmation(
  orderDocument: unknown
): OrderConfirmationDTO {
  if (!isObjectRecord(orderDocument)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Order must be an object'
    });
  }

  const orderId = assertString(orderDocument.id, 'order.id');
  const orderNumber = assertString(
    orderDocument.orderNumber,
    'order.orderNumber'
  );
  const orderDateISO = assertString(orderDocument.createdAt, 'order.createdAt');
  const currency = assertString(orderDocument.currency, 'order.currency');
  const totalCents = assertNonNegativeInt(orderDocument.total, 'order.total');

  const itemsUnknown = (orderDocument as Record<string, unknown>).items;
  if (!Array.isArray(itemsUnknown) || itemsUnknown.length === 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Order.items must be a non-empty array'
    });
  }
  const items: OrderItemDTO[] = itemsUnknown.map((item, index) =>
    mapOrderItem(item, index)
  );

  const returnsOrderRaw = (orderDocument as Record<string, unknown>)
    .returnsAcceptedThrough;
  const returnsAcceptedThroughISO =
    typeof returnsOrderRaw === 'string' ? returnsOrderRaw : null;

  const receiptUrlRaw = (orderDocument as Record<string, unknown>).receiptUrl;
  const receiptUrl = typeof receiptUrlRaw === 'string' ? receiptUrlRaw : null;

  // Optional tenant slug for CTAs (prefer sellerTenant; fallback to tenant)
  let tenantSlug: string | null = null;
  const maybeSeller = (orderDocument as Record<string, unknown>).sellerTenant;
  const maybeTenant = (orderDocument as Record<string, unknown>).tenant;
  const tenantRelation = isObjectRecord(maybeSeller)
    ? maybeSeller
    : isObjectRecord(maybeTenant)
      ? maybeTenant
      : null;
  if (tenantRelation) {
    const slugCandidate = asOptionalString(tenantRelation.slug);
    if (slugCandidate) tenantSlug = slugCandidate;
  }

  // 🔹 NEW: map shipping (supports group or legacy array[0])
  const shippingRaw = (orderDocument as Record<string, unknown>).shipping;
  const shipping = readShippingFromOrder(shippingRaw);

  return {
    orderId,
    orderNumber,
    orderDateISO,
    currency,
    totalCents,
    returnsAcceptedThroughISO,
    receiptUrl,
    tenantSlug,
    items,
    shipping
  };
}
