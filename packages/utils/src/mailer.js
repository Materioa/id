/**
 * Materio Mailer Utility (Shared)
 * Supports Resend API (HTTP fetch) with automatic SMTP fallback (nodemailer).
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DEFAULT_FROM_EMAIL = process.env.SMTP_FROM || 'support@getmaterio.app';
const DEFAULT_FROM_NAME = process.env.SMTP_FROM_NAME || 'Materio';

const SMTP_EMAIL = process.env.SMTP_EMAIL || process.env.SENDER_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || process.env.SENDER_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_PASS || '';
const ALERT_EMAIL = process.env.ALERT_EMAIL || SMTP_EMAIL || 'support@getmaterio.app';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);

// Reusable transporter (created lazily)
let _transporter = null;

function getTransporter() {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    return null;
  }
  if (!_transporter) {
    try {
      const nodemailer = require('nodemailer');
      _transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_EMAIL,
          pass: SMTP_PASSWORD,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    } catch (e) {
      console.warn('[Mailer] nodemailer not available for SMTP fallback');
      return null;
    }
  }
  return _transporter;
}

/**
 * Send an email via Resend HTTP REST API
 */
async function sendViaResend({
  from,
  to,
  replyTo,
  subject,
  html,
  text,
  attachments = []
}) {
  const apiKey = process.env.RESEND_API_KEY || RESEND_API_KEY;
  if (!apiKey) return null;

  const toList = Array.isArray(to) ? to : [to];
  const payload = {
    from: from || `"${DEFAULT_FROM_NAME}" <${DEFAULT_FROM_EMAIL}>`,
    to: toList,
    subject,
  };
  if (replyTo) payload.reply_to = replyTo;
  if (html) payload.html = html;
  if (text) payload.text = text;

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map((a) => {
      let content = a.content;
      if (!content && a.path && fs.existsSync(a.path)) {
        content = fs.readFileSync(a.path).toString('base64');
      }
      const cid = a.cid || a.content_id || a.contentId;
      const att = {
        filename: a.filename || 'attachment',
        content
      };
      if (cid) {
        att.content_id = cid;
        att.contentId = cid;
        att.content_disposition = 'inline';
      }
      return att;
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Resend error ${res.status}`);
  }
  return { success: true, messageId: data.id };
}

// --- Status/Severity mapping ---
const SEVERITY_COLORS = {
  critical: '#DC2626',
  major: '#EA580C',
  minor: '#CA8A04',
  cosmetic: '#6B7280',
};

const SEVERITY_EMOJI = {
  critical: '🔴',
  major: '🟠',
  minor: '🟡',
  cosmetic: '⚪',
};

async function sendIncidentEmail(incidentData) {
  const { name, summary, severity, affectedAreas, reportCount, aiGenerated } = incidentData;
  const color = SEVERITY_COLORS[severity] || '#6B7280';
  const emoji = SEVERITY_EMOJI[severity] || '⚪';
  const timestamp = new Date().toISOString();
  const subject = `${emoji} [Materio Incident] ${name}`;

  const text = [
    `${emoji} AUTO-INCIDENT CREATED`,
    `Incident: ${name}`,
    `Severity: ${severity.toUpperCase()}`,
    `Affected Areas: ${affectedAreas.join(', ')}`,
    `Reports: ${reportCount} clustered reports`,
    `Time: ${timestamp}`,
    aiGenerated ? `Summary: AI-generated` : `Summary: Deterministic fallback`,
    ``,
    `--- SUMMARY ---`,
    summary,
  ].join('\n');

  const SEVERITY_HEADER_BG = {
    critical: 'rgba(220, 38, 38, 0.15)',
    major: 'rgba(234, 88, 12, 0.15)',
    minor: 'rgba(202, 138, 4, 0.15)',
    cosmetic: 'rgba(107, 114, 128, 0.15)',
  };

  const headerBg = SEVERITY_HEADER_BG[severity] || 'rgba(107, 114, 128, 0.15)';
  const formattedDate = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) + ' IST';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { margin: 0; padding: 20px; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }</style></head>
<body>
  <div style="max-width:600px;margin:24px auto;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:24px;">
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:${headerBg};padding:16px 20px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.4;color:#1f2937;">${escapeHtml(name.replace(/\[Auto\] /, ''))}</h2>
          <div style="font-size:13px;"><span style="color:${color};font-weight:600;">Incident created</span><span style="color:#6b7280;margin-left:12px;">Started ${formattedDate}</span></div>
        </div>
        <div style="padding:16px 20px;font-size:14px;line-height:1.8;color:#1f2937;background:#fff;">
          <div><strong>Severity</strong> : <span style="color:${color};font-weight:600;">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span></div>
          <div><strong>Affected Areas:</strong> ${escapeHtml(affectedAreas.join(', '))}</div>
          <div><strong>Reports:</strong> ${reportCount} clustered reports</div>
        </div>
      </div>
      <div style="background:#fafafa;padding:16px 20px;margin-bottom:24px;border-radius:12px;border:1px solid #e5e7eb;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1f2937;">Summary</h3>
        <div style="font-size:13px;line-height:1.7;color:#4b5563;">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
      </div>
      <div style="text-align:center;font-size:12px;color:#9ca3af;">This incident is auto generated by Materio's incident reporting system.</div>
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await sendViaResend({
      from: `"Materio Health Monitor" <${DEFAULT_FROM_EMAIL}>`,
      to: ALERT_EMAIL,
      subject,
      text,
      html
    });
    if (res) return res;
  } catch (err) {
    console.error('[Mailer] Resend incident email failed, trying SMTP:', err.message);
  }

  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'Email service not configured' };

  try {
    const info = await transporter.sendMail({
      from: `"Materio Health Monitor" <${SMTP_EMAIL || DEFAULT_FROM_EMAIL}>`,
      to: ALERT_EMAIL,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Incident email failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendAlertEmail({ to, subject, text, html, attachments = [] }) {
  try {
    const res = await sendViaResend({
      from: `"${DEFAULT_FROM_NAME}" <${DEFAULT_FROM_EMAIL}>`,
      to: to || ALERT_EMAIL,
      subject,
      text,
      html,
      attachments
    });
    if (res) return res;
  } catch (err) {
    console.error('[Mailer] Resend alert email failed, trying SMTP:', err.message);
  }

  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'Email service not configured' };

  try {
    const info = await transporter.sendMail({
      from: `"${DEFAULT_FROM_NAME}" <${SMTP_EMAIL || DEFAULT_FROM_EMAIL}>`,
      to: to || ALERT_EMAIL,
      subject,
      text,
      html: html || undefined,
      attachments,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] Alert email failed:', err.message);
    return { success: false, error: err.message };
  }
}

function getAssetPath(filename) {
  const candidates = [
    path.resolve(process.cwd(), 'packages', 'ui', 'src', 'assets', filename),
    path.resolve(process.cwd(), '..', 'packages', 'ui', 'src', 'assets', filename),
    path.resolve(process.cwd(), '..', '..', 'packages', 'ui', 'src', 'assets', filename),
    path.resolve(process.cwd(), 'static', filename),
    path.resolve(process.cwd(), '..', 'auth', 'static', filename),
    path.resolve(process.cwd(), '..', '..', 'apps', 'auth', 'static', filename),
    path.resolve(process.cwd(), 'assets', 'img', filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function sendOTPEmail({ to, otp, type, html }) {
  const subject = `${otp} is your One time code or OTP for Materio`;

  const stickerPath = getAssetPath('sticker.png');
  const framePath = getAssetPath('card_frame.jpg') || getAssetPath('card_frame.png') || getAssetPath('onboarding_frame.jpg');

  const attachments = [];
  if (stickerPath) {
    attachments.push({
      filename: 'sticker.png',
      path: stickerPath,
      cid: 'sticker',
      content_id: 'sticker',
      contentId: 'sticker',
      contentDisposition: 'inline'
    });
  }
  if (framePath) {
    const isJpg = framePath.endsWith('.jpg') || framePath.endsWith('.jpeg');
    attachments.push({
      filename: isJpg ? 'card_frame.jpg' : 'card_frame.png',
      path: framePath,
      cid: 'card_frame',
      content_id: 'card_frame',
      contentId: 'card_frame',
      contentDisposition: 'inline'
    });
  }

  const fromEmail = process.env.SMTP_FROM || DEFAULT_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || DEFAULT_FROM_NAME;

  try {
    const res = await sendViaResend({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      replyTo: fromEmail,
      subject,
      html,
      attachments
    });
    if (res) return { success: true, messageId: res.messageId, error: undefined };
  } catch (err) {
    console.error('[Mailer] Resend OTP email failed, attempting SMTP fallback:', err.message);
  }

  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'Email service not configured (Resend or SMTP required)' };

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      replyTo: fromEmail,
      subject,
      html,
      attachments
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] OTP email failed:', err.message);
    return { success: false, error: err.message };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  sendIncidentEmail,
  sendAlertEmail,
  sendOTPEmail,
  ALERT_EMAIL,
  DEFAULT_FROM_EMAIL,
  DEFAULT_FROM_NAME
};
