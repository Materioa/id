import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { draftThreadReply } from '$lib/server/ai-support';

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
    const { thread, caseNumber, reporterName, reporterEmail, email, instruction, provider } = body;

    const result = await draftThreadReply({
      thread: thread || [],
      caseNumber: caseNumber || 'CASE-SUPPORT',
      reporterName,
      reporterEmail: reporterEmail || email,
      instruction,
      preferredProvider: provider || 'auto'
    });

    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
