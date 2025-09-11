import type {
  CentsVariant,
  DollarsVariant,
  OrderSummaryCardProps
} from '../types';

export function hasTotalCents(
  props: OrderSummaryCardProps
): props is CentsVariant {
  return typeof (props as CentsVariant).totalCents === 'number';
}

export function hasTotalPaid(
  props: OrderSummaryCardProps
): props is DollarsVariant {
  return typeof (props as DollarsVariant).totalPaid === 'number';
}
