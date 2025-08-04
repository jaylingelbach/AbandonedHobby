import { Client } from 'postmark';

const postmark = new Client(process.env.NEXT_PUBLIC_POSTMARK_SERVER_TOKEN!);

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export const sendEmail = async ({ to, subject, html }: SendEmailOptions) => {
  await postmark.sendEmail({
    From: 'jay@abandonedhobby.com',
    To: to,
    Subject: subject,
    HtmlBody: html,
    MessageStream: 'outbound' // default stream for transactional
  });
};
