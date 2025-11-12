import { Client } from 'postmark';
import { formatCents } from './utils';
import { carrierLabels } from '@/constants';
import type { ShippingMode } from '@/modules/orders/types';

const postmark = new Client(process.env.POSTMARK_SERVER_TOKEN!);

type LineItem = {
  description: string;
  amount: string;
};

type SendSupportOptions = {
  role: string;
  topic: string;
  reference: string;
  email: string;
  description: string;
};

type SendSaleNotificationOptions = {
  to: string;
  sellerName: string;
  receiptId: string;
  orderDate: string;
  lineItems: LineItem[];
  receipt_details_v2?: ReceiptLineV2[];
  amounts?: AmountsModel;
  fees?: FeesModel;
  total: string;
  item_summary: string;
  shipping_name: string;
  shipping_address_line1: string;
  shipping_address_line2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  shipping_country?: string;
  support_url: string;
};

type SendOrderConfirmationOptions = {
  to: string;
  name: string;
  creditCardStatement: string;
  creditCardBrand: string;
  creditCardLast4: string;
  receiptId: string;
  orderDate: string;
  lineItems: LineItem[];
  receipt_details_v2?: ReceiptLineV2[];
  amounts?: AmountsModel;
  total: string;
  item_summary: string;
  support_url: string;
};

type SendWelcomeOptions = {
  to: string;
  name: string;
  product_name: string;
  action_url: string;
  login_url: string;
  username: string;
  sender_name: string;
  support_url: string;
  support_email: string;
  verification_url: string;
};

type ReceiptLineV2 = {
  name: string;
  qty: number;
  unit_amount?: string; // e.g. "$25.00"
  ship_mode?: ShippingMode;
  ship_per_unit?: string; // e.g. "$5.00"
  ship_subtotal?: string; // e.g. "$10.00"
  line_total?: string; // e.g. "$50.00"
  // Convenience booleans for Mustachio
  is_free?: boolean;
  is_flat?: boolean;
  is_calculated?: boolean;
};

type AmountsModel = {
  items_subtotal: string;
  shipping_total: string;
  discount_total?: string; // omit/empty when $0
  tax_total?: string; // omit/empty when $0
  gross_total: string;
};

type FeesModel = {
  platform_fee?: string; // seller email only
  stripe_fee?: string; // seller email only
  net_payout?: string; // seller email only
};

export type TrackingEmailVariant = 'shipped' | 'tracking-updated';

export const sendWelcomeEmailTemplate = async ({
  to,
  name,
  action_url,
  login_url,
  username,
  sender_name,
  support_url,
  support_email,
  verification_url
}: SendWelcomeOptions) => {
  try {
    await postmark.sendEmailWithTemplate({
      From: process.env.POSTMARK_FROM_EMAIL!,
      To: to,
      TemplateId: Number(process.env.POSTMARK_WELCOME_TEMPLATEID!),
      TemplateModel: {
        name,
        product_name: 'Abandoned Hobby',
        action_url,
        login_url,
        username,
        sender_name,
        support_url,
        support_email,
        verification_url
      }
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

export const sendOrderConfirmationEmail = async (
  opts: SendOrderConfirmationOptions
) => {
  const {
    to,
    name,
    creditCardStatement,
    creditCardBrand,
    creditCardLast4,
    receiptId,
    orderDate,
    lineItems,
    total,
    item_summary,
    support_url,
    receipt_details_v2,
    amounts
  } = opts;

  const currency = 'USD';
  try {
    await postmark.sendEmailWithTemplate({
      From: process.env.POSTMARK_FROM_EMAIL!,
      To: to,
      TemplateId: Number(process.env.POSTMARK_ORDER_CONFIRMATION_TEMPLATEID!),
      TemplateModel: {
        name,
        credit_card_statement_name: creditCardStatement,
        credit_card_brand: creditCardBrand,
        credit_card_last_four: creditCardLast4,
        receipt_id: receiptId,
        date: orderDate,
        total,
        item_summary,
        product_name: 'Abandoned Hobby',
        support_url: support_url ?? process.env.SUPPORT_URL,
        receipt_details: lineItems,
        receipt_details_v2,
        amounts,
        has_receipt_details_v2:
          Array.isArray(receipt_details_v2) && receipt_details_v2.length > 0
      }
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const sendSaleNotificationEmail = async (
  opts: SendSaleNotificationOptions
) => {
  const {
    to,
    sellerName,
    receiptId,
    orderDate,
    lineItems,
    total,
    item_summary,
    shipping_name,
    shipping_address_line1,
    shipping_address_line2,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_country,
    support_url,
    receipt_details_v2,
    amounts,
    fees
  } = opts;

  const model = {
    sellerName,
    name: sellerName,
    receipt_id: receiptId,
    date: orderDate,
    total,
    product_name: 'Abandoned Hobby',
    item_summary,
    support_url,
    shipping_name,
    shipping_address_line1,
    shipping_address_line2,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_country,
    receipt_details: lineItems,
    receipt_details_v2,
    amounts,
    fees
  };

  try {
    await postmark.sendEmailWithTemplate({
      From: process.env.POSTMARK_FROM_EMAIL!,
      To: to,
      TemplateId: Number(process.env.POSTMARK_SALE_CONFIRMATION_TEMPLATEID!),
      TemplateModel: model
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const sendSupportEmail = async ({
  role,
  topic,
  reference,
  email,
  description
}: SendSupportOptions) => {
  const model = {
    role,
    topic,
    reference,
    email,
    description
  };

  try {
    await postmark.sendEmailWithTemplate({
      From: email,
      To: process.env.POSTMARK_SUPPORT_EMAIL!,
      TemplateId: Number(process.env.POSTMARK_SALE_CONFIRMATION_TEMPLATEID!),
      TemplateModel: model
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Formats an item's monetary total for display using the given currency.
 *
 * Prefers `item.amountTotal` (cents) if present; otherwise computes `quantity * unitAmount` (both in cents). Returns an empty string when neither value is available.
 *
 * @param item - The item with `quantity`, `unitAmount` (per-unit amount in cents) and/or `amountTotal` (total amount in cents)
 * @param currency - ISO currency code used by the formatter
 * @returns A localized currency string (for example, "$1.23"), or an empty string when no monetary value is available
 */
function buildLineAmount(
  item: {
    quantity: number;
    unitAmount: number | null;
    amountTotal: number | null;
  },
  currency: string
): string {
  // Prefer amountTotal if present, else quantity * unitAmount, else empty
  if (typeof item.amountTotal === 'number')
    return formatCents(item.amountTotal, currency);
  if (typeof item.unitAmount === 'number') {
    const totalCents = Math.round(item.unitAmount * (item.quantity || 1));
    return formatCents(totalCents, currency);
  }
  return '';
}

/**
 * Concatenates given parts, ignoring null, undefined, or whitespace-only entries, and returns a single space-separated trimmed string.
 *
 * @param parts - Values to join; null, undefined, or strings containing only whitespace are omitted.
 * @returns The joined string with single spaces between parts, or an empty string if no valid parts were provided.
 */
function joinParts(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((p) => typeof p === 'string' && p.trim().length > 0)
    .join(' ')
    .trim();
}

/**
 * Render a shipping address block as HTML or plain text for inclusion in an email template.
 *
 * The returned block contains only provided, trimmed address lines in the usual order:
 * name, line1, line2, "city, state postalCode", country. Empty or missing fields are omitted.
 *
 * @param input - Address fields; each field may be undefined or null and will be trimmed before use.
 * @param mode - Output format: `'html'` joins lines with `<br/>`, `'text'` joins with newlines.
 * @returns The formatted address block, or `undefined` if no address fields were provided.
 */
function buildShippingBlock(
  input: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  },
  mode: 'html' | 'text'
): string | undefined {
  const lines: string[] = [];

  const name = input.name?.trim();
  const line1 = input.line1?.trim();
  const line2 = input.line2?.trim();
  const city = input.city?.trim();
  const state = input.state?.trim();
  const postal = input.postalCode?.trim();
  const country = input.country?.trim();

  if (name) lines.push(name);
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);

  const cityStateZip = joinParts(city ? `${city},` : '', state, postal).replace(
    /\s+,/g,
    ','
  ); // tidy " ,"
  if (cityStateZip.length > 0) lines.push(cityStateZip);
  if (country) lines.push(country);

  if (lines.length === 0) return undefined;

  if (mode === 'html') {
    return lines.join('<br/>');
  }
  return lines.join('\n');
}

/**
 * Send a shipment or tracking-update email for an order via Postmark.
 *
 * @param input - Object containing: recipient `to`, `variant` ('shipped' | 'tracking-updated'), `order` (id, orderNumber, name), `shipment` (carrier, trackingNumber, optional trackingUrl/shippedAt/previousCarrierName/previousTrackingNumber), `items` (name, quantity, unitAmount, amountTotal), optional `shippingAddress`, optional `messageKey` for idempotency, optional `currency` (defaults to "USD"), and `dryRun`/`debug` flags.
 * @returns An object with `provider: 'postmark'` and `providerMessageId` containing the Postmark MessageID string, or `null` when the call was a dry-run.
 * @throws Error when sending the email via Postmark fails.
 */
export async function sendTrackingEmail(input: {
  to: string;
  variant: TrackingEmailVariant; // 'shipped' | 'tracking-updated'
  order: { id: string; orderNumber: string; name: string };
  shipment: {
    carrier: 'usps' | 'ups' | 'fedex' | 'other';
    trackingNumber: string;
    trackingUrl?: string;
    shippedAt?: string;
    /** Optional: populate when variant === 'tracking-updated' */
    previousCarrierName?: 'USPS' | 'UPS' | 'FedEx' | 'Other';
    previousTrackingNumber?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitAmount: number | null; // cents
    amountTotal: number | null; // cents
  }>;
  shippingAddress?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  messageKey?: string; // idempotency header
  currency?: string; // default USD
  dryRun?: boolean; // do not send, only log
  debug?: boolean; // log model even when sending
}): Promise<{
  provider: 'postmark';
  providerMessageId?: string | null;
}> {
  const currency = (input.currency || 'USD').toUpperCase();

  const templateId =
    input.variant === 'shipped'
      ? Number(process.env.POSTMARK_TRACKING_SHIPPED_TEMPLATEID!)
      : Number(process.env.POSTMARK_TRACKING_UPDATED_TEMPLATEID!);

  const recipientName =
    input.shippingAddress?.name?.trim() || input.order.name?.trim() || 'there';

  const details = (input.items ?? []).map((item) => ({
    description: `${item.name} × ${item.quantity}`,
    amount: buildLineAmount(
      {
        quantity: item.quantity || 1,
        unitAmount: item.unitAmount,
        amountTotal: item.amountTotal
      },
      currency
    )
  }));

  const receiptDetails =
    details.length > 0
      ? details
      : [{ description: `Order ${input.order.orderNumber}`, amount: '' }];

  const itemSummary =
    (input.items?.length ?? 0) === 1
      ? `${input.items[0]?.name ?? 'Item'} × ${input.items[0]?.quantity ?? 1}`
      : `${input.items?.length ?? 0} items`;

  const shipping_block_html = input.shippingAddress
    ? buildShippingBlock(input.shippingAddress, 'html')
    : undefined;
  const shipping_block_text = input.shippingAddress
    ? buildShippingBlock(input.shippingAddress, 'text')
    : undefined;

  // Optional previous fields are only meaningful for tracking-updated,
  // but it's fine to always include them; Mustachio will ignore empties.
  const templateModel = {
    name: recipientName,
    product_name: 'Abandoned Hobby',
    order_number: input.order.orderNumber,
    shipped_date: input.shipment.shippedAt || '',
    carrier_name: carrierLabels[input.shipment.carrier],
    tracking_number: input.shipment.trackingNumber,
    tracking_url: input.shipment.trackingUrl || '',
    // previous values (optional)
    previous_carrier_name: input.shipment.previousCarrierName,
    previous_tracking_number: input.shipment.previousTrackingNumber,
    previous_present: Boolean(input.shipment.previousTrackingNumber),
    // line items & shipping
    item_summary: itemSummary,
    receipt_details: receiptDetails,
    shipping_block_html,
    shipping_block_text,
    support_url: process.env.SUPPORT_URL
  };

  const messageStream = process.env.POSTMARK_MESSAGE_STREAM || 'outbound';
  const headers =
    input.messageKey && input.messageKey.length > 0
      ? [{ Name: 'X-Idempotency-Key', Value: input.messageKey }]
      : undefined;

  // Dry-run / debug logging
  const envDryRun = process.env.EMAIL_DRY_RUN === '1';
  const doDryRun = Boolean(input.dryRun || envDryRun);
  const doDebug = Boolean(input.debug || process.env.EMAIL_DEBUG === '1');

  if (doDebug || doDryRun) {
    const safeModel = {
      ...templateModel,
      tracking_number: templateModel.tracking_number
        ? `•••${String(templateModel.tracking_number).slice(-4)}`
        : templateModel.tracking_number
    };
    console.log(
      `[email:${input.variant}] dryRun=${doDryRun} to=${input.to}`,
      JSON.stringify(
        { templateId, messageStream, headers, templateModel: safeModel },
        null,
        2
      )
    );
  }

  if (doDryRun) {
    return { provider: 'postmark', providerMessageId: null };
  }

  try {
    const response = await postmark.sendEmailWithTemplate({
      From: process.env.POSTMARK_FROM_EMAIL!,
      To: input.to,
      TemplateId: templateId,
      TemplateModel: templateModel,
      MessageStream: messageStream,
      Headers: headers
    });

    return {
      provider: 'postmark',
      providerMessageId:
        (response as unknown as { MessageID?: string })?.MessageID ?? null
    };
  } catch (error) {
    console.error('Failed to send tracking email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export interface ReceiptItemOutput {
  name: string;
  qty: number;
  unit_amount?: string;
  line_total?: string;
  is_free: boolean;
  is_flat: boolean;
  is_calculated: boolean;
  ship_per_unit?: string;
  ship_subtotal?: string;
  ship_display: string;
}

export interface ReceiptItemInput {
  name: string;
  quantity: number;
  unitAmountCents: number;
  amountTotalCents: number;
  shippingMode: ShippingMode; // 'free' | 'flat' | 'calculated'
  shippingFeeCentsPerUnit: number | null;
  shippingSubtotalCents: number | null;
}

/**
 * Build per-line receipt details for the Postmark template.
 * Adds a precomputed `ship_display` string so the template can just print it.
 */
export function buildReceiptDetailsV2(
  items: ReadonlyArray<ReceiptItemInput>,
  currencyCode: string
): ReceiptItemOutput[] {
  return items.map((item) => {
    const isFree: boolean = item.shippingMode === 'free';
    const isFlat: boolean = item.shippingMode === 'flat';
    const isCalculated: boolean = item.shippingMode === 'calculated';

    const unitAmountStr: string | undefined =
      Number.isFinite(item.unitAmountCents) && item.unitAmountCents > 0
        ? formatCents(item.unitAmountCents, currencyCode)
        : undefined;

    const lineTotalStr: string | undefined =
      Number.isFinite(item.amountTotalCents) && item.amountTotalCents > 0
        ? formatCents(item.amountTotalCents, currencyCode)
        : undefined;

    const shipPerUnitStr: string | undefined =
      item.shippingFeeCentsPerUnit != null && item.shippingFeeCentsPerUnit >= 0
        ? formatCents(item.shippingFeeCentsPerUnit, currencyCode)
        : undefined;

    const shipSubtotalStr: string | undefined =
      item.shippingSubtotalCents != null && item.shippingSubtotalCents >= 0
        ? formatCents(item.shippingSubtotalCents, currencyCode)
        : undefined;

    const shipDisplay: string = computeShipDisplay({
      isFree,
      isFlat,
      isCalculated,
      quantity: item.quantity,
      shipPerUnitStr,
      shipSubtotalStr
    });

    const output: ReceiptItemOutput = {
      name: item.name,
      qty: item.quantity,
      is_free: isFree,
      is_flat: isFlat,
      is_calculated: isCalculated,
      ship_display: shipDisplay
    };

    if (unitAmountStr) output.unit_amount = unitAmountStr;
    if (lineTotalStr) output.line_total = lineTotalStr;
    if (shipPerUnitStr) output.ship_per_unit = shipPerUnitStr;
    if (shipSubtotalStr) output.ship_subtotal = shipSubtotalStr;

    return output;
  });
}

function computeShipDisplay(args: {
  isFree: boolean;
  isFlat: boolean;
  isCalculated: boolean;
  quantity: number;
  shipPerUnitStr?: string;
  shipSubtotalStr?: string;
}): string {
  const {
    isFree,
    isFlat,
    isCalculated,
    quantity,
    shipPerUnitStr,
    shipSubtotalStr
  } = args;

  if (isFree) return 'Free';

  if (isFlat) {
    if (
      shipSubtotalStr &&
      shipPerUnitStr &&
      Number.isFinite(quantity) &&
      quantity > 1
    ) {
      return `${shipSubtotalStr} (${quantity} × ${shipPerUnitStr})`;
    }
    if (shipSubtotalStr) return shipSubtotalStr;
    if (shipPerUnitStr && Number.isFinite(quantity) && quantity > 0) {
      return `${quantity} × ${shipPerUnitStr}`;
    }
    return '—';
  }

  if (isCalculated) {
    // If you truly do not want this path yet, return '—' instead:
    // return '—';
    return 'Calculated at checkout';
  }

  // Fallback for future modes or missing flags: prefer subtotal, then per-unit
  if (
    shipSubtotalStr &&
    shipPerUnitStr &&
    Number.isFinite(quantity) &&
    quantity > 1
  ) {
    return `${shipSubtotalStr} (${quantity} × ${shipPerUnitStr})`;
  }
  if (shipSubtotalStr) return shipSubtotalStr;
  if (shipPerUnitStr && Number.isFinite(quantity) && quantity > 0) {
    return `${quantity} × ${shipPerUnitStr}`;
  }

  return '—';
}
