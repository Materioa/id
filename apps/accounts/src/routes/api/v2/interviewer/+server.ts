import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/mongo';
import { env } from '$env/dynamic/private';
import { verifyToken, supabaseAdmin } from '$lib/server/utils';
import { getInterviewerTemplates, extractFieldsRegex, extractWithLlm, nextOpenField, INTERVIEWER_COLLECTIONS } from '@materio/config/interviewer';

async function optionalUser(request: Request): Promise<{ id: string; username: string; email: string } | null> {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return null;
    const decoded: any = await verifyToken(token);
    const id = decoded?.id || decoded?.sub || null;
    if (!id) return null;
    try {
      const { data: profile } = await supabaseAdmin.from('users').select('username, email').eq('id', id).single();
      return { id, username: profile?.username || '', email: profile?.email || '' };
    } catch { return { id, username: '', email: '' }; }
  } catch { return null; }
}

async function loadForm(db: any, formId: string) {
  const configured = await db.collection(INTERVIEWER_COLLECTIONS.configs).findOne({ id: formId, published: true });
  if (configured) return { ...configured, _id: undefined };
  const tpl = getInterviewerTemplates().find((t) => t.id === formId);
  return tpl || getInterviewerTemplates()[0];
}

function questionFor(form: any, extracted: Record<string, string>, skipped: string[], llmReply?: string) {
  if (llmReply) return llmReply;
  const next = nextOpenField(form, extracted, skipped);
  if (!next) return form?.interview?.completeMessage || 'Thanks — your response has been recorded.';
  if (Object.keys(extracted).length === 0 && form?.interview?.openingQuestion) return form.interview.openingQuestion;
  return `Got it. What about “${next.label}”?${form?.interview?.skipAllowed ? ' (You can skip this.)' : ''}`;
}

export async function GET({ request, url }) {
  try {
    const db = await getDb();
    const form = await loadForm(db, url.searchParams.get('form') || 'viva-question-bank');
    return json({ form });
  } catch (e: any) { return json({ error: e.message }, { status: 500 }); }
}

export async function POST({ request, platform }: any) {
  try {
    const body = (await request.json()) as any;
    const text = String(body.text || '').trim();
    if (!text) return json({ error: 'An answer is required' }, { status: 400 });
    const db = await getDb();
    const form = body.form?.id ? await loadForm(db, body.form.id) : await loadForm(db, body.formId || 'viva-question-bank');
    const user = await optionalUser(request);
    const userId = user?.id || null;
    if (form.requiresAuth && !userId) return json({ error: 'Sign in required for this form', requiresAuth: true }, { status: 401 });
    const sessionId = body.sessionId || crypto.randomUUID();
    const examContext = body.examContext || {};

    const sessions: any = db.collection(INTERVIEWER_COLLECTIONS.sessions);
    const existing = await sessions.findOne({ sessionId });
    const priorExtracted = existing?.extracted || {};
    const priorSkipped: string[] = existing?.skipped || [];

    await sessions.updateOne(
      { sessionId },
      {
        $setOnInsert: { sessionId, formId: form.id, userId, username: user?.username || null, userEmail: user?.email || null, examContext, createdAt: new Date() },
        $set: { updatedAt: new Date(), status: 'in_progress', examContext, ...(userId ? { userId, username: user?.username || null, userEmail: user?.email || null } : {}) },
        $push: { messages: { role: 'user', content: text, createdAt: new Date() } }
      },
      { upsert: true }
    );

    let extractedNew: Record<string, string> = {};
    let llmReply = '';
    const apiKey = env.OPENROUTER_API_KEY || env.HF_TOKEN;
    if (apiKey) {
      try {
        const out = await extractWithLlm({
          apiKey,
          model: env.INTERVIEWER_MODEL || 'google/gemini-2.0-flash-exp:free',
          form,
          history: { messages: existing?.messages || [], extracted: priorExtracted },
          latestText: text,
          baseUrl: env.OPENROUTER_BASE_URL
        });
        extractedNew = out.extracted;
        llmReply = out.reply;
      } catch { extractedNew = extractFieldsRegex(text, form.fields) as Record<string, string>; }
    } else {
      extractedNew = extractFieldsRegex(text, form.fields) as Record<string, string>;
    }

    const extracted = { ...priorExtracted, ...extractedNew };
    const reply = questionFor(form, extracted, priorSkipped, llmReply);
    const complete = !nextOpenField(form, extracted, priorSkipped);

    await sessions.updateOne(
      { sessionId },
      {
        $set: { updatedAt: new Date(), extracted, status: complete ? 'completed' : 'in_progress' },
        $push: { messages: { role: 'assistant', content: reply, createdAt: new Date() } }
      }
    );

    // Async submit: persist structured snapshot to the NEW form_responses collection
    // without making the user wait — use waitUntil when available, else fire-and-forget.
    const persist = db.collection(INTERVIEWER_COLLECTIONS.responses).updateOne(
      { sessionId },
      { $set: { formId: form.id, kind: form.kind || 'interview', sessionId, values: extracted, skipped: priorSkipped, status: complete ? 'completed' : 'in_progress', userId, username: user?.username || null, userEmail: user?.email || null, examContext, updatedAt: new Date().toISOString() }, $setOnInsert: { createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    const waitUntil = (platform as any)?.context?.waitUntil;
    if (typeof waitUntil === 'function') waitUntil(persist.catch(() => {}));
    else persist.catch(() => {});

    return json({ sessionId, extracted, message: reply, reply, nextField: nextOpenField(form, extracted, priorSkipped), complete });
  } catch (e: any) { return json({ error: 'Unable to save this response' }, { status: 500 }); }
}

export async function PATCH({ request }) {
  try {
    const body = (await request.json()) as any;
    const { sessionId, action, field, examContext } = body;
    if (!sessionId) return json({ error: 'sessionId is required' }, { status: 400 });
    const db = await getDb();
    const sessions: any = db.collection(INTERVIEWER_COLLECTIONS.sessions);
    const existing = await sessions.findOne({ sessionId });
    if (!existing) return json({ error: 'Session not found' }, { status: 404 });
    const form = await loadForm(db, existing.formId);
    const skipped: string[] = existing.skipped || [];
    const extracted = existing.extracted || {};

    if (action === 'skip') {
      const target = field || nextOpenField(form, extracted, skipped)?.name;
      if (target && !skipped.includes(target)) skipped.push(target);
      const reply = questionFor(form, extracted, skipped, '');
      const complete = !nextOpenField(form, extracted, skipped);
      await sessions.updateOne({ sessionId }, { $set: { skipped, updatedAt: new Date(), status: complete ? 'completed' : 'in_progress' }, $push: { messages: { role: 'assistant', content: reply, createdAt: new Date() } } });
      await db.collection(INTERVIEWER_COLLECTIONS.responses).updateOne({ sessionId }, { $set: { skipped, values: extracted, status: complete ? 'completed' : 'in_progress', updatedAt: new Date().toISOString() } }, { upsert: true });
      return json({ extracted, skipped, reply, message: reply, nextField: nextOpenField(form, extracted, skipped), complete });
    }

    if (action === 'complete') {
      await sessions.updateOne({ sessionId }, { $set: { status: 'completed', updatedAt: new Date() } });
      await db.collection(INTERVIEWER_COLLECTIONS.responses).updateOne(
        { sessionId },
        { $set: { values: extracted, skipped, status: 'completed', examContext: examContext || existing.examContext || {}, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return json({ success: true, message: form?.interview?.completeMessage || 'Thanks — your response has been recorded.' });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) { return json({ error: 'Unable to update session' }, { status: 500 }); }
}
