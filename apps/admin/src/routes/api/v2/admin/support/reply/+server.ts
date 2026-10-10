import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { sendThreadReply } from '$lib/server/support-service';

async function checkAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;
  const { data: user } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', decoded.id).single();
  return user?.has_admin_privileges === true;
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: any = await request.json();
    const { caseNumber, responseId, to, subject, text, status, forwardToJinansh, forwardTo } = body;

    if (!to || !to.trim()) {
      return json({ error: 'Recipient email is required' }, { status: 400 });
    }
    if (!text || !text.trim()) {
      return json({ error: 'Message body is required' }, { status: 400 });
    }

    const resolvedForwardTo = (forwardTo && typeof forwardTo === 'string' && forwardTo.trim())
      ? forwardTo.trim()
      : (forwardToJinansh === true ? 'jinansh@getmaterio.app' : undefined);

    const result = await sendThreadReply({
      caseNumber: caseNumber || '',
      responseId,
      to,
      subject: subject || `[${caseNumber}] Materio Support Update`,
      text,
      status: status || 'in_progress',
      forwardTo: resolvedForwardTo,
      forwardToJinansh: resolvedForwardTo === 'jinansh@getmaterio.app'
    });

    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
