import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { getInterviewerTemplates, getParentFormTemplates, getFormActivityDefaults, normaliseKind, INTERVIEWER_COLLECTIONS } from '@materio/config/interviewer';

async function checkAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;
  const { data: user } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', decoded.id).single();
  return user?.has_admin_privileges === true;
}

function sanitiseForm(body: any) {
  const kind = normaliseKind(body.kind);
  return {
    id: String(body.id || '').trim(),
    kind,
    title: String(body.title || '').trim(),
    description: String(body.description || ''),
    icon: String(body.icon || 'form'),
    context: String(body.context || 'general'),
    published: body.published === true,
    fields: Array.isArray(body.fields) ? body.fields : [],
    steps: Array.isArray(body.steps) ? body.steps : [],
    confirmations: Array.isArray(body.confirmations) ? body.confirmations : [],
    submitButton: body.submitButton && typeof body.submitButton === 'object' ? { text: String(body.submitButton.text || 'Submit'), icon: String(body.submitButton.icon || '') } : { text: 'Submit', icon: '' },
    fileUpload: body.fileUpload && typeof body.fileUpload === 'object' ? body.fileUpload : { enabled: false },
    requiresAuth: body.requiresAuth === true,
    legacy: body.legacy ? String(body.legacy) : null,
    interview: {
      openingQuestion: String(body?.interview?.openingQuestion || body?.wizard?.intro || ''),
      systemPrompt: String(body?.interview?.systemPrompt || ''),
      skipAllowed: body?.interview?.skipAllowed ?? body?.wizard?.skipAllowed ?? true,
      asyncSubmit: body?.interview?.asyncSubmit ?? true,
      completeMessage: String(body?.interview?.completeMessage || 'Thanks — your response has been recorded.')
    },
    triggers: {
      examTypes: Array.isArray(body?.triggers?.examTypes) ? body.triggers.examTypes : [],
      autoShow: body?.triggers?.autoShow === true
    },
    updatedAt: new Date().toISOString()
  };
}

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await getDb();
    // One-time cleanup of retired template ids (merged into crew-intake).
    await db.collection(INTERVIEWER_COLLECTIONS.configs).deleteMany({ id: { $in: ['practical-setup', 'volunteer-recruit', 'curator-intake', 'stewardship-pledge'] } }).catch(() => {});
    const formId = url.searchParams.get('formId');
    const [storedForms, sessionsRaw, responsesRaw, submissions, bugs, activityDocs] = await Promise.all([
      db.collection(INTERVIEWER_COLLECTIONS.configs).find(formId ? { id: formId } : {}).sort({ updatedAt: -1 }).toArray(),
      db.collection(INTERVIEWER_COLLECTIONS.sessions).find(formId ? { formId } : {}).sort({ updatedAt: -1 }).limit(100).toArray(),
      db.collection(INTERVIEWER_COLLECTIONS.responses).find(formId ? { formId } : {}).sort({ updatedAt: -1 }).limit(200).toArray(),
      db.collection('form_submissions').find(formId ? { formType: formId } : {}).sort({ submittedAt: -1 }).limit(200).toArray(),
      db.collection('bug_reports').find({}).sort({ reportedAt: -1 }).limit(200).toArray(),
      db.collection(INTERVIEWER_COLLECTIONS.activity).find({}).limit(1).toArray()
    ]);
    // Backfill Materio usernames for rows written before identity was stored.
    const profileById = new Map<string, any>();
    try {
      const ids = [...new Set([...responsesRaw, ...sessionsRaw].map((x: any) => x.userId).filter(Boolean))] as string[];
      if (ids.length) {
        const { data } = await supabaseAdmin.from('users').select('id, username, email').in('id', ids);
        for (const p of (data || []) as any[]) profileById.set(p.id, p);
      }
    } catch {}
    const withUser = (x: any) => ({ ...x, username: x.username || profileById.get(x.userId)?.username || null, userEmail: x.userEmail || profileById.get(x.userId)?.email || null });
    const sessions = sessionsRaw.map(withUser);
    const responses = responsesRaw.map(withUser);
    const forms = storedForms.map((form: any) => ({ ...form, kind: normaliseKind(form.kind), id: form.id || form._id?.toString() }));
    const activity = activityDocs[0] || getFormActivityDefaults();
    const oid = (d: any) => ({ ...d, id: d._id.toString(), _id: undefined });
    return json({
      forms,
      sessions: sessions.map((s: any) => ({ ...s, id: s.sessionId || s._id.toString() })),
      responses: responses.map(oid),
      submissions: (formId && formId !== 'bug-report' ? [] : submissions).map(oid),
      bugs: (formId && formId !== 'bug-report' ? [] : bugs).map(oid),
      activity: { ...activity, id: undefined, _id: undefined },
      templates: [...getParentFormTemplates(), ...getInterviewerTemplates()]
    });
  } catch (error: any) { return json({ error: error.message }, { status: 500 }); }
}

export async function POST({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = await getDb();
    if (url.searchParams.get('seed') === 'true') {
      const templates = [...getInterviewerTemplates(), ...getParentFormTemplates()];
      await Promise.all(templates.map((t) => db.collection(INTERVIEWER_COLLECTIONS.configs).updateOne({ id: t.id }, { $set: t }, { upsert: true })));
      await db.collection(INTERVIEWER_COLLECTIONS.configs).deleteMany({ id: { $in: ['practical-setup', 'volunteer-recruit', 'curator-intake', 'stewardship-pledge'] } });
      await db.collection(INTERVIEWER_COLLECTIONS.activity).updateOne({}, { $set: getFormActivityDefaults() }, { upsert: true });
      return json({ success: true, seeded: templates.length });
    }
    const body = await request.json() as any;
    if (body.scope === 'activity') {
      if (!Array.isArray(body.activities)) return json({ error: 'activities must be an array' }, { status: 400 });
      await db.collection(INTERVIEWER_COLLECTIONS.activity).updateOne({}, { $set: { enabled: body.enabled !== false, activities: body.activities, settings: body.settings || {}, updatedAt: new Date().toISOString() } }, { upsert: true });
      return json({ success: true });
    }
    const doc = sanitiseForm(body);
    if (!doc.id || !doc.title || !Array.isArray(doc.fields)) return json({ error: 'A form id, title, and fields are required' }, { status: 400 });
    await db.collection(INTERVIEWER_COLLECTIONS.configs).updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
    return json({ success: true, form: doc });
  } catch (error: any) { return json({ error: error.message }, { status: 500 }); }
}

export async function PATCH({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as any;
    const db = await getDb();
    if (body.review?.id) {
      const { ObjectId } = await import('mongodb');
      const map: Record<string, string> = { responses: INTERVIEWER_COLLECTIONS.responses, submissions: 'form_submissions', bugs: 'bug_reports' };
      const coll = map[body.review.source] || INTERVIEWER_COLLECTIONS.responses;
      const set: any = { reviewed: true, reviewedAt: new Date().toISOString() };
      if (typeof body.review.status === 'string' && body.review.status.trim()) set.status = body.review.status.trim().slice(0, 40);
      await db.collection(coll).updateOne({ _id: new ObjectId(body.review.id) }, { $set: set });
      return json({ success: true });
    }
    const { id, published } = body;
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    await db.collection(INTERVIEWER_COLLECTIONS.configs).updateOne({ id }, { $set: { published: published === true, updatedAt: new Date().toISOString() } });
    return json({ success: true });
  } catch (error: any) { return json({ error: error.message }, { status: 500 }); }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const { ObjectId } = await import('mongodb');
  const source = url.searchParams.get('source') || 'responses';
  const responseId = url.searchParams.get('responseId') || url.searchParams.get('id');
  if (responseId && (source !== 'responses' || url.searchParams.get('responseId'))) {
    const map: Record<string, string> = { responses: INTERVIEWER_COLLECTIONS.responses, submissions: 'form_submissions', bugs: 'bug_reports' };
    await db.collection(map[source] || INTERVIEWER_COLLECTIONS.responses).deleteOne({ _id: new ObjectId(responseId) });
    return json({ success: true });
  }
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'ID is required' }, { status: 400 });
  await db.collection(INTERVIEWER_COLLECTIONS.configs).deleteOne({ id });
  return json({ success: true });
}
