import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getTicketThread, processInboundEmail } from '$lib/server/support-service';
import { getDb } from '$lib/server/mongo';

async function checkAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;
  const { data: user } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', decoded.id).single();
  return user?.has_admin_privileges === true;
}

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const caseNumber = url.searchParams.get('caseNumber') || undefined;
    const responseId = url.searchParams.get('responseId') || undefined;
    const email = url.searchParams.get('email') || undefined;

    const threadData = await getTicketThread({
      caseNumber,
      responseId,
      email
    });

    return json(threadData);
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: any = await request.json();
    const { from, subject, text, caseNumber } = body;
    if (!from || !text) {
      return json({ error: 'from and text are required' }, { status: 400 });
    }

    const inboundSubj = subject || (caseNumber ? `[${caseNumber}] Re: Support Inquiry` : 'Support Inquiry');
    const result = await processInboundEmail({
      from,
      to: 'support@getmaterio.app',
      subject: inboundSubj,
      text
    });

    return json({ success: true, ...result });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: any = await request.json();
    const { caseNumber, responseId, status } = body;
    if (!status) return json({ error: 'status is required' }, { status: 400 });

    const db = await getDb();
    const { ObjectId } = await import('mongodb');

    const updateFilterOr: any[] = [];
    if (caseNumber) {
      updateFilterOr.push({ caseNumber: String(caseNumber).trim() });
    }
    if (responseId) {
      try {
        updateFilterOr.push({ _id: new ObjectId(responseId) });
      } catch {}
      updateFilterOr.push({ id: responseId });
    }

    if (updateFilterOr.length > 0) {
      const now = new Date().toISOString();
      await db.collection('bug_reports').updateOne(
        { $or: updateFilterOr },
        { $set: { status, reviewed: true, updatedAt: now } }
      );
    }

    return json({ success: true, status });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const caseNumber = url.searchParams.get('caseNumber') || undefined;
    const responseId = url.searchParams.get('responseId') || undefined;
    const deleteReport = url.searchParams.get('deleteReport') === 'true';

    const db = await getDb();
    const { ObjectId } = await import('mongodb');

    const filterOr: any[] = [];
    if (caseNumber) {
      filterOr.push({ caseNumber: String(caseNumber).trim() });
    }
    if (responseId) {
      try {
        filterOr.push({ _id: new ObjectId(responseId) });
      } catch {}
      filterOr.push({ id: responseId });
    }

    if (filterOr.length === 0) {
      return json({ error: 'caseNumber or responseId required' }, { status: 400 });
    }

    const filter = { $or: filterOr };

    if (deleteReport) {
      // Permanently remove report from bug_reports, form_submissions, interviewer_responses
      await db.collection('bug_reports').deleteMany(filter);
      await db.collection('form_submissions').deleteMany(filter);
      await db.collection('interviewer_responses').deleteMany(filter);
      if (caseNumber) {
        await db.collection('admin_emails').deleteMany({ caseNumber: String(caseNumber).trim() });
      }
      return json({ success: true, deleted: true });
    } else {
      // Discard case ID: dispose of caseNumber and remove ticketCreated marker
      const now = new Date().toISOString();
      await db.collection('bug_reports').updateMany(filter, {
        $unset: { caseNumber: '' },
        $set: { ticketCreated: false, updatedAt: now }
      });
      await db.collection('form_submissions').updateMany(filter, {
        $unset: { caseNumber: '' },
        $set: { updatedAt: now }
      });
      await db.collection('interviewer_responses').updateMany(filter, {
        $unset: { caseNumber: '' },
        $set: { updatedAt: now }
      });
      return json({ success: true, discarded: true });
    }
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
