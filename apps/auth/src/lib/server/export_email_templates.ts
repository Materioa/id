/**
 * Materio Data Export Email Templates
 * Matches the AuthCard Framed Card design with CID sticker and card_frame.
 */

function escapeHtml(str: string) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getExportStartedTemplate(email: string, displayName: string) {
  const name = displayName || email.split('@')[0];
  const cleanEmail = escapeHtml(email);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Export Started</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f2; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Artwork Framed Outer Container (styled frame, no image file attachment) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 440px; background-color: #ece9e2; border-radius: 28px; padding: 8px; border: 1px solid rgba(0, 0, 0, 0.08); box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.10);">
          <tr>
            <td>
              <!-- Inner Solid Surface -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 22px; border: 1px solid rgba(0, 0, 0, 0.06); text-align: left;">
                <tr>
                  <td style="padding: 36px 30px;">
                    <!-- Brand Sticker Logo -->
                    <div style="margin: 0 0 20px 0; text-align: left;">
                      <img src="cid:sticker" alt="Materio" width="140" style="display: block; width: 140px; max-width: 140px; height: auto; border: 0; outline: none;" />
                    </div>

                    <!-- Clean Serif Heading -->
                    <h1 style="margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: normal; color: #0e0f0c; letter-spacing: -0.02em; line-height: 1.25;">
                      Data Export In Progress
                    </h1>

                    <!-- Subtext -->
                    <p style="margin: 0 0 20px; font-size: 13px; color: #78716c; line-height: 1.5;">
                      Hi ${escapeHtml(name)}, we have started gathering your account data.
                    </p>

                    <!-- Notice box -->
                    <div style="background-color: #f7f7f2; border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 14px; padding: 16px 20px; margin: 0 auto 20px; text-align: center;">
                      <p style="margin: 0; font-size: 12px; color: #44403c; line-height: 1.5;">
                        Your download link will be prepared and emailed to you within 24 hours.
                      </p>
                    </div>

                    <p style="margin: 0; font-size: 11px; color: #a8a29e; line-height: 1.6;">
                      If you did not request this, please secure your Materio account immediately.
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

function getExportReadyTemplate(email: string, displayName: string, downloadUrl: string) {
  const name = displayName || email.split('@')[0];
  const cleanEmail = escapeHtml(email);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Export Ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f2; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Artwork Framed Outer Container (styled frame, no image file attachment) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 440px; background-color: #ece9e2; border-radius: 28px; padding: 8px; border: 1px solid rgba(0, 0, 0, 0.08); box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.10);">
          <tr>
            <td>
              <!-- Inner Solid Surface -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 22px; border: 1px solid rgba(0, 0, 0, 0.06); text-align: left;">
                <tr>
                  <td style="padding: 36px 30px;">
                    <!-- Brand Sticker Logo -->
                    <div style="margin: 0 0 20px 0; text-align: left;">
                      <img src="cid:sticker" alt="Materio" width="140" style="display: block; width: 140px; max-width: 140px; height: auto; border: 0; outline: none;" />
                    </div>

                    <!-- Clean Serif Heading -->
                    <h1 style="margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: normal; color: #0e0f0c; letter-spacing: -0.02em; line-height: 1.25;">
                      Your Export is Ready
                    </h1>

                    <!-- Subtext -->
                    <p style="margin: 0 0 24px; font-size: 13px; color: #78716c; line-height: 1.5;">
                      Hi ${escapeHtml(name)}, your data package has been created and is ready to download.
                    </p>

                    <!-- Button -->
                    <div style="margin-bottom: 24px;">
                      <a href="${escapeHtml(downloadUrl)}" style="display: inline-block; background-color: #0e0f0c; color: #ffffff; font-size: 13px; font-weight: 500; text-decoration: none; padding: 12px 28px; border-radius: 9999px;">
                        Download Archive
                      </a>
                    </div>

                    <p style="margin: 0; font-size: 11px; color: #a8a29e; line-height: 1.6;">
                      This download link expires in 24 hours.<br />
                      If you did not request this download, please secure your Materio account.
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

export { getExportStartedTemplate, getExportReadyTemplate };
