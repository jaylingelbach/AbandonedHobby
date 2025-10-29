import type { CollectionConfig } from 'payload';
import { createHash } from 'crypto';
import { sendTrackingEmail } from '@/lib/sendEmail';
import { isNonEmptyString } from '@/lib/utils';

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

/** Server-side normalization so comparisons are apples-to-apples. */
function normalizeTrackingServer(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/[\s\u2010-\u2015\-]+/g, '')
    .toUpperCase();
}

/** Derive the hook type from CollectionConfig to avoid version-specific imports. */
type OrdersAfterChangeHook = NonNullable<
  NonNullable<CollectionConfig['hooks']>['afterChange']
>[number];

/**
 * Determines whether a shipment tracking number was added, removed, updated, or unchanged.
 *
 * @param previousTracking - The previous tracking number value (may be empty or whitespace)
 * @param nextTracking - The new tracking number value (may be empty or whitespace)
 * @returns `'added'` if a tracking number was introduced, `'removed'` if it was cleared, `'updated'` if it changed, or `null` if there is no change
 */
function classifyChange(
  previousTrackingRaw: string,
  nextTrackingRaw: string,
  previousCarrier: Carrier | null | undefined,
  nextCarrier: Carrier | null | undefined
): ChangeKind | null {
  // Normalize on server to match what the client does
  const prevT = normalizeTrackingServer(previousTrackingRaw);
  const nextT = normalizeTrackingServer(nextTrackingRaw);
  const trackingChanged = prevT !== nextT;
  const carrierChanged = (previousCarrier ?? null) !== (nextCarrier ?? null);

  // Added/removed are strictly about tracking presence
  if (!isNonEmptyString(prevT) && isNonEmptyString(nextT)) return 'added';
  if (isNonEmptyString(prevT) && !isNonEmptyString(nextT)) return 'removed';

  // If either the tracking number or the carrier changed, it’s an update
  if (isNonEmptyString(nextT) && (trackingChanged || carrierChanged))
    return 'updated';
  return null;
}

/**
 * Produces a deterministic idempotency key for a shipment by hashing the order id, carrier, and tracking number.
 *
 * @param orderId - The order's unique identifier
 * @param carrier - The carrier code (e.g., 'usps', 'ups', 'fedex', 'other') or `null`/`undefined` when unknown
 * @param trackingNumber - The shipment tracking number
 * @returns A SHA-256 hex digest of `orderId|carrier|trackingNumber`
 */
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
  // Skip internal updates where we only persist idempotency, etc.
  if (req?.context?.ahSystem) {
    req.payload.logger.debug('afterChangeOrders: skipped (ahSystem context)');
    return;
  }

  const current = doc as unknown as OrderDoc;
  const previous = previousDoc as unknown as OrderDoc | undefined;

  if (operation !== 'create' && operation !== 'update') return;

  const previousTracking = previous?.shipment?.trackingNumber ?? '';
  const nextTracking = current?.shipment?.trackingNumber ?? '';
  const prevCarrier: Carrier | null | undefined =
    previous?.shipment?.carrier ?? null;
  const nextCarrier: Carrier | null | undefined =
    current?.shipment?.carrier ?? null;

  const changeKind = classifyChange(
    previousTracking,
    nextTracking,
    prevCarrier,
    nextCarrier
  );
  if (changeKind === null) {
    req.payload.logger.info(
      {
        orderId: current.id,
        reason: 'no-change',
        prevCarrier,
        nextCarrier,
        previousTracking: normalizeTrackingServer(previousTracking),
        nextTracking: normalizeTrackingServer(nextTracking)
      },
      'Tracking email skipped'
    );
    return;
  }

  if (changeKind === 'removed') {
    const redact = (v: string) =>
      v && v.length > 8
        ? `${v.slice(0, 3)}…${v.slice(-3)}`
        : v.replace(/.(?=..)/g, '•');
    req.payload.logger.info(
      { orderId: current.id, previousTracking: redact(previousTracking) },
      'Tracking removed'
    );
    return;
  }

  const carrier: Carrier | null | undefined = nextCarrier;
  const trackingNumber: string = normalizeTrackingServer(nextTracking);
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
      { orderId: current.id, reason: 'no-recipient' },
      'Tracking email skipped'
    );
    return;
  }

  // --- previous values (only for 'updated') -------------------------------
  const previousCarrier: Carrier | null | undefined = prevCarrier;
  const previousCarrierName =
    changeKind === 'updated' && previousCarrier
      ? carrierLabels[previousCarrier]
      : undefined;

  const normalizedPrevTracking = normalizeTrackingServer(previousTracking);
  const previousTrackingNumber =
    changeKind === 'updated' && isNonEmptyString(normalizedPrevTracking)
      ? normalizedPrevTracking
      : undefined;

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
      currency: current.currency ?? 'USD'
    });

    req.payload.logger.info(
      {
        orderId: current.id,
        changeKind,
        messageKey,
        normalizedTracking: trackingNumber,
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
