import type { CollectionConfig } from 'payload';
import { createHash } from 'crypto';
import { sendTrackingEmail } from '@/lib/sendEmail';

/** Carrier union used in emails and checks. */
type Carrier = 'usps' | 'ups' | 'fedex' | 'other';

const carrierLabels: Record<Carrier, 'USPS' | 'UPS' | 'FedEx' | 'Other'> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  other: 'Other'
};

/** Minimal document shape we read. Extend if you store more. */
type OrderDoc = {
  id: string;
  orderNumber?: string;
  name?: string;

  buyer?: string | { id?: string };
  buyerEmail?: string | null;

  items?: Array<{
    nameSnapshot?: string | null;
    quantity?: number | null;
    unitAmount?: number | null; // cents
    amountTotal?: number | null; // cents
  }> | null;

  shipping?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;

  shipment?: {
    carrier?: Carrier | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippedAt?: string | null;
    /** Optional field in your schema for idempotency */
    lastNotifiedKey?: string | null;
  } | null;

  currency?: string | null;
};

type ChangeKind = 'added' | 'updated' | 'removed';

/** Derive the hook type from CollectionConfig to avoid version-specific imports. */
type OrdersAfterChangeHook = NonNullable<
  NonNullable<CollectionConfig['hooks']>['afterChange']
>[number];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function classifyChange(
  previousTracking: string,
  nextTracking: string
): ChangeKind | null {
  const prev = previousTracking.trim();
  const next = nextTracking.trim();
  if (prev === next) return null;
  if (!isNonEmptyString(prev) && isNonEmptyString(next)) return 'added';
  if (isNonEmptyString(prev) && !isNonEmptyString(next)) return 'removed';
  return 'updated';
}

function buildMessageKey(
  orderId: string,
  carrier: Carrier | null | undefined,
  trackingNumber: string
): string {
  const text = `${orderId}|${carrier ?? ''}|${trackingNumber}`;
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export const afterChangeOrders: OrdersAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation
}) => {
  const current = doc as unknown as OrderDoc;
  const previous = previousDoc as unknown as OrderDoc | undefined;

  if (operation !== 'create' && operation !== 'update') return;

  const previousTracking = previous?.shipment?.trackingNumber ?? '';
  const nextTracking = current?.shipment?.trackingNumber ?? '';

  const changeKind = classifyChange(previousTracking, nextTracking);
  if (changeKind === null) return;

  // Usually we do not email on removal; just log.
  if (changeKind === 'removed') {
    req.payload.logger.info(
      { orderId: current.id, previousTracking },
      'Tracking removed'
    );
    return;
  }

  const carrier: Carrier | null | undefined =
    current?.shipment?.carrier ?? null;
  const trackingNumber: string = nextTracking.trim();
  const trackingUrl = current?.shipment?.trackingUrl ?? undefined;
  const shippedAt = current?.shipment?.shippedAt ?? undefined;

  // Idempotency
  const messageKey = buildMessageKey(current.id, carrier, trackingNumber);
  const lastKey = current?.shipment?.lastNotifiedKey ?? null;
  if (lastKey && lastKey === messageKey) {
    req.payload.logger.info(
      { orderId: current.id, messageKey },
      'Duplicate tracking email suppressed'
    );
    return;
  }

  // Resolve recipient
  let toEmail: string | null = isNonEmptyString(current.buyerEmail)
    ? current.buyerEmail
    : null;
  if (!toEmail) {
    const buyerId =
      typeof current.buyer === 'string'
        ? current.buyer
        : (current.buyer?.id ?? null);
    if (buyerId) {
      try {
        const user = await req.payload.findByID({
          collection: 'users',
          id: buyerId
        });
        const candidate = (user as unknown as { email?: string | null })?.email;
        if (isNonEmptyString(candidate)) toEmail = candidate;
      } catch (lookupError) {
        req.payload.logger.warn(
          { orderId: current.id, buyerId, error: String(lookupError) },
          'Buyer email lookup failed'
        );
      }
    }
  }
  if (!toEmail) {
    req.payload.logger.warn(
      { orderId: current.id },
      'No buyer email; skipping tracking email'
    );
    return;
  }

  // --- previous values (only for 'updated') -------------------------------
  const previousCarrier: Carrier | null | undefined =
    previous?.shipment?.carrier ?? null;
  const previousCarrierName =
    changeKind === 'updated' && previousCarrier
      ? carrierLabels[previousCarrier]
      : undefined;
  const previousTrackingNumber =
    changeKind === 'updated' ? previousTracking.trim() || undefined : undefined;

  try {
    const result = await sendTrackingEmail({
      to: toEmail,
      variant: changeKind === 'added' ? 'shipped' : 'tracking-updated',
      order: {
        id: current.id,
        orderNumber: current.orderNumber ?? '',
        name: current.name ?? ''
      },
      shipment: {
        carrier: carrier ?? 'other',
        trackingNumber,
        trackingUrl,
        shippedAt,
        previousCarrierName,
        previousTrackingNumber
      },
      items:
        current.items?.map((item) => ({
          name: item?.nameSnapshot ?? '',
          quantity: typeof item?.quantity === 'number' ? item.quantity : 1,
          unitAmount:
            typeof item?.unitAmount === 'number' ? item.unitAmount : null,
          amountTotal:
            typeof item?.amountTotal === 'number' ? item.amountTotal : null
        })) ?? [],
      shippingAddress: current.shipping ?? undefined,
      messageKey,
      currency: (current.currency ?? 'USD') || 'USD'
    });

    req.payload.logger.info(
      {
        orderId: current.id,
        changeKind,
        messageKey,
        provider: result.provider
      },
      'Tracking email sent'
    );
  } catch (sendError) {
    req.payload.logger.error(
      { orderId: current.id, changeKind, error: String(sendError) },
      'Failed to send tracking email'
    );
    // Do not store messageKey on failure; allows retry on subsequent updates
    return;
  }

  // Save idempotency key (and avoid re-triggering hooks)
  try {
    await req.payload.update({
      collection: 'orders',
      id: current.id,
      data: {
        shipment: { ...(current.shipment ?? {}), lastNotifiedKey: messageKey }
      },
      context: { ahSystem: true }
    });
  } catch (persistError) {
    req.payload.logger.warn(
      { orderId: current.id, error: String(persistError) },
      'Email sent but failed to persist lastNotifiedKey; may send duplicate on retry'
    );
  }
};
