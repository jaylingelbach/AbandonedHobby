import { Client } from 'postmark';

const postmark = new Client(process.env.POSTMARK_SERVER_TOKEN!);

type SendEmailOptions = {
  to: string;
  name: string;
  creditCardStatement: string;
  creditCardBrand: string;
  creditCardLast4: string;
  receiptId: string;
  orderDate: string;
  lineItems: { description: string; amount: string }[];
  total: string;
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
  total
}: SendEmailOptions) => {
  try {
    await postmark.sendEmailWithTemplate({
      From: 'jay@abandonedhobby.com',
      To: to,
      TemplateId: 4097571,
      TemplateModel: {
        name,
        credit_card_statement_name: creditCardStatement,
        credit_card_brand: creditCardBrand,
        credit_card_last_four: creditCardLast4,
        receipt_id: receiptId,
        date: orderDate,
        total,
        receipt_details: lineItems,
        support_url: 'https://abandonedhobby.com/support',
        product_name: 'Abandoned Hobby'
      }
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error(
      `Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
