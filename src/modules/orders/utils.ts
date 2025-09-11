import { isObjectRecord } from '@/lib/server/utils';
import { TRPCError } from '@trpc/server';
import { OrderConfirmationDTO, OrderItemDTO, OrderSummaryDTO } from './types';

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Expected string at ${path}`
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

/** Optional string helper (keeps types strict without using `any`). */
function asOptionalString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Read a shipping snapshot from either a Payload `group` or legacy `array[0]`. */
function readShippingFromOrder(
  shippingRaw: unknown
): OrderConfirmationDTO['shipping'] {
  // New schema (group)
  if (isObjectRecord(shippingRaw)) {
    const name = asOptionalString(shippingRaw.name);
    const line1 = asOptionalString(shippingRaw.line1);
    const line2 = asOptionalString(shippingRaw.line2);
    const city = asOptionalString(shippingRaw.city);
    const state = asOptionalString(shippingRaw.state);
    const postalCode = asOptionalString(shippingRaw.postalCode);
    const country = asOptionalString(shippingRaw.country);

    // Only return shipping if we have the essential address parts
    if (line1 && city && state && postalCode && country) {
      return {
        name: name ?? 'Customer',
        line1,
        line2,
        city,
        state,
        postalCode,
        country
      };
    }
    return null;
  }

  // Legacy schema (array): take first element if present
  if (Array.isArray(shippingRaw) && shippingRaw.length > 0) {
    const first = shippingRaw[0];
    if (isObjectRecord(first)) {
      const name = asOptionalString(first.name);
      const line1 = asOptionalString(first.line1);
      const line2 = asOptionalString(first.line2);
      const city = asOptionalString(first.city);
      const state = asOptionalString(first.state);
      const postalCode = asOptionalString(first.postalCode);
      const country = asOptionalString(first.country);

      if (line1 && city && state && postalCode && country) {
        return {
          name: name ?? 'Customer',
          line1,
          line2,
          city,
          state,
          postalCode,
          country
        };
      }
    }
  }

  return null;
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
    const quantity = assertNumber(item.quantity, `items[${index}].quantity`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `items[${index}].quantity must be a positive integer`
      });
    }
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
      message: 'Failed to resolve primary product ID from order items array'
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

/** Map one raw order doc (unknown) → OrderConfirmationDTO (strict). */
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
