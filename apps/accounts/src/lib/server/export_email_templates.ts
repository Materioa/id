/**
 * Materio Data Export Email Templates
 * Uses the same CID sticker logo format as the OTP template.
 */

function getExportStartedTemplate(email: string, displayName: string) {
  const name = displayName || email.split('@')[0];
  const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 20px; background: #ffffff; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div style="max-width:500px;margin:24px auto;">
    <!-- Logo/Sticker -->
    <div style="margin-bottom:24px; text-align: center;">
      <img src="cid:sticker" alt="materio." width="140" style="display:block; margin: 0 auto;" />
    </div>
    
    <!-- Outer card container -->
    <div style="background:#fff;border-radius:24px;overflow:hidden;border:1px solid #f1f5f9;padding:32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.4;color:#0f172a; text-align: center;">Your Data Export Has Started</h2>
      <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 24px;">Hi ${escapeHtml(name)}, we've begun preparing your data export.</p>
      
      <div style="text-align: center; margin-bottom: 24px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; text-align: center;">
        We're gathering all your personal details, activity, and saved content.
      </p>

      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">
        <strong>Estimated time:</strong> Your download link will be emailed to you within 24 hours. We'll send another email when it's ready.
      </p>
      
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-bottom: 0;">Request made on ${timestamp}<br>If you didn't request this, please secure your Materio ID immediately.</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#cbd5e1; margin-top: 24px;">
      Sent to ${escapeHtml(email)} • Materio ID Services
    </div>
  </div>
</body>
</html>
`;
}

function getExportReadyTemplate(email: string, displayName: string, downloadUrl: string) {
  const name = displayName || email.split('@')[0];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 20px; background: #ffffff; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div style="max-width:500px;margin:24px auto;">
    <!-- Logo/Sticker -->
    <div style="margin-bottom:24px; text-align: center;">
      <img src="cid:sticker" alt="materio." width="140" style="display:block; margin: 0 auto;" />
    </div>
    
    <!-- Outer card container -->
    <div style="background:#fff;border-radius:24px;overflow:hidden;border:1px solid #f1f5f9;padding:32px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;line-height:1.4;color:#0f172a; text-align: center;">Your Data Export is Ready</h2>
      <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 24px;">Hi ${escapeHtml(name)}, your data has been packaged and is ready to download.</p>
      
      <div style="text-align: center; margin-bottom: 24px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.7; margin: 0 0 32px 0; text-align: center;">
        Your data has been collected and is ready to download.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${escapeHtml(downloadUrl)}" style="display:inline-block; background: #0f172a; color: #fff; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
          Download Your Data
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
        <strong>Link expires in 24 hours.</strong> Please download your data before the link expires. After that, you'll need to request a new export.
      </p>
      
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-bottom: 0;">Your exported data is encrypted in transit.<br>If you didn't request this, please secure your Materio ID immediately.</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#cbd5e1; margin-top: 24px;">
      Sent to ${escapeHtml(email)} • Materio ID Services
    </div>
  </div>
</body>
</html>
`;
}

function escapeHtml(str: string) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { getExportStartedTemplate, getExportReadyTemplate };
