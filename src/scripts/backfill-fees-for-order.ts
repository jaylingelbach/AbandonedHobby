import 'dotenv/config';
import payloadConfig from '@/payload.config';
import { getPayload } from 'payload';
import Stripe from 'stripe';

type OrderDoc = {
  id: string;
  stripeAccountId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  amounts?: {
    platformFeeCents?: number | null;
    stripeFeeCents?: number | null;
  };
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-08-27.basil'
});

/**
 * Fetches Stripe processing and platform fees and the charge receipt URL for a given Stripe account using a PaymentIntent or Charge ID.
 *
 * @param args.stripeAccountId - Connected Stripe account ID used to scope the API requests
 * @param args.paymentIntentId - Optional PaymentIntent ID; when provided, the intent's latest charge is used
 * @param args.chargeId - Optional Charge ID to use if no PaymentIntent ID is available
 * @returns An object with `stripeFeeCents` (processing fees in cents), `platformFeeCents` (application/platform fees in cents), and `receiptUrl` (charge receipt URL or `null`). If no charge can be resolved, fees are `0` and `receiptUrl` is `null`.
 */
async function readStripeFeesAndReceiptUrl(args: {
  stripeAccountId: string;
  paymentIntentId?: string | null;
  chargeId?: string | null;
}): Promise<{
  stripeFeeCents: number;
  platformFeeCents: number;
  receiptUrl: string | null;
}> {
  const { stripeAccountId, paymentIntentId, chargeId } = args;

  async function fromChargeId(id: string) {
    const charge = await stripe.charges.retrieve(
      id,
      { expand: ['balance_transaction'] },
      { stripeAccount: stripeAccountId }
    );

    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;

    const appFeeCents =
      typeof charge.application_fee_amount === 'number'
        ? charge.application_fee_amount
        : 0;

    let processingFeeCents = 0;
    const details = Array.isArray(bt?.fee_details) ? bt!.fee_details : null;
    if (details) {
      processingFeeCents = details
        .filter((d) => d.type !== 'application_fee')
        .reduce(
          (sum, d) => sum + (typeof d.amount === 'number' ? d.amount : 0),
          0
        );
    } else {
      const totalFee = typeof bt?.fee === 'number' ? bt.fee : 0;
      processingFeeCents = Math.max(0, totalFee - appFeeCents);
    }

    const receiptUrl =
      typeof charge.receipt_url === 'string' ? charge.receipt_url : null;
    return {
      stripeFeeCents: processingFeeCents,
      platformFeeCents: appFeeCents,
      receiptUrl
    };
  }

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge.balance_transaction'] },
      { stripeAccount: stripeAccountId }
    );
    const latestCharge = pi.latest_charge as Stripe.Charge | null;
    if (latestCharge?.id) return fromChargeId(latestCharge.id);
  }
  if (chargeId) return fromChargeId(chargeId);
  return { stripeFeeCents: 0, platformFeeCents: 0, receiptUrl: null };
}

/**
 * Backfills Stripe fee and receipt data for an order identified by a command-line order ID.
 *
 * Reads an order ID from process.argv, loads the order from Payload, validates presence of Stripe identifiers,
 * retrieves Stripe processing and application fees plus a receipt URL, and updates the order document's
 * amounts and documents.receiptUrl in Payload.
 *
 * Exits the process with code 1 if no order ID is provided on the command line.
 *
 * @throws If the order cannot be found.
 * @throws If the order is missing `stripeAccountId`.
 * @throws If the order is missing both `stripePaymentIntentId` and `stripeChargeId`.
 */
async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error(
      'Usage: ts-node scripts/backfill-fees-for-order.ts <orderId>'
    );
    process.exit(1);
  }

  const payload = await getPayload({ config: payloadConfig });

  const order = (await payload.findByID({
    collection: 'orders',
    id: orderId,
    depth: 0,
    overrideAccess: true
  })) as unknown as OrderDoc;

  if (!order) throw new Error('Order not found');
  if (!order.stripeAccountId) throw new Error('Order missing stripeAccountId');
  if (!order.stripePaymentIntentId && !order.stripeChargeId) {
    throw new Error(
      'Order missing both stripePaymentIntentId and stripeChargeId'
    );
  }

  console.log('[backfill] reading stripe fees', {
    orderId: order.id,
    stripeAccountId: order.stripeAccountId,
    paymentIntentId: order.stripePaymentIntentId,
    chargeId: order.stripeChargeId
  });

  const fees = await readStripeFeesAndReceiptUrl({
    stripeAccountId: order.stripeAccountId!,
    paymentIntentId: order.stripePaymentIntentId ?? null,
    chargeId: order.stripeChargeId ?? null
  });

  console.log('[backfill] stripe says', fees);

  await payload.update({
    collection: 'orders',
    id: order.id,
    data: {
      amounts: {
        ...(order.amounts ?? {}),
        platformFeeCents: fees.platformFeeCents, // ← application fee
        stripeFeeCents: fees.stripeFeeCents // ← processing-only
      },
      documents: { receiptUrl: fees.receiptUrl }
    },
    overrideAccess: true,
    context: {
      ahSystem: true as const,
      fees: {
        platformFeeCents: fees.platformFeeCents,
        stripeFeeCents: fees.stripeFeeCents
      }
    }
  });

  console.log('[backfill] updated order amounts ✅');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});