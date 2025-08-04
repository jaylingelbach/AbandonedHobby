import 'dotenv/config';

(async () => {
  const { sendEmail } = await import('../src/lib/sendEmail.js'); // 👈 try .js or .ts depending on setup
  try {
    await sendEmail({
      to: 'jay@abandonedhobby.com',
      subject: 'Test from Postmark',
      html: '<p>This is a test email from Payload + Postmark.</p>'
    });
    console.log('✅ Email sent!');
  } catch (err) {
    console.error('❌ Failed to send email:', err);
  }
})();
