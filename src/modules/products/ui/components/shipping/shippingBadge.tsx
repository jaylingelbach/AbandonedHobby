'use client';

import { Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ShippingMode } from '@/modules/orders/types';

export type ShippingBadgeProps = {
  shippingMode?: ShippingMode | null;
  /** USD number (e.g., 10 for $10.00). Optional if cents provided. */
  shippingFlatFee?: number | null;
  /** Integer cents. Preferred if provided. */
  shippingFeeCentsPerUnit?: number | null;
  className?: string;
};

export function ShippingBadge({
  shippingMode,
  shippingFlatFee,
  shippingFeeCentsPerUnit,
  className
}: ShippingBadgeProps) {
  const mode: ShippingMode = shippingMode ?? 'free';

  // Prefer precise cents when provided; else fall back to USD number.
  const cents =
    typeof shippingFeeCentsPerUnit === 'number' &&
    Number.isFinite(shippingFeeCentsPerUnit)
      ? Math.max(0, Math.trunc(shippingFeeCentsPerUnit))
      : null;

  const usd =
    cents != null
      ? cents / 100
      : typeof shippingFlatFee === 'number' && Number.isFinite(shippingFlatFee)
        ? Math.max(0, shippingFlatFee)
        : 0;

  let label: string;
  if (mode === 'free' || (mode === 'flat' && usd <= 0)) {
    label = 'Free shipping';
  } else if (mode === 'flat') {
    label = `Shipping: ${formatCurrency(usd)}`;
  } else {
    label = 'Shipping at checkout';
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border-2 border-black bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium shadow-[3px_3px_0_0_rgba(0,0,0,1)]',
        'whitespace-nowrap',
        className ?? ''
      ].join(' ')}
      aria-label={label}
      title={label}
    >
      <Truck className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
