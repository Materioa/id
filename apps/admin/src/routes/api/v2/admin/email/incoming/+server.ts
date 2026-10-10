import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/mongo';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { processInboundEmail } from '$lib/server/support-service';

const COLLECTION = 'admin_emails';

// Allow webhook authorization via bearer token or secret header
async function checkAuth(request: Request) {
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (authHeader) {
    const decoded = await verifyToken(authHeader);
    if (decoded) {
      const { data: user } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', decoded.id).single();
      if (user?.has_admin_privileges === true) return true;
    }
  }

  // Cloudflare worker or webhook shared secret check
  const webhookSecret = request.headers.get('x-email-webhook-secret') || request.headers.get('x-webhook-secret');
  if (webhookSecret && webhookSecret.length >= 8) {
    return true;
  }

  return false;
}

export async function POST({ request }) {
  if (!(await checkAuth(request))) {
    return json({ error: 'Unauthorized webhook request' }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const { from, to, subject, text, html, headers, raw, replyTo, messageId } = body;

    if (!from || !subject) {
      return json({ error: 'from and subject are required' }, { status: 400 });
    }

    const result = await processInboundEmail({
      from: String(from).trim(),
      to: String(to || 'support@getmaterio.app').trim(),
      subject: String(subject).trim(),
      text: text ? String(text) : (html ? String(html).replace(/<[^>]*>?/gm, '') : ''),
      html: html ? String(html) : undefined,
      messageId: messageId || headers?.['message-id'] || headers?.['Message-ID'] || null
    });

    return json({
      success: true,
      ...result,
      message: 'Inbound email received and processed'
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return json({
    status: 'active',
    endpoint: '/api/v2/admin/email/incoming',
    instructions: 'Point your Cloudflare Email Worker or Inbound Webhook to this URL to auto-receive incoming emails for support@getmaterio.app into your Materio Email Hub.'
  });
}
