import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { processBugReportAutoTicket, autoTriageAllPendingBugReports } from '$lib/server/support-service';

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
    const body: any = await request.json().catch(() => ({}));
    const { bugId, force } = body;

    if (bugId) {
      const res = await processBugReportAutoTicket(bugId, force === true);
      return json(res);
    } else {
      const res = await autoTriageAllPendingBugReports();
      return json(res);
    }
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
