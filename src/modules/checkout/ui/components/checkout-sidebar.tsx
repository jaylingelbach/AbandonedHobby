'use client';

import { CircleXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { CartItemForShipping } from '@/modules/orders/types';
import { ShippingBreakdown } from '@/modules/shipping/ui/shipping-breakdown';

interface CheckoutSidebarProps {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  onPurchaseAction: () => void;
  isCanceled: boolean;
  disabled: boolean;

  /** Prebuilt items with real quantities (build in checkout-view) */
  breakdownItems?: CartItemForShipping[];
  hasCalculatedShipping?: boolean;
}

export const CheckoutSidebar = ({
  subtotalCents,
  shippingCents,
  totalCents,
  onPurchaseAction,
  isCanceled,
  disabled,
  breakdownItems = [],
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

  console.log(`breakdown items: ${JSON.stringify(breakdownItems, null, 2)}`);
  return (
    <div className="border rounded-md overflow-hidden bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm">Subtotal</span>
          <span className="text-sm font-medium">{toUsd(subtotalCents)}</span>
        </div>

        {(breakdownItems.length > 1 || hasCalculatedShipping) && (
          <div className="mt-2">
            <ShippingBreakdown items={breakdownItems} />
            {hasCalculatedShipping && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                Additional shipping will be calculated at checkout.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between py-1">
          <span className="text-sm">Shipping (total)</span>
          <span className="text-sm font-medium">{toUsd(shippingCents)}</span>
        </div>

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
              <span>Checkout failed, please try again.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutSidebar;
