'use client';

import { Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type ShippingMode = 'free' | 'flat' | 'calculated';

export type ShippingBadgeProps = {
  shippingMode?: ShippingMode | null;
  shippingFlatFee?: number | null; // USD number (e.g., 10 for $10.00)
  className?: string;
};

export function ShippingBadge({
  shippingMode,
  shippingFlatFee,
  className
}: ShippingBadgeProps) {
  const mode: ShippingMode = shippingMode ?? 'free';

  // Normalize USD input for display (badge is UI-only; no cents math here)
  const feeUsdRaw = typeof shippingFlatFee === 'number' ? shippingFlatFee : 0;
  const feeUsd = Number.isFinite(feeUsdRaw) ? Math.max(0, feeUsdRaw) : 0;

  let label: string;
  if (mode === 'free' || (mode === 'flat' && feeUsd <= 0)) {
    label = 'Free shipping';
  } else if (mode === 'flat') {
    label = `Shipping: ${formatCurrency(feeUsd)}`;
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
    >
      <Truck className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
