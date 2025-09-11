import type {
  CentsVariant,
  DollarsVariant,
  OrderSummaryCardProps
} from '../types';

export function hasTotalCents(
  props: OrderSummaryCardProps
): props is CentsVariant {
  return (
    'totalCents' in props &&
    typeof (props as CentsVariant).totalCents === 'number' &&
    !('totalPaid' in props)
  );
}

export function hasTotalPaid(
  props: OrderSummaryCardProps
): props is DollarsVariant {
  return (
    'totalPaid' in props &&
    typeof (props as DollarsVariant).totalPaid === 'number' &&
    !('totalCents' in props)
  );
}
