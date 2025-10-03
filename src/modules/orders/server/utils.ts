// src/modules/server/utils.ts
import { TRPCError } from '@trpc/server';

import { isObjectRecord } from '@/lib/server/utils';

import type {
  OrderConfirmationDTO,
  OrderItemDTO,
  OrderSummaryDTO
} from '../types';
import { Order, Product, Tenant } from '@/payload-types';
import { OrderForBuyer } from '@/modules/library/ui/components/types';

// ───────────────────────────────────────────
// Basic assertions
// ───────────────────────────────────────────

export function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected string at ${path}, got ${typeof value}`
    });
  }
  return value;
}

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

export function assertNonNegativeInt(value: unknown, path: string): number {
  const n = assertNumber(value, path);
  if (!Number.isInteger(n) || n < 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected non-negative integer (cents) at ${path}`
    });
  }
  return n;
}

function assertOptionalNonNegativeInt(
  value: unknown,
  path: string
): number | null {
  if (value == null) return null;
  return assertNonNegativeInt(value, path);
}

export function asOptionalString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ───────────────────────────────────────────
// Shipping reader (supports group or legacy array[0])
// ───────────────────────────────────────────

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
    return { name, line1, line2, city, state, postalCode, country };
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

// ───────────────────────────────────────────
// Mappers
// ───────────────────────────────────────────

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

  const amountSubtotalRaw = (orderItemRaw as Record<string, unknown>)
    .amountSubtotal;
  const amountSubtotalCents =
    assertOptionalNonNegativeInt(
      amountSubtotalRaw,
      `items[${index}].amountSubtotal`
    ) ?? unitAmountCents * quantity;

  const amountTaxRaw = (orderItemRaw as Record<string, unknown>).amountTax;
  const amountTaxCents = assertOptionalNonNegativeInt(
    amountTaxRaw,
    `items[${index}].amountTax`
  );

  const amountTotalRaw = (orderItemRaw as Record<string, unknown>).amountTotal;
  const amountTotalCents =
    assertOptionalNonNegativeInt(
      amountTotalRaw,
      `items[${index}].amountTotal`
    ) ?? amountSubtotalCents + (amountTaxCents ?? 0);
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

  const itemsUnknown = (orderDocument as Record<string, unknown>).items;
  if (!Array.isArray(itemsUnknown) || itemsUnknown.length === 0) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Order.items must be a non-empty array'
    });
  }

  let quantitySum = 0;
  const productIds: string[] = itemsUnknown.map((rawItem, index) => {
    if (!isObjectRecord(rawItem)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `items[${index}] must be an object`
      });
    }

    quantitySum += assertPositiveInt(
      rawItem.quantity,
      `items[${index}].quantity`
    );

    const item = rawItem as Record<string, unknown>;
    const from =
      typeof item.productId === 'string'
        ? item.productId
        : typeof item.product === 'string'
          ? item.product
          : isObjectRecord(item.product) && typeof item.product.id === 'string'
            ? item.product.id
            : !('product' in item) && typeof item.id === 'string'
              ? item.id
              : null;

    if (!from) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Missing product id at items[${index}].product`
      });
    }
    return from;
  });

  const productId = productIds[0];
  if (!productId) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to resolve primary product ID from order items'
    });
  }

  const returnsRaw = (orderDocument as Record<string, unknown>)
    .returnsAcceptedThrough;
  const returnsAcceptedThroughISO =
    typeof returnsRaw === 'string' && returnsRaw.length > 0 ? returnsRaw : null;

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
 * Builds an OrderConfirmationDTO from a raw order document.
 *
 * @param orderDocument - The raw order record to convert; must be an object containing a non-empty `items` array and standard order fields (id, orderNumber, createdAt, currency, total).
 * @returns The mapped OrderConfirmationDTO containing orderId, orderNumber, orderDateISO, uppercased currency, totalCents, optional returnsAcceptedThroughISO, optional receiptUrl, optional tenantSlug, mapped items, and optional shipping snapshot.
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
  const currency = assertString(
    orderDocument.currency,
    'order.currency'
  ).toUpperCase();
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

  // optional tenant slug (prefer sellerTenant; fallback tenant)
  let tenantSlug: string | null = null;
  const maybeSeller = (orderDocument as Record<string, unknown>).sellerTenant;
  const maybeTenant = (orderDocument as Record<string, unknown>).tenant;
  const rel = isObjectRecord(maybeSeller)
    ? maybeSeller
    : isObjectRecord(maybeTenant)
      ? maybeTenant
      : null;
  if (rel) {
    const slugCandidate = asOptionalString(rel.slug);
    if (slugCandidate) tenantSlug = slugCandidate;
  }

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

export type OrderItemDoc =
  NonNullable<Order['items']> extends Array<infer T> ? T : never;

/**
 * Check whether a value is a Product-like object that contains an `id` property.
 *
 * @param val - Value to test for a Product shape
 * @returns `true` if `val` is an object with an `id` property, `false` otherwise.
 */
export function isProductObject(val: unknown): val is Product {
  return (
    !!val && typeof val === 'object' && typeof (val as Product).id === 'string'
  );
}
/**
 * Narrow a value's type to `Tenant` when it contains a `slug` property.
 *
 * @param val - The value to test for the `Tenant` shape
 * @returns `true` if `val` is an object with a `slug` property (a `Tenant`), `false` otherwise.
 */
export function isTenantObject(val: unknown): val is Tenant {
  return (
    !!val && typeof val === 'object' && typeof (val as Tenant).slug === 'string'
  );
}
/**
 * Resolve a relational reference to its string identifier.
 *
 * @param rel - A relational reference: either a string ID, an object that may contain an `id` string, or null/undefined.
 * @returns The string identifier if present, `undefined` otherwise.
 */
export function getRelIdStrict(
  rel: string | { id?: string | null } | null | undefined
): string | undefined {
  if (typeof rel === 'string') return rel;
  if (rel && typeof rel === 'object' && typeof rel.id === 'string') {
    return rel.id;
  }
  return undefined;
}
/**
 * Normalize an unknown value to a number using a fallback.
 *
 * @param n - The value to check for being a number
 * @param fallback - The number to use when `n` is not a number (defaults to `0`)
 * @returns The numeric input `n` if it is a number, otherwise `fallback`
 */
export function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}
/**
 * Normalize a value into a positive integer, using a fallback when invalid.
 *
 * @param n - Value to validate as a positive integer
 * @param fallback - Value to return when `n` is not an integer greater than 0 (defaults to `1`)
 * @returns `n` as a number if it is an integer greater than 0, `fallback` otherwise
 */
export function safePositiveInt(n: unknown, fallback = 1): number {
  return Number.isInteger(n) && (n as number) > 0 ? (n as number) : fallback;
}

/**
 * Builds a buyer-focused OrderForBuyer object from a raw Order document.
 *
 * @param doc - The source Order document to map
 * @returns An OrderForBuyer containing normalized buyer-facing fields:
 * - `id` (stringified), `orderNumber`, `orderDateISO` (if present),
 * - `totalCents`, `currency` (uppercased), `quantity` (at least 1),
 * - `items` (mapped array or `undefined`), `buyerEmail` (string or `null`),
 * - `shipping` (normalized shipping snapshot or `null`), and
 * - `returnsAcceptedThroughISO` (string or `null`)
 */
export function mapOrderToBuyer(doc: Order): OrderForBuyer {
  const totalCents = safeNumber(doc.total, 0);
  const currency = (doc.currency ?? 'USD').toUpperCase();

  const itemsArray: OrderItemDoc[] = Array.isArray(doc.items) ? doc.items : [];

  const quantity = itemsArray.reduce((sum, item) => {
    return sum + safePositiveInt(item?.quantity, 1);
  }, 0);

  const items =
    itemsArray.length > 0
      ? itemsArray.map((item) => {
          const id =
            typeof item.id === 'string' && item.id.length > 0
              ? item.id
              : undefined;

          const product = getRelIdStrict(
            (item.product as string | { id?: string } | null | undefined) ??
              null
          );

          const nameSnapshot =
            typeof item.nameSnapshot === 'string'
              ? item.nameSnapshot
              : undefined;

          const unitAmount =
            typeof item.unitAmount === 'number' ? item.unitAmount : undefined;

          const quantity = safePositiveInt(item.quantity, 1);

          const amountSubtotal =
            typeof item.amountSubtotal === 'number'
              ? item.amountSubtotal
              : undefined;

          const amountTax =
            typeof item.amountTax === 'number' ? item.amountTax : undefined;

          const amountTotal =
            typeof item.amountTotal === 'number' ? item.amountTotal : undefined;

          const refundPolicy =
            typeof item.refundPolicy === 'string'
              ? item.refundPolicy
              : undefined;

          const returnsAcceptedThrough =
            typeof item.returnsAcceptedThrough === 'string'
              ? item.returnsAcceptedThrough
              : undefined;

          return {
            id,
            product,
            nameSnapshot,
            unitAmount,
            quantity,
            amountSubtotal,
            amountTax,
            amountTotal,
            refundPolicy,
            returnsAcceptedThrough
          };
        })
      : undefined;

  const buyerEmail =
    typeof (doc as { buyerEmail?: string | null }).buyerEmail === 'string'
      ? (doc as { buyerEmail?: string | null }).buyerEmail
      : null;

  const shippingRaw = (doc as { shipping?: unknown }).shipping;
  const shipping =
    readShippingFromOrder(shippingRaw) ??
    (shippingRaw && typeof shippingRaw === 'object'
      ? (shippingRaw as OrderForBuyer['shipping'])
      : null);

  const returnsAcceptedThroughISO =
    typeof (doc as { returnsAcceptedThrough?: string | null })
      .returnsAcceptedThrough === 'string'
      ? (doc as { returnsAcceptedThrough?: string | null })
          .returnsAcceptedThrough
      : null;

  return {
    id: String(doc.id),
    orderNumber: doc.orderNumber,
    orderDateISO: (doc as { createdAt?: string })?.createdAt ?? undefined,
    totalCents,
    currency,
    quantity: quantity > 0 ? quantity : 1,
    items,
    buyerEmail,
    shipping,
    returnsAcceptedThroughISO
  };
}
