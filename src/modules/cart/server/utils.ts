import { softRelId } from '@/lib/server/utils';
import type { CartDTO, CartItemDTO } from './types';
import { Cart } from '@/payload-types';

/**
 * Constructs a CartDTO representation from a Cart document for the specified tenant.
 *
 * Invalid cart items (missing product id or missing/invalid name, quantity, or unit amount)
 * are omitted from the result; currency is set to `USD`.
 *
 * @param cartDoc - Source cart document containing items and cart id
 * @param tenantId - Tenant identifier to include in the DTO
 * @param tenantSlug - Tenant slug to include in the DTO
 * @returns A CartDTO containing cartId, tenant context, currency (`USD`), distinct item count,
 *          item list, totalApproxCents (sum of line subtotals), and totalQuantity
 */
export function buildCartDTO(
  cartDoc: Cart,
  tenantId: string,
  tenantSlug: string
): CartDTO {
  let approxTotalCents = 0;
  let totalQuantity = 0;
  const itemsForFrontEnd: CartItemDTO[] = [];

  for (const item of cartDoc.items ?? []) {
    const productId = softRelId(item.product);
    if (!productId) {
      console.warn('[buildCartDTO] Missing product id in cart item', {
        cartId: cartDoc.id,
        rawProduct: item.product,
        productId
      });
      continue;
    }

    if (
      !item.nameSnapshot ||
      typeof item.quantity !== 'number' ||
      item.quantity <= 0 ||
      typeof item.unitAmountCents !== 'number' ||
      item.unitAmountCents < 0
    ) {
      console.warn('[buildCartDTO] Invalid cart item fields', {
        cartId: cartDoc.id,
        productId,
        nameSnapshot: item.nameSnapshot,
        quantity: item.quantity,
        unitAmountCents: item.unitAmountCents
      });
      continue;
    }

    const cartItem: CartItemDTO = {
      lineId:
        typeof item.id === 'string' && item.id.trim().length > 0
          ? item.id
          : productId,
      productId,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      lineSubtotalCents: item.unitAmountCents * item.quantity
    };

    itemsForFrontEnd.push(cartItem);
    approxTotalCents += cartItem.lineSubtotalCents;
    totalQuantity += item.quantity;
  }

  const cart: CartDTO = {
    cartId: cartDoc.id,
    tenantSlug,
    currency: 'USD',
    distinctItemCount: itemsForFrontEnd.length,
    items: itemsForFrontEnd,
    tenantId,
    totalApproxCents: approxTotalCents,
    totalQuantity
  };
  return cart;
}