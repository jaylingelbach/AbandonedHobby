import { softRelId } from '@/lib/server/utils';
import type { CartDTO, CartItemDTO } from './types';
import { Cart } from '@/payload-types';

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
