import { ObjectId } from 'mongodb';
import { getDb } from './mongo';
import { sendCustomEmail, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME } from './mailer';
import {
  generateCaseNumber,
  generateAutomatedBugReply,
  analyzeInboundEmail,
  makeJevDecisions,
  callLlm,
  extractCaseNumber,
  resolveGreetingName,
  type ThreadMessage,
  type BugDetails
} from './ai-support';

export const ADMIN_FORWARD_EMAIL = 'jinansh@getmaterio.app';

/**
 * Clean up email address string e.g. "Jane Doe <jane@example.com>" -> "jane@example.com"
 */
export function extractCleanEmail(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  if (match && match[1]) return match[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

/**
 * Extract human name from "John Doe <john@example.com>"
 */
export function extractDisplayName(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/^"?([^"<]+)"?\s*</);
  if (match && match[1]) return match[1].trim();
  const clean = extractCleanEmail(raw);
  if (clean && clean.includes('@')) {
    const username = clean.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }
  return '';
}

/**
 * Process a bug report to ensure a support ticket exists and an automated AI reply is sent.
 */
export async function processBugReportAutoTicket(bugIdOrDoc: string | any, forceReply = false) {
  const db = await getDb();
  let bugDoc: any = null;

  if (typeof bugIdOrDoc === 'string') {
    let query: any;
    try {
      query = { _id: new ObjectId(bugIdOrDoc) };
    } catch {
      query = { id: bugIdOrDoc };
    }
    bugDoc = await db.collection('bug_reports').findOne(query);
  } else {
    bugDoc = bugIdOrDoc;
  }

  if (!bugDoc) return { success: false, reason: 'Bug report not found' };

  const reporterEmail = extractCleanEmail(bugDoc.email || bugDoc.userEmail || '');
  if (!reporterEmail || !reporterEmail.includes('@')) {
    if (bugDoc.caseNumber) {
      const updateFilter = bugDoc._id ? { _id: bugDoc._id } : { id: bugDoc.id };
      await db.collection('bug_reports').updateOne(updateFilter, { $unset: { caseNumber: '', ticketCreated: '' } }).catch(() => {});
      delete bugDoc.caseNumber;
    }
    return { success: false, reason: 'No reporter email provided in bug report' };
  }

  // CRITICAL GUARD: Never send AI automated emails to resolved or reviewed reports!
  const currentStatus = String(bugDoc.status || '').toLowerCase().trim();
  const isResolvedOrReviewed =
    currentStatus === 'resolved' ||
    currentStatus === 'reviewed' ||
    currentStatus === 'closed' ||
    currentStatus === 'fixed' ||
    bugDoc.reviewed === true;

  if (isResolvedOrReviewed) {
    console.log('[Support-Service] Skipping email: bug report is already resolved/reviewed:', bugDoc.id || bugDoc._id);
    if (!bugDoc.caseNumber) {
      const caseNumber = generateCaseNumber();
      const updateQuery = bugDoc._id ? { _id: bugDoc._id } : { id: bugDoc.id };
      await db.collection('bug_reports').updateOne(updateQuery, { $set: { caseNumber } }).catch(() => {});
      return { success: true, caseNumber, alreadyResolved: true };
    }
    return { success: true, caseNumber: bugDoc.caseNumber, alreadyResolved: true };
  }

  // CRITICAL GUARD: Only auto-reply to newly submitted reports from today onwards (Oct 8, 2026) to protect old users
  const CUTOFF_TIME = new Date('2026-10-08T00:00:00.000Z').getTime();
  const reportTime = new Date(bugDoc.reportedAt || bugDoc.createdAt || 0).getTime();
  if (reportTime < CUTOFF_TIME && !forceReply) {
    console.log('[Support-Service] Skipping automated reply: report is older than cutoff date:', bugDoc.id || bugDoc._id);
    return { success: true, caseNumber: bugDoc.caseNumber || generateCaseNumber(), skipped: 'Report is older than Oct 8, 2026' };
  }

  // Check if reply already sent and force not specified
  if (bugDoc.automatedReplySent && !forceReply && bugDoc.caseNumber) {
    return {
      success: true,
      caseNumber: bugDoc.caseNumber,
      alreadySent: true
    };
  }

  const bugId = bugDoc._id ? bugDoc._id.toString() : bugDoc.id;

  // Prevent multiple responses: Check if an email was already recorded in admin_emails for this report
  const existingEmail = await db.collection('admin_emails').findOne({
    $or: [
      { responseId: bugId },
      ...(bugDoc.caseNumber ? [{ caseNumber: bugDoc.caseNumber }] : [])
    ],
    direction: 'sent'
  });
  if (existingEmail && !forceReply) {
    console.log('[Support-Service] Email already dispatched previously for bug report:', bugId);
    return { success: true, caseNumber: bugDoc.caseNumber || existingEmail.caseNumber, alreadySent: true };
  }

  // Assign or reuse case number
  const caseNumber = bugDoc.caseNumber || generateCaseNumber();

  // ATOMIC LOCK: Claim this report in MongoDB before LLM generation to prevent race conditions
  if (!forceReply) {
    const claimFilter: any = {
      ...(bugDoc._id ? { _id: bugDoc._id } : { id: bugId }),
      automatedReplySent: { $ne: true },
      isProcessingAutoReply: { $ne: true }
    };
    const claimRes = await db.collection('bug_reports').findOneAndUpdate(
      claimFilter,
      {
        $set: {
          isProcessingAutoReply: true,
          caseNumber,
          ticketCreated: true,
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: 'after' }
    );
    if (!claimRes || (claimRes as any).value === null) {
      console.log('[Support-Service] Bug report already claimed or replied by another process:', bugId);
      return { success: true, caseNumber, alreadySent: true };
    }
    bugDoc.caseNumber = caseNumber;
  }
  const severity = String(bugDoc.severity || 'minor').toLowerCase();
  let isImportant =
    severity === 'critical' ||
    severity === 'major' ||
    bugDoc.isImportant === true ||
    String(bugDoc.title || '').toLowerCase().includes('urgent');

  // Use TypeSafe AI Jev to evaluate severity and importance
  if (!isImportant) {
    const jevCheck = await makeJevDecisions(`${bugDoc.title || ''}\n\n${bugDoc.description || ''}`).catch(() => null);
    if (jevCheck?.isImportant) {
      isImportant = true;
    }
  }

  // 1. Generate AI Automated Response
  const bugDetails: BugDetails = {
    title: bugDoc.title || 'Bug Report',
    severity: bugDoc.severity || 'minor',
    affectedArea: bugDoc.affectedArea || 'general',
    description: bugDoc.description || 'No description provided',
    stepsToReproduce: bugDoc.stepsToReproduce || '',
    email: reporterEmail,
    name: bugDoc.name || bugDoc.username || extractDisplayName(bugDoc.email || ''),
    reportedAt: bugDoc.reportedAt || new Date().toISOString()
  };

  const aiReply = await generateAutomatedBugReply({
    caseNumber,
    bug: bugDetails,
    isImportant
  });

  // 2. Dispatch email to the reporter via Resend / Mailer
  const sendRes = await sendCustomEmail({
    to: reporterEmail,
    subject: aiReply.subject,
    text: aiReply.body,
    from: `"${DEFAULT_FROM_NAME} Support" <${DEFAULT_FROM_EMAIL}>`,
    replyTo: DEFAULT_FROM_EMAIL
  });

  const now = new Date().toISOString();

  // 3. Save sent email record in admin_emails
  const emailRecord = {
    direction: 'sent',
    from: `"${DEFAULT_FROM_NAME} Support" <${DEFAULT_FROM_EMAIL}>`,
    to: reporterEmail,
    replyTo: DEFAULT_FROM_EMAIL,
    subject: aiReply.subject,
    text: aiReply.body,
    caseNumber,
    messageId: sendRes.messageId || null,
    status: sendRes.success ? 'sent' : 'failed',
    read: true,
    formId: 'bug-report',
    responseId: bugId,
    responseSource: 'bugs',
    isAiGenerated: true,
    aiProvider: aiReply.provider,
    aiModel: aiReply.model,
    isImportant,
    createdAt: now
  };

  await db.collection('admin_emails').insertOne(emailRecord);

  // 4. Update the bug report in MongoDB - set status to "Replied" as requested
  const bugUpdate: any = {
    caseNumber,
    ticketCreated: true,
    automatedReplySent: true,
    isProcessingAutoReply: false,
    automatedReplyAt: now,
    automatedReplyModel: aiReply.model,
    isImportant,
    assignedTo: isImportant ? ADMIN_FORWARD_EMAIL : 'support@getmaterio.app',
    status: 'Replied'
  };

  try {
    if (bugDoc._id) {
      await db.collection('bug_reports').updateOne({ _id: bugDoc._id }, { $set: bugUpdate });
    } else {
      await db.collection('bug_reports').updateOne({ id: bugDoc.id }, { $set: bugUpdate });
    }
  } catch (err: any) {
    console.error('[Support-Service] Bug doc update error:', err.message);
  }

  // 5. If it's a bug report or marked important, forward immediately to jinansh@getmaterio.app
  let forwarded = false;
  try {
    const forwardSubject = `[Bug Report ${caseNumber}] ${isImportant ? 'HIGH PRIORITY: ' : ''}${bugDetails.title}`;
    const forwardBody = `Case Number: ${caseNumber}
Status: Assigned to ${isImportant ? ADMIN_FORWARD_EMAIL : 'Support'}
Priority: ${isImportant ? 'HIGH / CRITICAL' : 'Standard'}
Reporter: ${reporterEmail}
Date: ${now}

--- BUG DETAILS ---
Title: ${bugDetails.title}
Severity: ${bugDetails.severity}
Affected Area: ${bugDetails.affectedArea}
Description:
${bugDetails.description}

Steps to Reproduce:
${bugDetails.stepsToReproduce || 'None provided'}

--- AUTOMATED AI REPLY SENT TO USER ---
(Model: ${aiReply.model})
${aiReply.body}

---
You can view and reply to this ticket directly in the Materio Admin App:
Forms & Wizards > Bug Reports > Case ${caseNumber}`;

    await sendCustomEmail({
      to: ADMIN_FORWARD_EMAIL,
      subject: forwardSubject,
      text: forwardBody,
      from: `"${DEFAULT_FROM_NAME} System" <${DEFAULT_FROM_EMAIL}>`,
      replyTo: reporterEmail
    });
    forwarded = true;
  } catch (err: any) {
    console.error('[Support-Service] Forward to admin failed:', err.message);
  }

  return {
    success: true,
    caseNumber,
    emailSent: sendRes.success,
    forwarded,
    aiModel: aiReply.model
  };
}

/**
 * Auto-triage for pending bug reports (from Oct 8, 2026 onwards)
 */
export async function autoTriageAllPendingBugReports(): Promise<{ processed: number; errors: number }> {
  const db = await getDb();
  const cutoffDate = new Date('2026-10-08T00:00:00.000Z');
  const cutoffIso = cutoffDate.toISOString();

  // Find all unreplied, unreviewed bug reports submitted from today onwards with valid emails
  const pendingBugs = await db
    .collection('bug_reports')
    .find({
      status: { $in: ['open', 'pending', ''] },
      reviewed: { $ne: true },
      automatedReplySent: { $ne: true },
      email: { $regex: '@', $options: 'i' },
      $or: [
        { reportedAt: { $gte: cutoffDate } },
        { reportedAt: { $gte: cutoffIso } },
        { createdAt: { $gte: cutoffDate } },
        { createdAt: { $gte: cutoffIso } }
      ]
    })
    .sort({ reportedAt: -1 })
    .limit(10)
    .toArray();

  let processed = 0;
  let errors = 0;

  for (const bug of pendingBugs) {
    try {
      const res = await processBugReportAutoTicket(bug, false);
      if (res.success && res.emailSent) {
        processed++;
      }
    } catch (err: any) {
      console.error('[Support-Service] Auto-triage error for bug', bug._id, err.message);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Process an inbound email received at support@getmaterio.app
 */
export async function processInboundEmail(params: {
  from: string;
  to?: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
}) {
  const db = await getDb();
  const rawSender = params.from || '';
  const senderEmail = extractCleanEmail(rawSender);
  const senderName = extractDisplayName(rawSender);
  const subject = (params.subject || 'Support Inquiry').trim();
  const textBody = (params.text || (params.html ? params.html.replace(/<[^>]*>?/gm, '') : '')).trim();

  // Prevent infinite bounce loops
  if (
    senderEmail === DEFAULT_FROM_EMAIL.toLowerCase() ||
    senderEmail === 'support@getmaterio.app' ||
    senderEmail.includes('mailer-daemon') ||
    senderEmail.includes('no-reply')
  ) {
    console.log('[Support-Service] Ignoring bounce/system email from', senderEmail);
    return { ignored: true, reason: 'System or loop address' };
  }

  // 1. Analyze inbound email with AI
  const analysis = await analyzeInboundEmail({
    from: rawSender,
    subject,
    text: textBody,
    html: params.html
  });

  const now = new Date().toISOString();
  let caseNumber = analysis.existingCaseNumber;
  let isExistingCase = false;
  let linkedBugId: string | null = null;

  // 2. Check if this references an existing ticket
  if (caseNumber) {
    const existingBug = await db.collection('bug_reports').findOne({ caseNumber });
    if (existingBug) {
      isExistingCase = true;
      linkedBugId = existingBug._id ? existingBug._id.toString() : existingBug.id;
    } else {
      const existingEmail = await db.collection('admin_emails').findOne({ caseNumber });
      if (existingEmail) {
        isExistingCase = true;
        linkedBugId = existingEmail.responseId || null;
      }
    }
  }

  // If not an existing case, generate a new Case Number!
  if (!caseNumber) {
    caseNumber = generateCaseNumber();
  }

  // 3. Record the inbound email in admin_emails
  const inboundRecord = {
    direction: 'inbox',
    from: rawSender,
    to: params.to || DEFAULT_FROM_EMAIL,
    subject,
    text: textBody,
    html: params.html,
    caseNumber,
    messageId: params.messageId || null,
    status: 'received',
    read: false,
    responseId: linkedBugId,
    responseSource: 'bugs',
    isBugReport: analysis.isBugReport,
    isImportant: analysis.isImportant,
    createdAt: now
  };

  const insertedInbound = await db.collection('admin_emails').insertOne(inboundRecord);

  // 4. Handle Existing Case Follow-up
  if (isExistingCase) {
    // If the customer replied to an existing case, update the bug report status
    if (linkedBugId) {
      try {
        await db.collection('bug_reports').updateOne(
          { _id: new ObjectId(linkedBugId) },
          { $set: { status: 'open', lastCustomerReplyAt: now, updatedAt: now } }
        );
      } catch {
        await db.collection('bug_reports').updateOne(
          { id: linkedBugId },
          { $set: { status: 'open', lastCustomerReplyAt: now, updatedAt: now } }
        );
      }
    }

    // If important or critical, forward the follow-up to jinansh@getmaterio.app
    if (analysis.isImportant || analysis.isBugReport) {
      await sendCustomEmail({
        to: ADMIN_FORWARD_EMAIL,
        subject: `[Customer Reply on ${caseNumber}] ${subject}`,
        text: `Customer ${rawSender} replied to existing Case ${caseNumber}:\n\n${textBody}\n\nView thread in Admin Forms & Wizards > Bug Reports.`,
        from: `"${DEFAULT_FROM_NAME} Alerts" <${DEFAULT_FROM_EMAIL}>`,
        replyTo: senderEmail
      }).catch((e: any) => console.error('[Support-Service] Follow-up forward error:', e.message));
    }

    return {
      success: true,
      caseNumber,
      isExistingCase: true,
      id: insertedInbound.insertedId.toString()
    };
  }

  // 5. Handle NEW Inbound Ticket
  let createdBugReportId: string | null = null;

  // Requirement: "Note: from direct email too if it looks like a bug report then generate the case number and forward to me at jinansh@getmaterio.app"
  if (analysis.isBugReport) {
    const newBug = {
      title: analysis.extractedTitle || subject,
      severity: analysis.extractedSeverity,
      affectedArea: analysis.extractedArea,
      description: textBody,
      email: senderEmail,
      name: senderName,
      reportedAt: now,
      status: 'open',
      source: 'inbound_email',
      caseNumber,
      isImportant: analysis.isImportant,
      assignedTo: analysis.isImportant ? ADMIN_FORWARD_EMAIL : 'support@getmaterio.app',
      ticketCreated: true,
      automatedReplySent: true,
      automatedReplyAt: now
    };

    const bugInsert = await db.collection('bug_reports').insertOne(newBug);
    createdBugReportId = bugInsert.insertedId.toString();

    // Link inbound email record with new bug
    await db.collection('admin_emails').updateOne(
      { _id: insertedInbound.insertedId },
      { $set: { responseId: createdBugReportId, formId: 'bug-report' } }
    );
  }

  // 6. Generate AI Automated Reply for the new email
  let replyBody = '';
  let replySubject = `[${caseNumber}] Re: ${subject.replace(/^re:\s*/i, '')}`;

  if (analysis.isBugReport) {
    const bugReply = await generateAutomatedBugReply({
      caseNumber,
      bug: {
        title: analysis.extractedTitle || subject,
        severity: analysis.extractedSeverity,
        affectedArea: analysis.extractedArea,
        description: textBody,
        email: senderEmail,
        name: senderName
      },
      isImportant: analysis.isImportant
    });
    replyBody = bugReply.body;
    replySubject = bugReply.subject;
  } else {
    // General support email automated acknowledgment
    const resolvedSenderName = await resolveGreetingName(senderEmail, senderName);
    const greeting = resolvedSenderName ? `Hi ${resolvedSenderName},` : 'Hi there,';

    const prompt = `Generate an initial automated customer support reply.
Sender Name: ${resolvedSenderName || 'there'}
Sender Email: ${senderEmail}
Inquiry Subject: ${subject}
Inquiry Content: ${textBody}
Is Important: ${analysis.isImportant ? 'YES' : 'NO'}`;

    const systemPrompt = `You are Materio's Customer Support AI.
Generate a helpful and polite reply formatted strictly as:

Case Number: ${caseNumber}

${greeting}

[Polite acknowledgement of their message]
${
  analysis.isImportant
    ? '[EXPLICIT STATEMENT: Inform the sender that their request has been identified as high priority and a suitable specialist has been specifically assigned to their case and is reviewing it.]'
    : '[State that Materio Support is reviewing their inquiry and will follow up shortly.]'
}
[Invite them to reply directly with any further questions]

Braun,
Materio Support`;

    try {
      const res = await callLlm(prompt, systemPrompt, 'google-ai');
      replyBody = res.text.trim();
      if (!replyBody.startsWith('Case Number:')) {
        replyBody = `Case Number: ${caseNumber}\n\n` + replyBody;
      }
      if (resolvedSenderName) {
        replyBody = replyBody.replace(/\b(?:Hi|Hello|Dear)\s+[^,\n]+,/i, `Hi ${resolvedSenderName},`);
      }
      replyBody = replyBody.replace(/support@getmaterio\.app/gi, '').trim();
      replyBody = replyBody.replace(/\n+(?:Warm regards,?\s*)?(?:Materio Support|Braun,?\s*Materio Support)[\s\S]*$/i, '\n\nBraun,\nMaterio Support').trim();
    } catch {
      replyBody = `Case Number: ${caseNumber}

${greeting}

Thank you for contacting Materio Support regarding "${subject}".

${
  analysis.isImportant
    ? 'A suitable specialist has been assigned to your case and our team is actively reviewing your request with priority.\n\n'
    : 'We have received your message and our team is reviewing it.\n\n'
}If you have any additional information, please feel free to reply directly to this thread.

Braun,
Materio Support`;
    }
  }

  // 7. Dispatch the automated response email
  const replyRes = await sendCustomEmail({
    to: senderEmail,
    subject: replySubject,
    text: replyBody,
    from: `"${DEFAULT_FROM_NAME} Support" <${DEFAULT_FROM_EMAIL}>`,
    replyTo: DEFAULT_FROM_EMAIL
  });

  // Record sent reply in admin_emails
  await db.collection('admin_emails').insertOne({
    direction: 'sent',
    from: `"${DEFAULT_FROM_NAME} Support" <${DEFAULT_FROM_EMAIL}>`,
    to: senderEmail,
    replyTo: DEFAULT_FROM_EMAIL,
    subject: replySubject,
    text: replyBody,
    caseNumber,
    messageId: replyRes.messageId || null,
    status: replyRes.success ? 'sent' : 'failed',
    read: true,
    formId: analysis.isBugReport ? 'bug-report' : null,
    responseId: createdBugReportId,
    responseSource: 'bugs',
    isAiGenerated: true,
    isImportant: analysis.isImportant,
    createdAt: new Date().toISOString()
  });

  // 8. Forward to jinansh@getmaterio.app if bug report or important
  // Requirements:
  // "and if its important then forward the mail to jinansh@getmaterio.app and reply the sender that suitable person has been assigned"
  // "Note: from direct email too if it looks like a bug report then generate the case number and forward to me at jinansh@getmaterio.app"
  let forwarded = false;
  if (analysis.isBugReport || analysis.isImportant) {
    try {
      const forwardSubject = `[Support Alert: ${caseNumber}] ${analysis.isBugReport ? 'Bug Report: ' : ''}${subject}`;
      const forwardText = `Case Number: ${caseNumber}
From: ${rawSender}
Classification: ${analysis.isBugReport ? 'Bug Report (' + analysis.extractedSeverity + ')' : 'Inbound Inquiry'}
Assigned: ${analysis.isImportant ? ADMIN_FORWARD_EMAIL : 'Support'}
Summary: ${analysis.summary}
Date: ${now}

--- ORIGINAL MESSAGE ---
${textBody}

--- AUTOMATED REPLY SENT TO SENDER ---
${replyBody}

---
View or continue the conversation in the Materio Admin App.`;

      await sendCustomEmail({
        to: ADMIN_FORWARD_EMAIL,
        subject: forwardSubject,
        text: forwardText,
        from: `"${DEFAULT_FROM_NAME} System" <${DEFAULT_FROM_EMAIL}>`,
        replyTo: senderEmail
      });
      forwarded = true;
    } catch (e: any) {
      console.error('[Support-Service] Forward to admin failed:', e.message);
    }
  }

  return {
    success: true,
    caseNumber,
    isBugReport: analysis.isBugReport,
    isImportant: analysis.isImportant,
    forwarded,
    createdBugReportId
  };
}

/**
 * Fetch complete conversation thread for a ticket/bug
 */
export async function getTicketThread(params: {
  caseNumber?: string;
  responseId?: string;
  email?: string;
}) {
  const db = await getDb();
  const { caseNumber, responseId, email } = params;

  let bugDoc: any = null;
  if (responseId) {
    try {
      bugDoc = await db.collection('bug_reports').findOne({ _id: new ObjectId(responseId) });
    } catch {
      bugDoc = await db.collection('bug_reports').findOne({ id: responseId });
    }
  }
  if (!bugDoc && caseNumber) {
    bugDoc = await db.collection('bug_reports').findOne({ caseNumber });
  }

  // Find all emails linked to this thread
  const queryOr: any[] = [];
  let activeCaseNumber = caseNumber || bugDoc?.caseNumber;

  const reporterEmail = extractCleanEmail(bugDoc?.email || bugDoc?.userEmail || email || '');

  if (!reporterEmail || !reporterEmail.includes('@')) {
    if (bugDoc?.caseNumber) {
      const updateFilter = bugDoc._id ? { _id: bugDoc._id } : { id: bugDoc.id };
      await db.collection('bug_reports').updateOne(updateFilter, { $unset: { caseNumber: '', ticketCreated: '' } }).catch(() => {});
      delete bugDoc.caseNumber;
    }
    activeCaseNumber = undefined;
  } else if (!activeCaseNumber) {
    if (bugDoc) {
      activeCaseNumber = generateCaseNumber();
      const updateFilter = bugDoc._id ? { _id: bugDoc._id } : { id: bugDoc.id };
      await db.collection('bug_reports').updateOne(updateFilter, { $set: { caseNumber: activeCaseNumber, updatedAt: new Date().toISOString() } }).catch(() => {});
      bugDoc.caseNumber = activeCaseNumber;
    } else if (responseId) {
      // ONLY generate case numbers for feedback forms!
      let subDoc: any = null;
      try {
        subDoc = await db.collection('form_submissions').findOne({
          $or: [{ _id: new ObjectId(responseId) }, { id: responseId }]
        });
      } catch {}
      if (!subDoc) {
        try {
          subDoc = await db.collection('interviewer_responses').findOne({
            $or: [{ _id: new ObjectId(responseId) }, { id: responseId }]
          });
        } catch {}
      }

      const formType = String(subDoc?.formType || subDoc?.formId || '').toLowerCase();
      const isFeedback = formType.includes('feedback') || formType === 'satisfaction';
      const subEmail = extractCleanEmail(subDoc?.email || subDoc?.userEmail || email || '');

      if (isFeedback && subEmail && subEmail.includes('@')) {
        activeCaseNumber = subDoc?.caseNumber || generateCaseNumber();
        try {
          await db.collection('form_submissions').updateOne(
            { $or: [{ _id: new ObjectId(responseId) }, { id: responseId }] },
            { $set: { caseNumber: activeCaseNumber, updatedAt: new Date().toISOString() } }
          ).catch(() => {});
        } catch {}
        try {
          await db.collection('interviewer_responses').updateOne(
            { $or: [{ _id: new ObjectId(responseId) }, { id: responseId }] },
            { $set: { caseNumber: activeCaseNumber, updatedAt: new Date().toISOString() } }
          ).catch(() => {});
        } catch {}
      } else {
        if (subDoc?.caseNumber) {
          try {
            await db.collection('form_submissions').updateOne(
              { $or: [{ _id: new ObjectId(responseId) }, { id: responseId }] },
              { $unset: { caseNumber: '', ticketCreated: '' } }
            ).catch(() => {});
            await db.collection('interviewer_responses').updateOne(
              { $or: [{ _id: new ObjectId(responseId) }, { id: responseId }] },
              { $unset: { caseNumber: '', ticketCreated: '' } }
            ).catch(() => {});
          } catch {}
        }
        activeCaseNumber = undefined;
      }
    }
  }

  if (activeCaseNumber) {
    queryOr.push({ caseNumber: activeCaseNumber });
    queryOr.push({ subject: { $regex: activeCaseNumber, $options: 'i' } });
  }
  if (responseId) {
    queryOr.push({ responseId });
  }
  if (bugDoc?._id) {
    queryOr.push({ responseId: bugDoc._id.toString() });
  }
  // Only if there is no ticket case number and no responseId, fallback to email query
  if (queryOr.length === 0 && email) {
    const clean = extractCleanEmail(email);
    if (clean) {
      queryOr.push({ to: clean });
      queryOr.push({ from: { $regex: clean, $options: 'i' } });
    }
  }

  let emails: any[] = [];
  if (queryOr.length > 0) {
    emails = await db
      .collection('admin_emails')
      .find({ $or: queryOr })
      .sort({ createdAt: 1 })
      .toArray();
  }

  // Deduplicate any repeated messages with identical direction and content
  const seenKeys = new Set<string>();
  const uniqueEmails = emails.filter((e) => {
    const key = `${e.direction || 'sent'}:${(e.text || '').trim().replace(/\s+/g, ' ').slice(0, 100)}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  return {
    caseNumber: activeCaseNumber || null,
    bug: bugDoc
      ? {
          ...bugDoc,
          id: bugDoc._id ? bugDoc._id.toString() : bugDoc.id,
          _id: undefined
        }
      : null,
    messages: uniqueEmails.map((e) => {
      const { cleanText, quotedText } = splitEmailQuotes(e.text || '');
      return {
        id: e._id.toString(),
        direction: e.direction || 'sent',
        from: e.from,
        to: e.to,
        subject: e.subject,
        text: cleanText || e.text,
        quotedText: quotedText || null,
        rawText: e.text,
        html: e.html,
        messageId: extractMessageIdFromDoc(e),
        caseNumber: e.caseNumber,
        isAiGenerated: e.isAiGenerated === true,
        aiProvider: e.aiProvider,
        aiModel: e.aiModel,
        createdAt: e.createdAt
      };
    })
  };
}

/**
 * Separate clean reply text from quoted email thread history (e.g. "On ... wrote:", "> ...")
 */
export function splitEmailQuotes(raw: string): { cleanText: string; quotedText: string } {
  if (!raw) return { cleanText: '', quotedText: '' };
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match typical email reply quote headers:
  // "On Thu, 8 Oct, 2026 ... wrote:"
  // "-----Original Message-----"
  // "From: ... Sent: ... To: ..."
  // "---------- Forwarded message ---------"
  const quoteHeaderRegex = /\n\s*(?:On\s+[\s\S]+?wrote:|-----Original Message-----|From:\s+[^\n]+\nSent:\s+[^\n]+|---------- Forwarded message ---------)[\s\S]*$/i;
  const headerMatch = normalized.match(quoteHeaderRegex);
  if (headerMatch && typeof headerMatch.index === 'number') {
    const cleanText = normalized.slice(0, headerMatch.index).trim();
    const quotedText = normalized.slice(headerMatch.index).trim();
    if (cleanText) {
      return { cleanText, quotedText };
    }
  }

  // Also check for blocks of lines starting with '>' (e.g. > Hi Braun, > ... > ...)
  const blockquoteRegex = /\n(?:\s*>[^\n]*\n*)+$/;
  const bqMatch = normalized.match(blockquoteRegex);
  if (bqMatch && typeof bqMatch.index === 'number') {
    const cleanText = normalized.slice(0, bqMatch.index).trim();
    const quotedText = normalized.slice(bqMatch.index).trim();
    if (cleanText) {
      return { cleanText, quotedText };
    }
  }

  return { cleanText: normalized.trim(), quotedText: '' };
}

function extractMessageIdFromDoc(e: any): string | null {
  return e.messageId || e.headers?.['message-id'] || e.headers?.['Message-ID'] || null;
}


/**
 * Send an admin reply continuing the conversation thread
 */
export async function sendThreadReply(params: {
  caseNumber: string;
  responseId?: string;
  to: string;
  subject: string;
  text: string;
  status?: string;
  forwardTo?: string;
  forwardToJinansh?: boolean;
}) {
  const db = await getDb();
  const { caseNumber, responseId, to, subject, text, status = 'in_progress', forwardTo, forwardToJinansh } = params;

  if (!to || !to.trim()) throw new Error('Recipient email is required');
  if (!text || !text.trim()) throw new Error('Message body is required');

  const sender = `"${DEFAULT_FROM_NAME} Support" <${DEFAULT_FROM_EMAIL}>`;
  const cleanTo = extractCleanEmail(to);

  // Requirement: Every reply from us must include Case Number: <caseNumber> at the top
  let finalText = text.trim();
  if (caseNumber && !finalText.toLowerCase().startsWith('case number:')) {
    finalText = `Case Number: ${caseNumber}\n\n${finalText}`;
  }

  // Find previous emails in the thread to maintain RFC threading headers & subject consistency
  const prevQuery: any[] = [];
  if (caseNumber) {
    prevQuery.push({ caseNumber });
    prevQuery.push({ subject: { $regex: caseNumber, $options: 'i' } });
  }
  if (responseId) prevQuery.push({ responseId });

  let parentMessageId: string | null = null;
  let rootMessageId: string | null = null;
  let threadSubject = subject.trim();

  if (prevQuery.length > 0) {
    const existingEmails = await db.collection('admin_emails').find({ $or: prevQuery }).sort({ createdAt: 1 }).toArray();
    if (existingEmails.length > 0) {
      const withId = existingEmails
        .map((e) => ({ ...e, resolvedId: extractMessageIdFromDoc(e) }))
        .filter((e) => e.resolvedId);

      if (withId.length > 0) {
        rootMessageId = withId[0].resolvedId;
        // Point In-Reply-To to the LATEST message in the thread (e.g. the customer's reply!)
        parentMessageId = withId[withId.length - 1].resolvedId;
      }

      const latestEmail = existingEmails[existingEmails.length - 1];
      if (latestEmail?.subject) {
        const rawSubj = latestEmail.subject.replace(/^(?:Re:\s*)+/i, '').trim();
        threadSubject = `Re: ${rawSubj}`;
      }
    }
  }

  const headers: Record<string, string> = {};
  if (parentMessageId) {
    const cleanParentId = parentMessageId.startsWith('<') ? parentMessageId : `<${parentMessageId}>`;
    headers['In-Reply-To'] = cleanParentId;
    if (rootMessageId && rootMessageId !== parentMessageId) {
      const cleanRootId = rootMessageId.startsWith('<') ? rootMessageId : `<${rootMessageId}>`;
      headers['References'] = `${cleanRootId} ${cleanParentId}`;
    } else {
      headers['References'] = cleanParentId;
    }
  }

  // Send email to customer with threading headers
  const sendRes = await sendCustomEmail({
    to: cleanTo,
    subject: threadSubject,
    text: finalText,
    from: sender,
    replyTo: DEFAULT_FROM_EMAIL,
    headers
  });

  if (!sendRes.success) {
    throw new Error(sendRes.error || 'Failed to dispatch email');
  }

  const now = new Date().toISOString();

  // Save in admin_emails
  const emailRecord = {
    direction: 'sent',
    from: sender,
    to: cleanTo,
    replyTo: DEFAULT_FROM_EMAIL,
    subject: threadSubject,
    text: finalText,
    caseNumber,
    messageId: sendRes.messageId || null,
    status: 'sent',
    read: true,
    formId: 'bug-report',
    responseId: responseId || null,
    responseSource: 'bugs',
    isAiGenerated: false,
    createdAt: now
  };

  const insertResult = await db.collection('admin_emails').insertOne(emailRecord);

  // Update bug report if applicable
  if (responseId) {
    try {
      await db.collection('bug_reports').updateOne(
        { _id: new ObjectId(responseId) },
        { $set: { status, lastAdminReplyAt: now, updatedAt: now } }
      );
    } catch {
      await db.collection('bug_reports').updateOne(
        { id: responseId },
        { $set: { status, lastAdminReplyAt: now, updatedAt: now } }
      );
    }
  }

  // Forward copy if requested (to specified email or jinansh@getmaterio.app)
  const targetForward = (forwardTo || '').trim() || (forwardToJinansh ? ADMIN_FORWARD_EMAIL : '');
  if (targetForward) {
    await sendCustomEmail({
      to: targetForward,
      subject: `[Admin Thread Reply: ${caseNumber}] ${subject}`,
      text: `An admin reply was sent to ${cleanTo} on Case ${caseNumber}:\n\n${text}\n\nTicket status updated to: ${status}`,
      from: sender,
      replyTo: DEFAULT_FROM_EMAIL
    }).catch((e: any) => console.error('[Support-Service] Forward copy error:', e.message));
  }

  return {
    success: true,
    id: insertResult.insertedId.toString(),
    messageId: sendRes.messageId
  };
}
