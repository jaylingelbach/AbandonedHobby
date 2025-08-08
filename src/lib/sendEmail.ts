import { Client } from 'postmark';

const postmark = new Client(process.env.POSTMARK_SERVER_TOKEN!);

type LineItem = {
  description: string;
  amount: string;
};

type SendSaleNotificationOptions = {
  to: string;
  name: string;
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

type sendWelcomeOptions = {
  to: string;
  name: string;
  product_name: string;
  action_url: string;
  login_url: string;
  username: string;
  sender_name: string;
  support_url: string;
};

export const sendWelcomeEmailTemplate = async ({
  to,
  name,
  action_url,
  login_url,
  username,
  sender_name,
  support_url
}: sendWelcomeOptions) => {
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
        support_url
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
  name,
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
  shipping_country
}: SendSaleNotificationOptions) => {
  try {
    await postmark.sendEmailWithTemplate({
      From: process.env.POSTMARK_FROM_EMAIL!,
      To: to,
      TemplateId: Number(process.env.POSTMARK_SALE_CONFIRMATION_TEMPLATEID!),
      TemplateModel: {
        name,
        receipt_id: receiptId,
        date: orderDate,
        total,
        receipt_details: lineItems,
        item_summary,
        support_url: process.env.SUPPORT_URL,
        product_name: 'Abandoned Hobby',
        shipping_name,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_zip,
        shipping_country
      }
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
