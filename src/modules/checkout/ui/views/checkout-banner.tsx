'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, Trash2, X } from 'lucide-react';

type CheckoutBannerProps = {
  onReturnToCheckout?: () => void;
  onClearCart?: () => void;
  onDismiss?: () => void;
};

export default function CheckoutBanner({
  onReturnToCheckout,
  onClearCart,
  onDismiss
}: CheckoutBannerProps) {
  return (
    <div role="status" aria-live="polite" className="mb-4">
      <div className="relative rounded-xl border-2 border-black bg-[#FFFBEA] p-4 shadow-[6px_6px_0_0_#000]">
        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md border-2 border-black bg-white p-1 shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Checkout was canceled</p>
              <p className="text-sm text-muted-foreground">
                Your cart is intact. You can resume checkout or clear the cart.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2 sm:pt-0">
            {onReturnToCheckout ? (
              <Button
                type="button"
                onClick={onReturnToCheckout}
                className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000]"
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Return to checkout
              </Button>
            ) : null}

            {onClearCart ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onClearCart}
                className="border-2 border-black"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Clear cart
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
