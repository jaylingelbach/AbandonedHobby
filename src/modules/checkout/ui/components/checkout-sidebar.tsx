'use client';

import { CircleXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type {
  CartItemForShipping,
  SidebarShippingLine
} from '@/modules/orders/types';
import { ShippingBreakdown } from '@/modules/shipping/ui/shipping-breakdown';

interface CheckoutSidebarProps {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  onPurchaseAction: () => void;
  isCanceled: boolean;
  disabled: boolean;
  itemizedShipping?: SidebarShippingLine[];
  hasCalculatedShipping?: boolean;
}

export const CheckoutSidebar = ({
  subtotalCents,
  shippingCents,
  totalCents,
  onPurchaseAction,
  isCanceled,
  disabled,
  itemizedShipping = [],
  hasCalculatedShipping = false
}: CheckoutSidebarProps) => {
  const toUsd = (cents: number) => {
    if (!Number.isFinite(cents) || cents < 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Non-finite or negative monetary value:', cents);
      }
    }
    return formatCurrency((cents || 0) / 100);
  };

  if (process.env.NODE_ENV === 'development') {
    const expectedTotal = subtotalCents + shippingCents;
    if (totalCents !== expectedTotal) {
      console.error(
        `CheckoutSidebar total mismatch: expected ${expectedTotal}, got ${totalCents}`
      );
    }
  }

  return (
    <div className="border rounded-md overflow-hidden bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="text-sm font-medium">{toUsd(subtotalCents)}</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-muted-foreground">
            Shipping (total)
          </span>
          <span className="text-sm font-medium">{toUsd(shippingCents)}</span>
        </div>

        {/* Per-item shipping breakdown (only when present)
        {itemizedShipping.length > 0 || hasCalculatedShipping ? (
          <div className="mt-2 pl-2">
            {itemizedShipping.length > 0 && (
              <ul className="space-y-1">
                {itemizedShipping.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span className="truncate">{line.label}</span>
                    <span className="font-medium">
                      {toUsd(line.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {hasCalculatedShipping && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                Additional shipping will be calculated at checkout.
              </p>
            )}
          </div>
        ) : null} */}

        {/* Per-item shipping breakdown (component) */}
        {(itemizedShipping.length > 0 || hasCalculatedShipping) && (
          <div className="mt-2 pl-2">
            <ShippingBreakdown
              items={itemizedShipping.map(
                (line): CartItemForShipping => ({
                  id: line.id,
                  name: line.label,
                  quantity: 1, // current cart is one-per-id; adjust if you add quantities
                  shippingMode: line.mode,
                  shippingFeeCentsPerUnit:
                    line.mode === 'flat' ? line.amountCents : 0
                })
              )}
            />

            {hasCalculatedShipping && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                Additional shipping will be calculated at checkout.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between py-2 border-t mt-2">
          <h4 className="font-semibold text-base">Total</h4>
          <p className="font-semibold text-base">{toUsd(totalCents)}</p>
        </div>
      </div>

      <div className="p-4 items-center justify-center">
        <Button
          aria-label="Complete checkout process"
          className="text-base w-full text-white bg-primary hover:bg-pink-400 hover:text-primary"
          disabled={disabled}
          onClick={onPurchaseAction}
          size="lg"
          variant="elevated"
        >
          Checkout
        </Button>
      </div>

      {isCanceled && (
        <div className="p-4 flex justify-center items-center border-t">
          <div
            className="bg-red-100 border border-red-400 font-medium px-4 py-3 rounded flex items-center w-full"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center">
              <CircleXIcon className="size-6 mr-2 fill-red-500 text-red-100" />
              <span>Checkout failed, please try again. </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutSidebar;
