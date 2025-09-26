import { isObjectRecord } from '@/lib/server/utils';
import { TRPCError } from '@trpc/server';
import { OrderConfirmationDTO, OrderItemDTO, OrderSummaryDTO } from './types';

/**
 * Assert a value is a string.
 * @param value - Unknown input to validate.
 * @param path  - JSON-path-like hint used in error messages (e.g., "order.id").
 * @returns The value as a string.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if the value is not a string.
 */

export function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected string at ${path}`
    });
  }
  return value;
}

/**
 * Assert a value is a number (not NaN).
 * @param value - Unknown input to validate.
 * @param path  - JSON-path-like hint used in error messages.
 * @returns The value as a number.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) if the value is not a number or is NaN.
 */

export function assertNumber(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected number at ${path}`
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

export function assertPositiveInt(value: unknown, path: string): number {
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
 * Map a raw order document to an `OrderSummaryDTO`.
 *
 * Validates shape and extracts:
 *  - `orderId`, `orderNumber`, `orderDateISO`, `currency`, `totalCents`
 *  - `items` summary: total `quantity` and product ids
 *  - `productId` (first item) and full `productIds`
 *  - `returnsAcceptedThroughISO` (or null)
 *
 * Expected raw shapes:
 *  - `order.items` must be a non-empty array of objects
 *  - For each item: `{ quantity: number, productId?: string, id?: string }`
 *    (prefers `productId`, falls back to legacy `id`)
 *
 * @param orderDocument - Unknown raw order record (Payload response).
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

  // createdAt should be an ISO string in Payload responses
  const orderDateISO = assertString(orderDocument.createdAt, 'order.createdAt');

  const currency = assertString(orderDocument.currency, 'order.currency');
  const totalCents = assertNumber(orderDocument.total, 'order.total');

  const itemsUnknown = (orderDocument as Record<string, unknown>).items;
  if (!Array.isArray(itemsUnknown) || itemsUnknown.length === 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Order.items must be a non-empty array'
    });
  }

  let quantitySum = 0;
  const productIds: string[] = itemsUnknown.map((item, index) => {
    if (!isObjectRecord(item)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `items[${index}] must be an object`
      });
    }

    // quantity must be a positive integer
    const quantity = assertPositiveInt(
      item.quantity,
      `items[${index}].quantity`
    );
    quantitySum += quantity;

    // prefer item.productId, fallback to item.id
    const id =
      typeof item.productId === 'string'
        ? item.productId
        : typeof item.id === 'string'
          ? item.id
          : null;

    if (!id) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `items[${index}].productId (or id) is required`
      });
    }
    return id;
  });

  // Primary product id (first) for back-compat with existing UI links
  const primaryProductIdCandidate = productIds.at(0); // string | undefined
  if (typeof primaryProductIdCandidate !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'No product id resolved from order items'
    });
  }
  const primaryProductId: string = primaryProductIdCandidate;

  // Pull the order-level returns cutoff saved by the webhook; normalize to null if absent
  const returnsRaw = (orderDocument as Record<string, unknown>)
    .returnsAcceptedThrough;
  const returnsAcceptedThroughISO =
    typeof returnsRaw === 'string' ? returnsRaw : null;

  return {
    orderId,
    orderNumber,
    orderDateISO,
    returnsAcceptedThroughISO,
    currency,
    totalCents,
    quantity: quantitySum,
    productId: primaryProductId,
    productIds
  };
}

/**
 * Map a raw order item to an `OrderItemDTO`.
 *
 * Expected raw shape (from your webhook):
 *  - `product: string` (product id)
 *  - `nameSnapshot: string`
 *  - `quantity: number` (positive integer)
 *  - `unitAmount: number` (cents)
 *  - `amountSubtotal: number` (cents)
 *  - `amountTax?: number` (cents)
 *  - `amountTotal: number` (cents)
 *  - `returnsAcceptedThrough?: string` (ISO date)
 *  - `thumbnailUrl?: string`
 *
 * @param orderItemRaw - Unknown raw item object.
 * @param index        - Index in the items array (for clearer error messages).
 * @returns A strict `OrderItemDTO`.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) on shape/type violations.
 */

export function mapOrderItem(
  orderItemRaw: unknown,
  index: number
): OrderItemDTO {
  if (!isObjectRecord(orderItemRaw)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `items[${index}] must be an object`
    });
  }

  // Schema from your webhook: product (string), nameSnapshot, unitAmount, quantity, amountSubtotal, amountTax, amountTotal, returnsAcceptedThrough
  const productId = assertString(
    orderItemRaw.product,
    `items[${index}].product`
  );
  const name = assertString(
    orderItemRaw.nameSnapshot,
    `items[${index}].nameSnapshot`
  );
  const quantity = assertPositiveInt(
    orderItemRaw.quantity,
    `items[${index}].quantity`
  );
  const unitAmountCents = assertNumber(
    orderItemRaw.unitAmount,
    `items[${index}].unitAmount`
  );
  const amountSubtotalCents = assertNumber(
    orderItemRaw.amountSubtotal,
    `items[${index}].amountSubtotal`
  );
  const amountTotalCents = assertNumber(
    orderItemRaw.amountTotal,
    `items[${index}].amountTotal`
  );

  const amountTaxRaw = (orderItemRaw as Record<string, unknown>).amountTax;
  const amountTaxCents =
    typeof amountTaxRaw === 'number' && !Number.isNaN(amountTaxRaw)
      ? amountTaxRaw
      : null;

  const returnsRaw = (orderItemRaw as Record<string, unknown>)
    .returnsAcceptedThrough;
  const returnsAcceptedThroughISO =
    typeof returnsRaw === 'string' ? returnsRaw : null;

  // Optional thumbnail if you snapshot it in your schema (skip if not present)
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
 * Validates essential order fields and maps each item via `mapOrderItem`.
 * Also includes optional fields when present:
 *  - `returnsAcceptedThroughISO`
 *  - `receiptUrl`
 *  - `tenantSlug` (if `order.tenant` is populated and has `slug`)
 *
 * @param orderDocument - Unknown raw order record (Payload response).
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
  const totalCents = assertNumber(orderDocument.total, 'order.total');

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

  // Optional tenant slug for CTAs (if populated by depth>0)
  let tenantSlug: string | null = null;
  const tenantRelation = (orderDocument as Record<string, unknown>).tenant;
  if (isObjectRecord(tenantRelation)) {
    const slugCandidate = (tenantRelation as Record<string, unknown>).slug;
    if (typeof slugCandidate === 'string') tenantSlug = slugCandidate;
  }

  return {
    orderId,
    orderNumber,
    orderDateISO,
    currency,
    totalCents,
    returnsAcceptedThroughISO,
    receiptUrl,
    tenantSlug,
    items
  };
}
