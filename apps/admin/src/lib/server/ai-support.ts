import { env } from '$env/dynamic/private';
import { supabaseAdmin } from './utils';

// Keys from environment variables
const GEMINI_API_KEY = env.GEMINI_API_KEY || env.GOOGLE_AI_KEY || '';
const NVIDIA_API_KEY = env.NVIDIA_API_KEY || env.NVIDIA_NIM_KEY || '';
const TYPESAFE_API_KEY = env.TYPESAFE_API_KEY || (typeof process !== 'undefined' ? process.env?.TYPESAFE_API_KEY : '') || '';

export type AIProvider = 'google-ai' | 'nvidia-nim' | 'typesafe-jev' | 'auto';

export interface JevDecisionResult {
  isBugReport: boolean;
  isImportant: boolean;
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  affectedArea: string;
  bugProbability: number;
  importanceProbability: number;
  model: string;
}

export interface BugDetails {
  title?: string;
  severity?: string;
  affectedArea?: string;
  description?: string;
  stepsToReproduce?: string;
  email?: string;
  name?: string;
  reportedAt?: string;
}

export interface ThreadMessage {
  direction: 'inbound' | 'sent' | 'system';
  from: string;
  to?: string;
  subject?: string;
  text: string;
  createdAt?: string;
  isAiGenerated?: boolean;
  provider?: string;
}

/**
 * Resolve the recipient's greeting name:
 * If the email is found inside Supabase `users` table:
 *   - greet with their display_name trimmed to first name
 *   - or username if display_name is not set
 * If not found, fallback to the current solution (fallbackName or empty string).
 */
export async function resolveGreetingName(email?: string, fallbackName?: string): Promise<string> {
  const cleanEmail = email?.trim().toLowerCase();
  if (cleanEmail) {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('display_name, username')
        .ilike('email', cleanEmail)
        .limit(1)
        .maybeSingle();

      if (!error && user) {
        if (user.display_name && typeof user.display_name === 'string' && user.display_name.trim()) {
          const firstName = user.display_name.trim().split(/\s+/)[0];
          if (firstName) return firstName;
        }
        if (user.username && typeof user.username === 'string' && user.username.trim()) {
          return user.username.trim();
        }
      }
    } catch (err: any) {
      console.warn('[AI-Support] Error looking up user for greeting:', err?.message || err);
    }
  }

  // Fallback to current solution
  return fallbackName?.trim() || '';
}

/**
 * Generate a unique numeric case number like 14067443
 */
export function generateCaseNumber(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

/**
 * Extract existing case number from subject or body if present
 */
export function extractCaseNumber(text: string): string | null {
  if (!text) return null;
  const numMatch = text.match(/Case\s*(?:Number|#)?\s*[:#-]?\s*([0-9]{7,9})/i);
  if (numMatch) return numMatch[1];
  const legacyMatch = text.match(/CASE-\d{4}-\d{5}/i);
  if (legacyMatch) return legacyMatch[0];
  const digits = text.match(/\b([1-9][0-9]{7})\b/);
  return digits ? digits[1] : null;
}

/**
 * Call Google AI Studio (Gemini 3.8 Flash)
 */
async function callGoogleAiStudio(prompt: string, systemPrompt?: string): Promise<{ text: string; model: string }> {
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_KEY || GEMINI_API_KEY;
  if (!apiKey) throw new Error('Google AI Studio API key not configured (GEMINI_API_KEY)');

  // Using the latest available Gemini model
  const model = 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000
    }
  };

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google AI Studio error (${res.status}): ${errorBody.slice(0, 200)}`);
  }

  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Google AI Studio returned empty candidate');
  }

  return { text: text.trim(), model: `Google AI Studio (${model})` };
}

/**
 * Call NVIDIA NIM (Llama 3.2 / Nemotron / Mistral / GLM / Kimi)
 */
async function callNvidiaNim(prompt: string, systemPrompt?: string): Promise<{ text: string; model: string }> {
  const apiKey = env.NVIDIA_API_KEY || env.NVIDIA_NIM_KEY || NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA NIM API key not configured (NVIDIA_API_KEY)');

  // Models that are fast and accessible on NVIDIA NIM
  const candidateModels = [
    'meta/llama-3.2-11b-vision-instruct',
    'nvidia/nemotron-3-super-120b-a12b',
    'moonshotai/kimi-k3',
    'z-ai/glm-5.3-flash',
    'mistralai/mistral-large-2-instruct'
  ];

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  let lastError = '';
  for (const model of candidateModels) {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1000,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `Model ${model} returned ${res.status}: ${errText.slice(0, 100)}`;
        continue;
      }

      const data: any = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return { text: text.trim(), model: `NVIDIA NIM (${model})` };
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  throw new Error(`NVIDIA NIM all candidates failed: ${lastError}`);
}

/**
 * Multi-provider unified LLM caller with automated fallback
 */
export async function callLlm(
  prompt: string,
  systemPrompt?: string,
  preferredProvider: AIProvider = 'auto'
): Promise<{ text: string; provider: string; model: string }> {
  const errors: string[] = [];

  // Provider order determination
  let order: ('google-ai' | 'nvidia-nim')[] = [];
  if (preferredProvider === 'nvidia-nim') {
    order = ['nvidia-nim', 'google-ai'];
  } else if (preferredProvider === 'google-ai') {
    order = ['google-ai', 'nvidia-nim'];
  } else {
    // Default 'auto': Google AI Studio first (gemini-3.8-flash is ultra-fast & high quality), fallback to NVIDIA NIM
    order = ['google-ai', 'nvidia-nim'];
  }

  for (const prov of order) {
    try {
      if (prov === 'google-ai') {
        const res = await callGoogleAiStudio(prompt, systemPrompt);
        return { text: res.text, provider: 'Google AI Studio', model: res.model };
      } else {
        const res = await callNvidiaNim(prompt, systemPrompt);
        return { text: res.text, provider: 'NVIDIA NIM', model: res.model };
      }
    } catch (err: any) {
      console.warn(`[AI-Support] Provider ${prov} failed:`, err.message);
      errors.push(`${prov}: ${err.message}`);
    }
  }

  throw new Error(`All configured AI providers failed. (${errors.join(' | ')})`);
}

/**
 * Generate automated response for a bug report.
 * Required format:
 * Case Number: CASE-YYYY-XXXXX
 *
 * Hi [Name/There],
 * [Greetings and triage message]
 * [If important/critical: mention suitable person has been assigned]
 */
export async function generateAutomatedBugReply(params: {
  caseNumber: string;
  bug: BugDetails;
  isImportant: boolean;
  preferredProvider?: AIProvider;
}): Promise<{
  subject: string;
  body: string;
  provider: string;
  model: string;
}> {
  const { caseNumber, bug, isImportant, preferredProvider = 'auto' } = params;
  const reporterName = await resolveGreetingName(bug.email, bug.name?.trim());
  const greeting = reporterName ? `Hi ${reporterName},` : 'Hi there,';
  const bugTitle = (bug.title || 'Reported Issue').trim();
  const severity = (bug.severity || 'normal').toLowerCase();
  const area = bug.affectedArea || 'general application';
  const description = bug.description || 'No description provided';
  const steps = bug.stepsToReproduce || 'None';

  const systemPrompt = `You are Materio's senior technical support assistant.
You provide empathetic, prompt, highly professional, and reassuring email responses to users who submitted bug reports.
You must strictly follow this exact structural format:

Case Number: ${caseNumber}

${greeting}

[Greetings and acknowledgement of the report]
[Discuss their specific issue based on their description, severity, and affected area]
${
  isImportant
    ? '[Inform the user gently that a senior engineering specialist has been specifically assigned to their case and is investigating it with priority.]'
    : '[Reassure them that our engineering team has logged this issue with case number ' + caseNumber + ' and is actively diagnosing it.]'
}
[Invite them to reply directly to this email if they have screenshots, browser details, or more reproduction steps]

Braun,
Materio Support

Style rules:
- Start with "Case Number: ${caseNumber}" followed by an empty line, then "${greeting}".
- Sign off strictly as:
Braun,
Materio Support
Do NOT include any email address in the sign off.
- Never use all-caps screaming words (do not shout words like "HIGH PRIORITY", "URGENT", "CRITICAL", "NOTE", etc.). Use natural, calm sentence casing.
- Do not output markdown code blocks or quotes around the email.
- Keep the tone calm, polite, and reassuring.`;

  const userPrompt = `Generate the automated support reply for the following bug report:
- Case number: ${caseNumber}
- Recipient greeting: ${greeting}
- Reporter email: ${bug.email || 'N/A'}
- Bug title: ${bugTitle}
- Severity: ${severity}
- Affected area: ${area}
- Description: ${description}
- Steps to reproduce: ${steps}
- Priority: ${isImportant ? 'high' : 'standard'}`;

  try {
    const aiResult = await callLlm(userPrompt, systemPrompt, preferredProvider);
    let body = aiResult.text.trim();

    // Sanitize any accidental all-caps screaming words
    body = body
      .replace(/\bHIGH PRIORITY\b/gi, 'high priority')
      .replace(/\bCRITICAL ISSUE\b/gi, 'critical issue')
      .replace(/\bURGENT\b/g, 'urgent')
      .replace(/\bCRITICAL\b/g, 'critical')
      .replace(/\bIMPORTANT NOTE:\b/gi, 'Note:')
      .replace(/\bNOTE:\b/g, 'Note:');

    // Ensure Case Number header is strictly at the top if the model missed it
    if (!body.startsWith('Case Number:')) {
      body = `Case Number: ${caseNumber}\n\n` + body.replace(/^case number[^\n]*\n+/i, '');
    }

    // Ensure greeting is accurate if resolved name exists
    if (reporterName) {
      body = body.replace(/\b(?:Hi|Hello|Dear)\s+[^,\n]+,/i, `Hi ${reporterName},`);
    }

    // Strip any email address
    body = body.replace(/support@getmaterio\.app/gi, '').trim();

    // Ensure clean sign-off strictly at the end without truncating the body paragraphs
    if (!/Braun,?\s*\n\s*Materio Support\s*$/i.test(body)) {
      body = body.replace(/\n+(?:Warm regards|Best regards|Regards|Sincerely|Thanks|Thank you)?[,\s]*(?:Braun,?\s*)?(?:Materio Support)?\s*$/i, '').trim();
      body = `${body}\n\nBraun,\nMaterio Support`;
    }

    const subject = `[Case Number: ${caseNumber}] Re: ${bugTitle}`;
    return {
      subject,
      body,
      provider: aiResult.provider,
      model: aiResult.model
    };
  } catch (err: any) {
    console.error('[AI-Support] Generation failed, using fallback template:', err.message);

    // Reliable fallback template in case both AI services are down
    const assignedLine = isImportant
      ? `A suitable specialist has been assigned to your case and our senior engineering team is investigating this report with high priority.\n\n`
      : `Our engineering team has received your report and is currently reviewing the details.\n\n`;

    const fallbackBody = `Case Number: ${caseNumber}

${greeting}

Thank you for reporting this issue with "${bugTitle}" in ${area}. We appreciate you taking the time to help us keep Materio reliable and bug-free.

${assignedLine}If you have any further context, screenshots, or error logs, simply reply to this email to update your case thread.

Braun,
Materio Support`;

    return {
      subject: `[Case Number: ${caseNumber}] Re: ${bugTitle}`,
      body: fallbackBody,
      provider: 'Fallback Engine',
      model: 'deterministic-template'
    };
  }
}

/**
 * Call TypeSafe AI's System One model "Jev" for rapid, deterministic structured decisions.
 */
export async function makeJevDecisions(stateText: string): Promise<JevDecisionResult | null> {
  const apiKey = env.TYPESAFE_API_KEY || TYPESAFE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: stateText.slice(0, 3000),
        questions: {
          is_bug_report: {
            type: 'noul',
            instructions: 'Is the user reporting a bug, defect, software crash, or broken functionality in the application?'
          },
          is_important: {
            type: 'noul',
            instructions: 'Is this issue high priority, severe, critical, affecting account/payment, or requiring urgent engineer triage?'
          },
          severity: {
            type: 'choice',
            criteria: {
              critical: 'System crash, application unusable, blank screen, or data loss',
              major: 'Core feature broken or unavailable with no simple workaround',
              minor: 'Minor inconvenience, feature works partially',
              cosmetic: 'Visual alignment, layout glitch, typo, or styling defect'
            }
          },
          affected_area: {
            type: 'choice',
            criteria: {
              'pdf-viewer': 'PDF reader, exam viewer, or document display',
              auth: 'Login, signup, authentication, password reset, or session issues',
              search: 'Search bar, filtering, or query results',
              billing: 'Payments, subscriptions, cards, invoices, or billing',
              downloads: 'File downloads, export, or saving data',
              ui: 'General UI, layout, styling, or buttons',
              performance: 'Slow loading, latency, or lag',
              other: 'Any other area or general support inquiry'
            }
          }
        }
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      console.warn('[TypeSafe-Jev] Decision API returned status', res.status);
      return null;
    }

    const data: any = await res.json();
    const answers = data.answers || {};

    const bugProb = answers.is_bug_report?.noul ?? 0;
    const impProb = answers.is_important?.noul ?? 0;
    const severityChoice = (answers.severity?.choice || 'minor') as 'critical' | 'major' | 'minor' | 'cosmetic';
    const areaChoice = answers.affected_area?.choice || 'general';

    return {
      isBugReport: bugProb >= 0.5,
      isImportant: impProb >= 0.5 || severityChoice === 'critical' || severityChoice === 'major',
      severity: severityChoice,
      affectedArea: areaChoice,
      bugProbability: bugProb,
      importanceProbability: impProb,
      model: data.model || 'jev-1.13.0'
    };
  } catch (err: any) {
    console.warn('[TypeSafe-Jev] Decision request error:', err.message);
    return null;
  }
}

/**
 * Analyze an inbound email sent to support@getmaterio.app
 * Leverages TypeSafe AI's Jev for deterministic classification decisions,
 * with Google AI Studio / heuristics as fallback.
 */
export async function analyzeInboundEmail(params: {
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{
  isBugReport: boolean;
  isImportant: boolean;
  existingCaseNumber: string | null;
  extractedTitle: string;
  extractedSeverity: 'critical' | 'major' | 'minor' | 'cosmetic';
  extractedArea: string;
  summary: string;
  decisionEngine?: string;
}> {
  const { from, subject, text } = params;
  const existingCaseNumber = extractCaseNumber(subject) || extractCaseNumber(text);
  const combinedContext = `${subject}\n\n${text}`;

  // 1. Try TypeSafe AI's Jev first for high-speed, typed System One decisions
  const jevResult = await makeJevDecisions(combinedContext);
  if (jevResult) {
    return {
      isBugReport: jevResult.isBugReport,
      isImportant: jevResult.isImportant,
      existingCaseNumber,
      extractedTitle: subject || 'Customer Support Request',
      extractedSeverity: jevResult.severity,
      extractedArea: jevResult.affectedArea,
      summary: (text || subject).slice(0, 160),
      decisionEngine: `TypeSafe AI (${jevResult.model})`
    };
  }

  // 2. Fallback to LLM / Heuristics if TypeSafe Jev is unavailable
  const lowerText = `${subject} ${text}`.toLowerCase();
  const bugKeywords = ['bug', 'crash', 'error', 'broken', 'fails', 'failed', 'cannot login', 'glitch', 'not working', 'stuck', 'issue', 'problem', 'unusable', 'blank screen'];
  const importantKeywords = ['urgent', 'emergency', 'asap', 'critical', 'payment', 'charged', 'refund', 'data loss', 'down', 'breach', 'security', 'enterprise', 'cannot access'];

  const hasBugKeyword = bugKeywords.some((k) => lowerText.includes(k));
  const hasImportantKeyword = importantKeywords.some((k) => lowerText.includes(k));

  try {
    const prompt = `Analyze this customer support email received at support@getmaterio.app.
Sender: ${from}
Subject: ${subject}
Body:
${text.slice(0, 2000)}

Respond strictly in valid JSON format with the following fields:
{
  "isBugReport": boolean (true if the user is reporting a malfunction, glitch, error, or defect in the software),
  "isImportant": boolean (true if critical severity, service unavailable, payment/account issue, data loss, or high urgency),
  "extractedTitle": string (a concise 5-10 word title summarizing the user issue),
  "extractedSeverity": "critical" | "major" | "minor" | "cosmetic",
  "extractedArea": string (e.g. "auth", "pdf-viewer", "billing", "search", "downloads", "ui", "general"),
  "summary": string (1-2 sentence technical summary of the inquiry)
}`;

    const res = await callLlm(prompt, 'You are an email triage classifier. Respond ONLY with valid raw JSON, with no markdown code fences.', 'google-ai');
    const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      isBugReport: typeof parsed.isBugReport === 'boolean' ? parsed.isBugReport : hasBugKeyword,
      isImportant: typeof parsed.isImportant === 'boolean' ? parsed.isImportant : hasImportantKeyword,
      existingCaseNumber,
      extractedTitle: parsed.extractedTitle || subject || 'Customer Inquiry',
      extractedSeverity: ['critical', 'major', 'minor', 'cosmetic'].includes(parsed.extractedSeverity) ? parsed.extractedSeverity : 'minor',
      extractedArea: parsed.extractedArea || 'general',
      summary: parsed.summary || subject,
      decisionEngine: res.provider
    };
  } catch (err: any) {
    console.warn('[AI-Support] Inbound email analysis fallback:', err.message);
    return {
      isBugReport: hasBugKeyword,
      isImportant: hasImportantKeyword,
      existingCaseNumber,
      extractedTitle: subject || 'Customer Support Request',
      extractedSeverity: hasImportantKeyword ? 'major' : 'minor',
      extractedArea: 'general',
      summary: (text || subject).slice(0, 150),
      decisionEngine: 'Keyword Heuristics'
    };
  }
}

/**
 * Generate a drafted reply continuing an existing conversation thread
 */
export async function draftThreadReply(params: {
  thread: ThreadMessage[];
  caseNumber: string;
  reporterName?: string;
  reporterEmail?: string;
  instruction?: string;
  preferredProvider?: AIProvider;
}): Promise<{ draft: string; provider: string; model: string }> {
  const { thread, caseNumber, reporterName, reporterEmail, instruction, preferredProvider = 'auto' } = params;

  const resolvedName = await resolveGreetingName(reporterEmail, reporterName);
  const greeting = resolvedName ? `Hi ${resolvedName},` : 'Hi there,';

  const formattedThread = thread
    .map((m) => `[${m.direction === 'inbound' ? 'Customer' : 'Materio Support'}] (${m.createdAt || 'recent'}):\n${m.text}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are Materio's customer support assistant assisting a support engineer.
Draft a polite, helpful, technical, and concise follow-up reply for this conversation thread.
Reference the case number: ${caseNumber}.
Start the email greeting with: "${greeting}".
${instruction ? `Follow these specific admin instructions: "${instruction}".` : 'Provide a helpful status update or answer to the customer.'}
Never use all-caps screaming words (do not shout words like 'HIGH PRIORITY', 'URGENT', 'CRITICAL', 'NOTE', etc.). Use natural, calm sentence casing.
Sign off strictly with:
Braun,
Materio Support
Do NOT include any email address in the sign off.`;

  const prompt = `Conversation history for Case ${caseNumber}:
${formattedThread}

Draft a response to ${resolvedName || 'the customer'} (greeting: "${greeting}"):`;

  const aiResult = await callLlm(prompt, systemPrompt, preferredProvider);
  let draft = aiResult.text.trim();

  // Sanitize any accidental all-caps screaming words
  draft = draft
    .replace(/\bHIGH PRIORITY\b/gi, 'high priority')
    .replace(/\bCRITICAL ISSUE\b/gi, 'critical issue')
    .replace(/\bURGENT\b/g, 'urgent')
    .replace(/\bCRITICAL\b/g, 'critical')
    .replace(/\bIMPORTANT NOTE:\b/gi, 'Note:')
    .replace(/\bNOTE:\b/g, 'Note:');

  // Ensure greeting is accurate if resolved name exists
  if (resolvedName) {
    draft = draft.replace(/\b(?:Hi|Hello|Dear)\s+[^,\n]+,/i, `Hi ${resolvedName},`);
  }

  if (!draft.toLowerCase().startsWith('case number:')) {
    draft = `Case Number: ${caseNumber}\n\n${draft}`;
  }

  return {
    draft,
    provider: aiResult.provider,
    model: aiResult.model
  };
}
