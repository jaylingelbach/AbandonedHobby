'use client';

import { AlertTriangle, RotateCcw, Trash2, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

type CheckoutBannerProps = {
  onReturnToCheckoutAction?: () => void;
  onClearCartAction?: () => void;
  onDismissAction?: () => void;
  disabled?: boolean;
};

/**
 * Displays a banner indicating that checkout was canceled and provides actions to resume checkout, clear the cart, or dismiss the banner.
 *
 * @param onReturnToCheckoutAction - Callback invoked when the user chooses to resume checkout.
 * @param onClearCartAction - Callback invoked when the user chooses to clear the cart.
 * @param onDismissAction - Callback invoked when the user dismisses the banner.
 * @param disabled - When `true`, disables the primary "Return to checkout" action and shows a loading indicator (defaults to `false`).
 * @returns The checkout banner JSX element.
 */
export default function CheckoutBanner({
  onReturnToCheckoutAction,
  onClearCartAction,
  onDismissAction,
  disabled = false
}: CheckoutBannerProps) {
  return (
    <div role="status" aria-live="polite" className="mb-4">
      <div className="relative rounded-xl border-2 border-black bg-[#FFFBEA] p-4 shadow-[6px_6px_0_0_#000]">
        {onDismissAction ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismissAction}
            className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md border-2 border-black bg-white p-1 shadow-[3px_3px_0_0_#000] hover:translate-x hover:translate-y hover:shadow-none"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0"
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
            {onReturnToCheckoutAction ? (
              <Button
                type="button"
                onClick={disabled ? undefined : onReturnToCheckoutAction}
                disabled={disabled}
                aria-disabled={disabled}
                className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000]"
              >
                {disabled ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Return to checkout
              </Button>
            ) : null}

            {onClearCartAction ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onClearCartAction}
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