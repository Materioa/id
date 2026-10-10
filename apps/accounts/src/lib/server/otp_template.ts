/**
 * Materio OTP Email Template
 * Clean, minimal design matching the Materio Auth Card aesthetic.
 * Embeds sticker.png as cid:sticker and framed artwork as cid:card_frame.
 */

function escapeHtml(str: string) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getOTPTemplate(otp: string, type: string, email: string) {
  let typeText = 'Verification code';
  let instruction = 'Use the verification code below to verify your account.';

  if (type === 'signup' || type === 'register') {
    typeText = 'Verify your email';
    instruction = 'Use this code to complete your signup on Materio.';
  } else if (type === 'login' || type === 'signin') {
    typeText = 'Sign in to Materio';
    instruction = 'Use this code to securely sign in to your Materio account.';
  } else if (type === 'recovery' || type === 'reset' || type === 'forgot-password') {
    typeText = 'Recover your account';
    instruction = 'Use this code to reset your account password.';
  }

  const cleanEmail = escapeHtml(email);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(otp)} is your One time code or OTP for Materio</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f2; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Artwork Framed Outer Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" background="cid:card_frame" style="max-width: 440px; background-color: #ece9e2; background-image: url('cid:card_frame'); background-size: cover; background-position: center; border-radius: 28px; padding: 8px; border: 1px solid rgba(0, 0, 0, 0.08); box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.12);">
          <tr>
            <td>
              <!-- Inner Solid Surface -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 22px; border: 1px solid rgba(0, 0, 0, 0.06); text-align: left;">
                <tr>
                  <td style="padding: 36px 30px;">
                    <!-- Brand Sticker Logo (scaled & aligned left) -->
                    <div style="margin: 0 0 20px 0; text-align: left;">
                      <img src="cid:sticker" alt="Materio" width="140" style="display: block; width: 140px; max-width: 140px; height: auto; border: 0; outline: none;" />
                    </div>

                    <!-- Garamond Heading -->
                    <h1 style="margin: 0 0 8px; font-family: Garamond, 'EB Garamond', Baskerville, Georgia, serif; font-size: 28px; font-weight: normal; color: #0e0f0c; letter-spacing: -0.02em; line-height: 1.25; text-align: left;">
                      ${escapeHtml(typeText)}
                    </h1>

                    <!-- Clean Subtext -->
                    <p style="margin: 0 0 24px; font-size: 14px; color: #78716c; line-height: 1.5; text-align: left;">
                      ${escapeHtml(instruction)}
                    </p>

                    <!-- Minimal OTP Digits Box (Centered numbers in clean box) -->
                    <div style="background-color: #f7f7f2; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 14px; padding: 18px 20px; margin: 0 0 24px 0; max-width: 280px; text-align: center;">
                      <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0e0f0c; display: inline-block;">
                        ${escapeHtml(otp)}
                      </span>
                    </div>

                    <!-- Expiration Notice -->
                    <p style="margin: 0; font-size: 11px; color: #a8a29e; line-height: 1.6; text-align: left;">
                      This code expires in 10 minutes.<br />
                      If you did not make this request, you can safely disregard this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Outside Minimal Footer -->
        <p style="margin: 20px 0 0; font-size: 11px; color: #a8a29e; text-align: center;">
          Sent to ${cleanEmail} • Materio ID
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { getOTPTemplate };
