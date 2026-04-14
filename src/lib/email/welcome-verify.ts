type BasicUser = { email: string; firstName?: string; username?: string };

type BuildParams = {
  token: string;
  user: BasicUser;
  appUrl?: string;
  loginUrl?: string;
  supportUrl?: string;
  supportEmail?: string;
  productName?: string;
  senderName?: string;
};

export function buildWelcomeVerifySubject(user: BasicUser) {
  const name = user.firstName || user.email;
  return `Welcome to Abandoned Hobby, ${name}! Please verify your email`;
}

/**
 * Builds the complete HTML email used to welcome a new user and prompt them to verify their email.
 *
 * @param token - Verification token appended to the verification URL included in the message.
 * @param user - Basic user info; `firstName` is used for greetings when available, otherwise `email` is used. `username` is shown in the login info when present.
 * @param appUrl - Base app URL (defaults to `process.env.NEXT_PUBLIC_APP_URL` or `'http://localhost:3000'`).
 * @param loginUrl - Sign-in page URL (defaults to `process.env.SIGNIN_URL` or `${appUrl}/sign-in`).
 * @param supportUrl - Help/docs URL (defaults to `process.env.SUPPORT_URL` or `${appUrl}/help`).
 * @param supportEmail - Support email address (defaults to `process.env.POSTMARK_SUPPORT_EMAIL` or `'support@abandonedhobby.com'`).
 * @param productName - Product name used in copy and title (defaults to `'Abandoned Hobby'`).
 * @param senderName - Sender name used in the sign-off (defaults to `'Jay'`).
 * @returns A string containing the full HTML document for the welcome/verify email, including a hidden preheader, a centered verification button, a 4-step onboarding checklist, login details, support links, and a plaintext fallback verification URL.
 */
export function buildWelcomeVerifyHTML({
  token,
  user,
  appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  loginUrl = process.env.SIGNIN_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in`,
  supportUrl = process.env.SUPPORT_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/help`,
  supportEmail = process.env.POSTMARK_SUPPORT_EMAIL ||
    'support@abandonedhobby.com',
  productName = 'Abandoned Hobby',
  senderName = 'Jay'
}: BuildParams) {
  const verifyUrl = `${appUrl}/api/verify?token=${token}`;
  const username = user.username || user.email;
  const displayName = user.firstName || user.email;

  const dashboardUrl = `${appUrl}/admin`;

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Welcome to ${productName}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin:0; padding:0; background:#f6f7fb; color:#111; }
      .container { max-width: 560px; margin: 0 auto; padding: 24px; }
      .card { background:#ffffff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.05); }
      .h1 { margin:0 0 12px; font-size:24px; }
      .muted { color:#6b7280; font-size:14px; line-height:1.6; }
      .btn { display:inline-block; padding:12px 18px; border-radius:10px; text-decoration:none; background:#111827; color:#ffffff; font-weight:600; }
      .spacer { height:16px; }
      .spacer-sm { height:8px; }
      .divider { border:none; border-top:1px solid #e5e7eb; margin:20px 0; }
      .attributes { width:100%; border-collapse:collapse; }
      .attributes td { padding:8px 0; }
      .steps { width:100%; border-collapse:collapse; }
      .steps td { padding:6px 0; vertical-align:top; }
      .step-num { width:28px; font-weight:700; font-size:15px; color:#111827; }
      .step-label { font-size:14px; line-height:1.5; }
      .step-note { font-size:12px; color:#6b7280; }
      .sub { color:#6b7280; font-size:12px; }
      .preheader { display:none; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; }
      a { color:#111827; }
    </style>
  </head>
  <body>
    <span class="preheader">Verify your email then follow 3 more steps to start selling on ${productName}.</span>
    <div class="container">
      <div class="card">
        <h1 class="h1">Welcome, ${displayName}!</h1>
        <p>Thanks for joining ${productName} -- a marketplace for buying and selling hobby-related items. Your first step is to verify your email:</p>

        <div class="spacer"></div>
        <p style="text-align:center;">
          <a href="${verifyUrl}" class="btn" target="_blank" rel="noopener noreferrer">Verify your email</a>
        </p>

        <hr class="divider">

        <p style="margin-bottom:12px;"><strong>How selling on ${productName} works</strong></p>
        <p class="muted" style="margin-bottom:12px;">Once you’ve verified your email, there are a few more steps before you can list items for sale:</p>

        <table class="steps">
          <tr>
            <td class="step-num">1.</td>
            <td class="step-label">
              <strong>Verify your email</strong> (this email)<br>
              <span class="step-note">Required before you can log in.</span>
            </td>
          </tr>
          <tr><td colspan="2" style="height:8px;"></td></tr>
          <tr>
            <td class="step-num">2.</td>
            <td class="step-label">
              <strong>Create your store</strong><br>
              <span class="step-note">Set up your seller profile -- this is shown to buyers on your listings.</span>
            </td>
          </tr>
          <tr><td colspan="2" style="height:8px;"></td></tr>
          <tr>
            <td class="step-num">3.</td>
            <td class="step-label">
              <strong>Connect Stripe</strong><br>
              <span class="step-note">We use Stripe to handle payments. You’ll need to complete their onboarding to receive payouts.</span>
            </td>
          </tr>
          <tr><td colspan="2" style="height:8px;"></td></tr>
          <tr>
            <td class="step-num">4.</td>
            <td class="step-label">
              <strong>List your first item</strong><br>
              <span class="step-note">Listings are managed through your seller dashboard at <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer">${dashboardUrl}</a> -- that’s where you add products, manage orders, and update your store.</span>
            </td>
          </tr>
        </table>

        <div class="spacer"></div>
        <p class="muted">After logging in, you’ll see a checklist that guides you through each of these steps. You can also find it anytime at <a href="${appUrl}/welcome" target="_blank" rel="noopener noreferrer">${appUrl}/welcome</a>.</p>

        <hr class="divider">

        <p class="muted">For reference, here’s your login info:</p>
        <table class="attributes">
          <tr><td><strong>Login Page:</strong> <a href="${loginUrl}" target="_blank" rel="noopener noreferrer">${loginUrl}</a></td></tr>
          <tr><td><strong>Username:</strong> ${username}</td></tr>
        </table>

        <div class="spacer"></div>
        <p>If you have any questions, feel free to <a href="mailto:${supportEmail}">email our customer success team</a>. (We’re lightning quick at replying.)</p>
        <p>Thanks,<br>${senderName} and the ${productName} Team</p>

        <div class="spacer"></div>
        <p class="sub">If you’re having trouble with the button above, copy and paste this URL into your web browser:</p>
        <p class="sub"><a href="${verifyUrl}" target="_blank" rel="noopener noreferrer">${verifyUrl}</a></p>
        <p class="sub">Help docs: <a href="${supportUrl}" target="_blank" rel="noopener noreferrer">${supportUrl}</a></p>
      </div>
    </div>
  </body>
</html>`;
}
