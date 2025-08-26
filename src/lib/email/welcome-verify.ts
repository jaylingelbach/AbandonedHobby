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
      .attributes { width:100%; border-collapse:collapse; }
      .attributes td { padding:8px 0; }
      .sub { color:#6b7280; font-size:12px; }
      .preheader { display:none; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; }
      a { color:#111827; }
    </style>
  </head>
  <body>
    <span class="preheader">Verify your email to finish setting up ${productName}.</span>
    <div class="container">
      <div class="card">
        <h1 class="h1">Welcome, ${displayName}!</h1>
        <p>Thanks for signing up for ${productName}. We’re thrilled to have you on board. To get the most out of ${productName}, do this primary next step:</p>

        <div class="spacer"></div>
        <p style="text-align:center;">
          <a href="${verifyUrl}" class="btn" target="_blank" rel="noopener noreferrer">Verify your email</a>
        </p>

        <div class="spacer"></div>
        <p class="muted">For reference, here's your login info:</p>
        <table class="attributes">
          <tr><td><strong>Login Page:</strong> <a href="${loginUrl}" target="_blank" rel="noopener noreferrer">${loginUrl}</a></td></tr>
          <tr><td><strong>Username:</strong> ${username}</td></tr>
        </table>

        <div class="spacer"></div>
        <p>If you have any questions, feel free to <a href="mailto:${supportEmail}">email our customer success team</a>. (We're lightning quick at replying.)</p>
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
