import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { sendCustomEmail, getSmtpStatus, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME, SMTP_EMAIL } from '$lib/server/mailer';
import { ObjectId } from 'mongodb';

async function checkAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;
  const { data: user } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', decoded.id).single();
  return user?.has_admin_privileges === true;
}

const COLLECTION = 'admin_emails';

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await getDb();
    const folder = url.searchParams.get('folder') || 'all'; // 'inbox' | 'sent' | 'all'
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (folder === 'inbox') {
      query.direction = 'inbox';
    } else if (folder === 'sent') {
      query.direction = 'sent';
    }

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { to: { $regex: search, $options: 'i' } },
        { from: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } }
      ];
    }

    const [emailsRaw, total, unreadCount] = await Promise.all([
      db.collection(COLLECTION).find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection(COLLECTION).countDocuments(query),
      db.collection(COLLECTION).countDocuments({ direction: 'inbox', read: { $ne: true } })
    ]);

    const emails = emailsRaw.map((e) => ({
      ...e,
      id: e._id.toString(),
      _id: undefined
    }));

    return json({
      emails,
      total,
      page,
      limit,
      unreadCount,
      smtp: getSmtpStatus()
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as any;
    const { to, subject, text, html, from, replyTo, cc, bcc, formId, responseId, responseSource } = body;

    if (!to || !to.trim()) {
      return json({ error: 'Recipient email address (To) is required' }, { status: 400 });
    }
    if (!subject || !subject.trim()) {
      return json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!text && !html) {
      return json({ error: 'Email body message is required' }, { status: 400 });
    }

    const sender = from?.trim() || `"${DEFAULT_FROM_NAME}" <${DEFAULT_FROM_EMAIL}>`;
    const reply = replyTo?.trim() || (sender.includes('<') ? sender.replace(/.*<([^>]+)>.*/, '$1') : sender) || DEFAULT_FROM_EMAIL;

    // Send using nodemailer
    const sendResult = await sendCustomEmail({
      to: to.trim(),
      subject: subject.trim(),
      text,
      html,
      from: sender,
      replyTo: reply,
      cc,
      bcc
    });

    if (!sendResult.success) {
      return json({ error: sendResult.error || 'Failed to dispatch email' }, { status: 502 });
    }

    // Record email into MongoDB
    const db = await getDb();
    const finalSender = sendResult.from || sender;
    const emailRecord = {
      direction: 'sent',
      from: finalSender,
      to: to.trim(),
      replyTo: reply,
      cc: cc || null,
      bcc: bcc || null,
      subject: subject.trim(),
      text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
      html: html || undefined,
      messageId: sendResult.messageId || null,
      status: 'sent',
      read: true,
      formId: formId || null,
      responseId: responseId || null,
      responseSource: responseSource || null,
      createdAt: new Date().toISOString()
    };

    const insertResult = await db.collection(COLLECTION).insertOne(emailRecord);

    // If an answer/response id was provided, optionally flag it as 'Needs reply' -> 'Replied' or update review status
    if (responseId && responseSource) {
      try {
        const map: Record<string, string> = { responses: 'interviewer_responses', submissions: 'form_submissions', bugs: 'bug_reports' };
        const coll = map[responseSource] || 'interviewer_responses';
        await db.collection(coll).updateOne(
          { _id: new ObjectId(responseId) },
          { $set: { lastEmailSentAt: new Date().toISOString(), lastEmailSubject: subject.trim() } }
        );
      } catch {}
    }

    return json({
      success: true,
      id: insertResult.insertedId.toString(),
      messageId: sendResult.messageId,
      sender
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as any;
    const db = await getDb();

    if (body.id) {
      await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(body.id) },
        { $set: { read: body.read === true, updatedAt: new Date().toISOString() } }
      );
      return json({ success: true });
    }

    if (Array.isArray(body.ids)) {
      const objIds = body.ids.map((id: string) => {
        try { return new ObjectId(id); } catch { return null; }
      }).filter(Boolean);

      if (objIds.length) {
        await db.collection(COLLECTION).updateMany(
          { _id: { $in: objIds } },
          { $set: { read: body.read === true, updatedAt: new Date().toISOString() } }
        );
      }
      return json({ success: true, count: objIds.length });
    }

    return json({ error: 'id or ids required' }, { status: 400 });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await getDb();
    let body: any = null;
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        body = await request.json();
      }
    } catch {}

    if (body?.ids && Array.isArray(body.ids) && body.ids.length) {
      const objIds = body.ids.map((id: string) => {
        try { return new ObjectId(id); } catch { return null; }
      }).filter(Boolean);

      await db.collection(COLLECTION).deleteMany({ _id: { $in: objIds } });
      return json({ success: true, count: objIds.length });
    }

    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'ID is required' }, { status: 400 });

    await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
