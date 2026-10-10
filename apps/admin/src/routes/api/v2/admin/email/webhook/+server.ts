import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { processInboundEmail } from '$lib/server/support-service';

const RESEND_API_KEY = env.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : '') || '';

/**
 * Handle incoming emails from Resend Inbound Webhook or external email forwards.
 * Resend sends `email.received` events to this endpoint.
 */
export async function POST({ request }) {
  try {
    const body: any = await request.json();
    console.log('[Email-Webhook] Inbound webhook received:', JSON.stringify(body).slice(0, 300));

    let from = '';
    let to = '';
    let subject = '';
    let text = '';
    let html = '';
    let messageId = '';

    // 1. Resend Inbound Webhook Event format
    if (body.type === 'email.received' || (body.data && (body.data.email_id || body.data.from))) {
      const data = body.data || body;
      from = Array.isArray(data.from) ? data.from.join(', ') : (data.from || '');
      to = Array.isArray(data.to) ? data.to.join(', ') : (data.to || 'support@getmaterio.app');
      subject = data.subject || 'Support Inquiry';
      text = data.text || '';
      html = data.html || '';
      messageId = data.email_id || data.id || '';

      // If text/html body is missing and email_id is provided, fetch full email via Resend API
      const emailId = data.email_id || data.id;
      if ((!text && !html) && emailId) {
        const apiKey = env.RESEND_API_KEY || RESEND_API_KEY;
        if (apiKey) {
          try {
            // Try Resend receiving email content endpoint first, fallback to standard emails endpoint
            let fetchRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
              headers: { Authorization: `Bearer ${apiKey}` }
            });
            if (!fetchRes.ok) {
              fetchRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
                headers: { Authorization: `Bearer ${apiKey}` }
              });
            }
            if (fetchRes.ok) {
              const fullEmail: any = await fetchRes.json();
              text = fullEmail.text || fullEmail.body || text;
              html = fullEmail.html || html;
              subject = fullEmail.subject || subject;
              from = fullEmail.from || from;
            }
          } catch (e: any) {
            console.warn('[Email-Webhook] Fetch full email from Resend failed:', e.message);
          }
        }
      }
    } else {
      // 2. Direct JSON payload format
      from = body.from || body.sender || '';
      to = body.to || body.recipient || 'support@getmaterio.app';
      subject = body.subject || 'Support Inquiry';
      text = body.text || body.body || '';
      html = body.html || '';
      messageId = body.messageId || body.id || '';
    }

    if (!from) {
      return json({ error: 'Sender "from" address is required' }, { status: 400 });
    }

    const result = await processInboundEmail({
      from,
      to,
      subject,
      text,
      html,
      messageId
    });

    return json({
      received: true,
      ...result
    });
  } catch (err: any) {
    console.error('[Email-Webhook] Error processing inbound email:', err);
    return json({ error: err.message }, { status: 500 });
  }
}
