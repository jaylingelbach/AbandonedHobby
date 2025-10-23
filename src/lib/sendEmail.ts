import { Client } from 'postmark';
import { formatCents } from './utils';

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

export const sendOrderConfirmationEmail = async ({
  to,
  name,
  creditCardStatement,
  creditCardBrand,
  creditCardLast4,
  receiptId,
  orderDate,
  lineItems,
  total,
  item_summary
}: SendOrderConfirmationOptions) => {
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
        receipt_details: lineItems,
        support_url: process.env.SUPPORT_URL,
        product_name: 'Abandoned Hobby',
        item_summary
      }
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const sendSaleNotificationEmail = async ({
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
  support_url
}: SendSaleNotificationOptions) => {
  const model = {
    sellerName,
    name: sellerName,
    receipt_id: receiptId,
    date: orderDate,
    total,
    receipt_details: lineItems,
    item_summary,
    support_url,
    product_name: 'Abandoned Hobby',
    shipping_name,
    shipping_address_line1,
    shipping_address_line2,
    shipping_city,
    shipping_state,
    shipping_zip,
    shipping_country
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

/** Pretty labels for carriers */
const carrierLabels: Record<'usps' | 'ups' | 'fedex' | 'other', string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  other: 'Other'
};

/** Build a clean monetary line for an item. */
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

/** Join non-empty parts with a single space, then trim. */
function joinParts(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((p) => typeof p === 'string' && p.trim().length > 0)
    .join(' ')
    .trim();
}

/** Build a preformatted shipping block (HTML or Text). */
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
    console.log(
      `[email:${input.variant}] dryRun=${doDryRun} to=${input.to}`,
      JSON.stringify(
        { templateId, messageStream, headers, templateModel },
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
