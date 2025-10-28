import type { CollectionBeforeChangeHook } from 'payload';
import { computeOrderAmounts } from './compute-amounts';

type AmountsShape = {
  subtotalCents: number;
  taxTotalCents: number;
  shippingTotalCents: number;
  discountTotalCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  sellerNetCents: number;
};

type OrderItemInput = {
  unitAmount?: number | null;
  quantity?: number | null;
  amountSubtotal?: number | null;
  amountTax?: number | null;
  amountTotal?: number | null;
};

type OriginalDocShape = {
  total?: number;
  items?: OrderItemInput[] | null;
  amounts?: Partial<AmountsShape> | null;
};

type ReqContextFees = {
  ahSystem?: boolean; // mark trusted writes (e.g., Stripe webhook)
  fees?: Partial<
    Pick<
      AmountsShape,
      | 'shippingTotalCents'
      | 'discountTotalCents'
      | 'stripeFeeCents'
      | 'platformFeeCents'
    >
  >;
};

/**
 * Always recompute `amounts` server-side from trusted inputs.
 * - Ignores client-sent `amounts` and, unless ahSystem=true, ignores client `total`.
 * - Allows webhooks/system to pass fees via `req.context.fees`.
 */
export const lockAndCalculateAmounts: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req
}) => {
  if (!data) return data;

  const ctx = (req?.context ?? {}) as ReqContextFees;
  const isSystem = ctx.ahSystem === true;

  // Items: take incoming items if present (admin edits like quantity/returns), else fall back
  const incomingItems = Array.isArray((data as { items?: unknown }).items)
    ? ((data as { items?: unknown }).items as unknown[])
    : undefined;

  const persistedItems =
    (originalDoc as OriginalDocShape | undefined)?.items ?? null;

  const items: OrderItemInput[] = (incomingItems ??
    persistedItems ??
    []) as OrderItemInput[];

  // Total (amount paid, cents):
  // - If system write (webhook), accept incoming `data.total`
  // - Otherwise, lock to persisted `originalDoc.total`
  const persistedTotal =
    typeof (originalDoc as OriginalDocShape | undefined)?.total === 'number'
      ? (originalDoc as OriginalDocShape).total!
      : 0;

  const incomingTotal =
    typeof (data as { total?: unknown }).total === 'number'
      ? (data as { total?: number }).total
      : undefined;

  const totalCents =
    isSystem && typeof incomingTotal === 'number'
      ? incomingTotal
      : persistedTotal;

  // Fees: only accept from trusted context; otherwise prefer persisted amounts (never client)
  const persistedAmounts = ((originalDoc as OriginalDocShape | undefined)
    ?.amounts ?? {}) as Partial<AmountsShape>;

  const shippingTotalCents =
    ctx.fees?.shippingTotalCents ?? persistedAmounts.shippingTotalCents ?? 0;

  const discountTotalCents =
    ctx.fees?.discountTotalCents ?? persistedAmounts.discountTotalCents ?? 0;

  const stripeFeeCents =
    ctx.fees?.stripeFeeCents ?? persistedAmounts.stripeFeeCents ?? 0;

  const platformFeeCents =
    ctx.fees?.platformFeeCents ?? persistedAmounts.platformFeeCents ?? 0;

  // Compute authoritative amounts
  const computed = computeOrderAmounts({
    items,
    totalCents,
    shippingTotalCents,
    discountTotalCents,
    stripeFeeCents,
    platformFeeCents
  });

  // Never carry forward client-provided amounts; always overwrite
  return {
    ...data,
    total: totalCents, // ensure locked value persists on user edits
    amounts: computed
  };
};
