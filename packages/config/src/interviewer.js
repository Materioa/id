/**
 * Materio Interviewer — shared templates, field extraction and LLM helpers.
 *
 * Collections:
 * - form_configs:      { id, kind: 'form'|'wizard'|'interview', title, description, icon,
 *                        context, published, fields[], steps[], interview{}, triggers{}, updatedAt }
 * - interviewer_sessions (transcripts): { sessionId, formId, messages[], extracted{}, skipped[],
 *                        status: 'in_progress'|'completed'|'skipped', examContext{}, createdAt, updatedAt }
 * - form_responses (NEW — final structured answers): { formId, kind, sessionId, values{}, skipped[],
 *                        status, userId, examContext{}, createdAt, updatedAt }
 *
 * Wizard `steps` migrate the parent Jekyll wizard pages
 * (assets/data/forms-config.json -> forms.*.wizard.pages: cover | info | form).
 */

export const INTERVIEWER_COLLECTIONS = {
  configs: 'form_configs',
  sessions: 'interviewer_sessions',
  responses: 'form_responses',
  activity: 'form_activity'
};

function ts() {
  return new Date().toISOString();
}

/**
 * Two presentation modes (mirrors the parent site):
 * - popup:     promo-styled popup wizard on the site (cover/info pages + form)
 * - interview: conversational chat page that fills the fields itself
 * Legacy values 'wizard' and 'form' are treated as popup.
 */
export const POPUP_KINDS = ['popup', 'wizard', 'form'];

export function isPopupKind(kind) {
  return POPUP_KINDS.includes(kind || 'popup');
}

export function normaliseKind(kind) {
  return kind === 'interview' ? 'interview' : 'popup';
}

export function blankInterview(extra = {}) {
  return {
    openingQuestion: '',
    systemPrompt: '',
    skipAllowed: true,
    asyncSubmit: true,
    completeMessage: 'Thanks — your response has been recorded.',
    ...extra
  };
}

/**
 * Interviewer-style templates (conversational chat pages).
 */
export function getInterviewerTemplates() {
  return [
    {
      id: 'viva-question-bank',
      kind: 'interview',
      title: 'Viva question bank',
      description: 'Collect practical and viva questions from the community in natural language.',
      icon: 'chat',
      context: 'viva',
      published: true,
      fields: [
        { name: 'question', label: 'Question', type: 'textarea', required: true },
        { name: 'subject', label: 'Subject or topic', type: 'text', required: true },
        { name: 'difficulty', label: 'Difficulty', type: 'select', options: ['Easy', 'Moderate', 'Challenging'] },
        { name: 'notes', label: 'Helpful notes', type: 'textarea', required: false }
      ],
      steps: [],
      confirmations: [],
      submitButton: { text: 'Send', icon: '' },
      interview: blankInterview({
        openingQuestion: 'Which viva or practical question would you like to share with the community today?',
        systemPrompt: 'You collect viva/practical exam questions. Ask one focused follow-up at a time until the question, subject/topic and difficulty are known. Keep replies under 40 words.',
        skipAllowed: true,
        completeMessage: 'Thanks — your question is queued for the viva box.'
      }),
      triggers: { examTypes: ['viva', 'practical'], autoShow: true },
      updatedAt: ts()
    },
    {
      id: 'crew-intake',
      kind: 'interview',
      title: 'Join the crew',
      description: 'One application for volunteers, curators and stewards — pick a role and tell us why.',
      icon: 'users',
      context: 'recruiting',
      published: false,
      fields: [
        { name: 'name', label: 'Full name', type: 'text', required: true },
        { name: 'semester', label: 'Semester', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7', '8'], required: true },
        { name: 'role', label: 'Role', type: 'select', options: ['Volunteer', 'Curator', 'Steward'], required: true },
        { name: 'motivation', label: 'Why do you want to join?', type: 'textarea', required: true },
        { name: 'availability', label: 'Weekly availability', type: 'text', required: false }
      ],
      steps: [],
      confirmations: [],
      submitButton: { text: 'Send', icon: '' },
      interview: blankInterview({
        openingQuestion: 'Hi! Which role catches your eye — volunteer, curator or steward — and what draws you to it?',
        systemPrompt: 'You recruit crew members. Be warm and brief. Collect name, semester, role (volunteer, curator or steward), motivation and availability. Ask one short question at a time.',
        skipAllowed: true,
        completeMessage: 'Thanks for applying — the team will reach out soon.'
      }),
      triggers: { examTypes: [], autoShow: false },
      updatedAt: ts()
    }
  ];
}

/**
 * Faithful port of the parent Jekyll configs (assets/data/forms-config.json).
 * Extra parent-only keys are preserved verbatim so nothing is lost:
 * fields[]: placeholder, hint, minLength, maxLength, min, max, showWhen,
 *   allowOther, otherPlaceholder, accept, multiple, maxSize, maxSizeLabel,
 *   dynamicSubject, dynamicFromSemester, defaultValue, options as {value,label}
 * doc: confirmations[], submitButton{}, fileUpload{}, requiresAuth, legacy.
 * Seeded as drafts (published:false) for admin review.
 */
export function getParentFormTemplates() {
  return [
    {
      id: 'contribution',
      kind: 'popup',
      title: 'Community Contributions',
      description: "Help grow materio's content library by contributing your study materials",
      icon: 'fa-solid fa-users',
      context: 'curation',
      published: false,
      legacy: 'parent-v4',
      requiresAuth: false,
      steps: [
        { id: 'cover', type: 'cover', title: 'Share Your Knowledge', subtitle: 'Help fellow students succeed', icon: 'fa-solid fa-gift', nextButton: { text: 'Get Started', icon: 'fa-arrow-right' } },
        { id: 'explain', type: 'info', title: 'Why Contribute?', content: ['Your notes could help hundreds of students ace their exams', { title: 'Help Community', description: 'Be part of something bigger than yourself' }], continueButton: { text: 'Continue', icon: 'fa-arrow-right' }, exitButton: { text: 'Maybe Later', icon: '' } },
        { id: 'form', type: 'form', title: 'Upload Materials', description: 'Fill in the details and upload your files' }
      ],
      fields: [
        { name: 'userIdentity', type: 'select', label: 'How would you like to be identified?', required: true, defaultValue: 'anonymous', options: [{ value: 'authenticated', label: 'Materio Account' }, { value: 'github', label: 'Github' }, { value: 'anonymous', label: 'Stay Anonymous' }] },
        { name: 'githubUsername', type: 'text', label: 'GitHub Username', placeholder: 'Enter your GitHub username', required: false, showWhen: { field: 'userIdentity', value: 'github' } },
        { name: 'semester', type: 'select', label: 'Semester', required: true, dynamicSubject: true, options: [{ value: '1', label: 'Semester 1' }, { value: '2', label: 'Semester 2' }, { value: '3', label: 'Semester 3' }, { value: '4', label: 'Semester 4' }, { value: '5', label: 'Semester 5' }, { value: '6', label: 'Semester 6' }, { value: '7', label: 'Semester 7' }, { value: '8', label: 'Semester 8' }, { value: '9', label: 'Miscellaneous' }] },
        { name: 'subject', type: 'select', label: 'Subject', required: true, dynamicFromSemester: true, allowOther: true, otherPlaceholder: 'Enter subject name' },
        { name: 'category', type: 'select', label: 'Category', required: true, allowOther: true, otherPlaceholder: 'Enter category name', options: [{ value: 'Chapters', label: 'Chapters' }, { value: 'Presentations', label: 'Presentations' }, { value: 'Assignments', label: 'Assignments' }, { value: 'Question Banks', label: 'Question Banks' }, { value: 'Lab', label: 'Lab' }, { value: 'Previous Year Papers', label: 'Previous Year Papers' }, { value: 'Reference Books', label: 'Reference Books' }, { value: 'Lecture Notes', label: 'Lecture Notes' }, { value: 'Handwritten Notes', label: 'Handwritten Notes' }, { value: 'NPTEL Book', label: 'NPTEL Book' }, { value: 'NPTEL Assignment with Solutions', label: 'NPTEL Assignment with Solutions' }, { value: 'NPTEL Weekly Materials', label: 'NPTEL Weekly Materials' }, { value: 'Other', label: 'Other' }] },
        { name: 'files', type: 'file', label: 'Upload Files', required: true, accept: '.pdf', multiple: true, maxSize: 6291456, maxSizeLabel: '6MB', hint: 'PDF files only. Total size must not exceed 6MB.' }
      ],
      confirmations: [{ name: 'accuracyConfirm', label: "I confirm that the information and files I'm providing are accurate and appropriate for educational purposes", required: true }],
      submitButton: { text: 'Submit Contribution', icon: '' },
      fileUpload: { enabled: true, uploadToGitHub: true, repository: 'Materioa/static', branch: 'main', basePath: 'pdfs' },
      interview: blankInterview({
        openingQuestion: 'What study material would you like to contribute? Describe it in your own words.',
        systemPrompt: 'You intake community content contributions. Collect how the user wants to be identified, semester, subject and category. File uploads happen separately, so do not ask for files.',
        completeMessage: 'Thanks — your contribution details are recorded.'
      }),
      triggers: { examTypes: [], autoShow: false },
      updatedAt: ts()
    },
    {
      id: 'feedback',
      kind: 'popup',
      title: 'Share Feedback',
      description: 'Help us improve Materio with your valuable feedback',
      icon: 'fa-comment-dots',
      context: 'general',
      published: false,
      legacy: 'parent-v4',
      requiresAuth: false,
      steps: [],
      fields: [
        { name: 'category', type: 'select', label: 'Feedback Category', required: true, options: [{ value: 'bug', label: 'Bug Report' }, { value: 'feature', label: 'Feature Request' }, { value: 'ui-ux', label: 'UI/UX Improvement' }, { value: 'performance', label: 'Performance Issue' }, { value: 'content', label: 'Content Request' }, { value: 'other', label: 'Other' }] },
        { name: 'rating', type: 'rating', label: 'How would you rate your experience?', required: true, max: 5 },
        { name: 'message', type: 'textarea', label: 'Your Feedback', placeholder: "Tell us what's on your mind...", required: true, minLength: 10, maxLength: 2000 },
        { name: 'email', type: 'email', label: 'Email (optional)', placeholder: 'your@email.com', required: false, hint: "Provide your email if you'd like us to follow up" }
      ],
      confirmations: [],
      submitButton: { text: 'Submit Feedback', icon: 'fa-paper-plane' },
      interview: blankInterview({
        openingQuestion: "What's on your mind? Tell me your feedback in your own words.",
        systemPrompt: 'You collect product feedback. Determine the category (bug, feature, ui-ux, performance, content, other), an experience rating out of 5, and the message. Keep replies short.',
        completeMessage: 'Thanks — your feedback has been recorded.'
      }),
      triggers: { examTypes: [], autoShow: false },
      updatedAt: ts()
    },
    {
      id: 'beta-review',
      kind: 'popup',
      title: 'Beta Tester Review',
      description: 'Share your experience testing new features',
      icon: 'fa-flask',
      context: 'general',
      published: false,
      legacy: 'parent-v4',
      requiresAuth: true,
      steps: [],
      fields: [
        { name: 'feature', type: 'select', label: 'Feature Tested', required: true, options: [{ value: 'dynamic-forms', label: 'Dynamic Forms System' }, { value: 'ai-search', label: 'AI Search' }, { value: 'insightroom', label: 'Insightroom Feed' }, { value: 'local-cdn', label: 'Local CDN' }, { value: 'pdf-viewer', label: 'PDF Viewer' }, { value: 'other', label: 'Other Feature' }] },
        { name: 'rating', type: 'rating', label: 'Overall Rating', required: true, max: 5 },
        { name: 'bugs', type: 'textarea', label: 'Bugs Found', placeholder: 'Describe any bugs or issues you encountered...', required: false, maxLength: 2000 },
        { name: 'suggestions', type: 'textarea', label: 'Suggestions', placeholder: 'Any suggestions for improvement?', required: false, maxLength: 2000 }
      ],
      confirmations: [{ name: 'betaTerms', label: 'I understand that beta features may have bugs and agree to provide constructive feedback', required: true }],
      submitButton: { text: 'Submit Review', icon: 'fa-check' },
      interview: blankInterview({
        openingQuestion: 'Which beta feature did you test? Tell me how it went.',
        systemPrompt: 'You collect beta tester reviews. The user must be signed in. Collect the feature tested, an overall rating out of 5, bugs found and suggestions. Keep replies short.',
        completeMessage: 'Thanks — your beta review has been recorded.'
      }),
      triggers: { examTypes: [], autoShow: false },
      updatedAt: ts()
    },
    {
      id: 'satisfaction',
      kind: 'popup',
      title: 'Quick Feedback',
      description: "We'd love to hear how you're enjoying Materio!",
      icon: 'fa-heart',
      context: 'general',
      published: false,
      legacy: 'parent-v4',
      requiresAuth: false,
      steps: [],
      fields: [
        { name: 'rating', type: 'rating', label: 'How are you enjoying Materio?', required: true, max: 5 },
        { name: 'comment', type: 'textarea', label: "Anything else you'd like to share? (optional)", placeholder: 'Your thoughts help us improve...', required: false, maxLength: 500 }
      ],
      confirmations: [],
      submitButton: { text: 'Send Feedback', icon: '' },
      interview: blankInterview({
        openingQuestion: 'How are you enjoying Materio so far?',
        systemPrompt: 'You collect a quick satisfaction pulse: a rating out of 5 and an optional comment. Be warm and very brief.',
        completeMessage: 'Thanks for the quick feedback!'
      }),
      triggers: { examTypes: [], autoShow: false },
      updatedAt: ts()
    },
    {
      id: 'bug-report',
      kind: 'popup',
      title: 'Report a Bug',
      description: 'Help us squash bugs by reporting issues you encounter',
      icon: 'fa-bug',
      context: 'general',
      published: false,
      legacy: 'parent-v4',
      requiresAuth: false,
      steps: [],
      fields: [
        { name: 'title', type: 'text', label: 'Bug Title', placeholder: 'Brief description of the issue', required: true, minLength: 5, maxLength: 150 },
        { name: 'severity', type: 'select', label: 'Severity', required: true, options: [{ value: 'critical', label: 'Critical - App is unusable' }, { value: 'major', label: 'Major - Feature broken' }, { value: 'minor', label: 'Minor - Small issue' }, { value: 'cosmetic', label: 'Cosmetic - Visual glitch' }] },
        { name: 'affectedArea', type: 'select', label: 'Affected Area', required: true, options: [{ value: 'pdf-viewer', label: 'PDF Viewer' }, { value: 'search', label: 'Search' }, { value: 'navigation', label: 'Navigation' }, { value: 'downloads', label: 'Downloads' }, { value: 'auth', label: 'Login / Account' }, { value: 'ai-features', label: 'AI Features' }, { value: 'ui', label: 'UI / Layout' }, { value: 'performance', label: 'Performance' }, { value: 'other', label: 'Other' }] },
        { name: 'description', type: 'textarea', label: 'What happened?', placeholder: 'Describe the bug in detail. What did you expect to happen vs what actually happened?', required: true, minLength: 20, maxLength: 3000 },
        { name: 'stepsToReproduce', type: 'textarea', label: 'Steps to Reproduce (optional)', placeholder: '1. Go to...\n2. Click on...\n3. See error...', required: false, maxLength: 2000 },
        { name: 'email', type: 'email', label: 'Email (optional)', placeholder: 'your@email.com', required: false, hint: "We'll notify you when the bug is fixed" }
      ],
      confirmations: [{ name: 'accuracyConfirm', label: 'I confirm this is a genuine bug report and not a duplicate', required: true }],
      submitButton: { text: 'Submit Bug Report', icon: 'fa-bug' },
      interview: blankInterview({
        openingQuestion: 'What went wrong? Describe the bug in your own words.',
        systemPrompt: 'You triage bug reports. Collect a short title, severity (critical/major/minor/cosmetic), affected area and a detailed description. Ask one focused follow-up at a time.',
        completeMessage: 'Thanks — your bug report has been recorded.'
      }),
      triggers: { examTypes: [], autoShow: false },
      updatedAt: ts()
    }
  ];
}

/**
 * Faithful port of assets/data/formActivity.json — auto-trigger rules that decide
 * when a form surfaces (pageLoad + delay + visit/page/audience conditions + frequency).
 * Stored as a single doc in the form_activity collection.
 */
export function getFormActivityDefaults() {
  return {
    enabled: true,
    activities: [
      { id: 'satisfaction-survey', enabled: false, formId: 'satisfaction', trigger: { type: 'pageLoad', delay: 3000, conditions: { minVisits: 3, minDaysSinceFirstVisit: 0, pages: ['home'], excludePages: [], userType: 'any' } }, frequency: 'every-30days', customFrequencyHours: null, showOn: 'all', startDate: null, endDate: null, priority: 1, lastUpdated: '2026-01-01T00:00:00Z' },
      { id: 'contribution-reminder', enabled: false, formId: 'contribution', trigger: { type: 'pageLoad', delay: 0, conditions: { minVisits: 1, minDaysSinceFirstVisit: 0, pages: ['home'], excludePages: [], userType: 'any' } }, frequency: 'daily', customFrequencyHours: null, showOn: 'all', startDate: null, endDate: null, priority: 2, lastUpdated: '2026-01-01T00:00:00Z' },
      { id: 'feedback-request', enabled: false, formId: 'feedback', trigger: { type: 'pageLoad', delay: 30000, conditions: { minVisits: 10, minDaysSinceFirstVisit: 7, pages: [], excludePages: ['account'], userType: 'authenticated' } }, frequency: 'every-30days', customFrequencyHours: null, showOn: 'all', startDate: null, endDate: null, priority: 3, lastUpdated: '2026-01-01T00:00:00Z' },
      { id: 'beta-review-invite', enabled: false, formId: 'beta-review', trigger: { type: 'pageLoad', delay: 3000, conditions: { minVisits: 1, minDaysSinceFirstVisit: 0, pages: ['home'], excludePages: [], userType: 'any' } }, frequency: 'once', customFrequencyHours: null, showOn: 'all', startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z', priority: 4, lastUpdated: '2026-01-01T00:00:00Z' }
    ],
    settings: { maxFormsPerSession: 1, minTimeBetweenForms: 300000, respectDoNotDisturb: true, doNotDisturbKey: 'materio_dnd_forms' },
    updatedAt: ts()
  };
}

export function normaliseText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Regex fallback when no LLM key is configured.
 * @param {string} text
 * @param {Array<any>} [fields]
 * @returns {Record<string, string>}
 */
export function extractFieldsRegex(text, fields = []) {
  const answer = normaliseText(text);
  const values = {};
  for (const field of fields) {
    const label = String(field.label || field.name || '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!label) continue;
    const match = answer.match(new RegExp(`${label}\\s*(?:is|:|-)?\\s*([^.;]+)`, 'i'));
    if (match && match[1].trim()) values[field.name] = match[1].trim();
  }
  if (fields[0] && !values[fields[0].name] && answer) values[fields[0].name] = answer;
  if (fields.some((f) => f.name === 'subject') && !values.subject) {
    const m = answer.match(/(?:on|about|for)\s+([A-Za-z0-9 &'/-]+?)(?:[,.]|$)/i);
    if (m) values.subject = m[1].trim();
  }
  const diff = answer.match(/\b(easy|moderate|challenging|hard|tough)\b/i);
  if (diff && fields.some((f) => f.name === 'difficulty')) {
    const d = diff[1].toLowerCase();
    values.difficulty = d === 'hard' || d === 'tough' ? 'Challenging' : d.charAt(0).toUpperCase() + d.slice(1);
  }
  return values;
}

/** Next unanswered required field, skipping user-skipped ones. */
export function nextOpenField(form, extracted = {}, skipped = []) {
  const fields = form?.fields || [];
  return fields.find((f) => f.required && !extracted[f.name] && !skipped.includes(f.name)) || null;
}

function schemaFor(fields = []) {
  return fields.map((f) => ({ name: f.name, label: f.label, type: f.type, required: !!f.required, options: f.options || [] }));
}

/**
 * Ask an OpenRouter-compatible LLM to extract structured values + draft the next question.
 * Returns { extracted, reply }. Throws on network error so callers can fall back to regex.
 */
export async function extractWithLlm({ apiKey, model, form, history, latestText, baseUrl }) {
  const endpoint = `${String(baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`;
  const field = nextOpenField(form, {});
  const system = [
    (form?.interview?.systemPrompt || 'You turn natural-language answers into structured form values. Be concise.'),
    `Form fields JSON schema: ${JSON.stringify(schemaFor(form?.fields))}.`,
    'Reply ONLY as JSON: {"extracted": {field: value}, "reply": "next short question or acknowledgement"}.',
    history?.extracted ? `Already known: ${JSON.stringify(history.extracted)}. Do not re-ask for these.` : '',
    field ? `Focus on collecting: ${field.label}.` : 'All required fields look complete; confirm and close.'
  ].filter(Boolean).join('\n');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://getmaterio.app', 'X-Title': 'Materio Interviewer' },
    body: JSON.stringify({
      model: model || 'google/gemini-2.0-flash-exp:free',
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        ...(history?.messages || []).slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 1000) })),
        { role: 'user', content: latestText }
      ]
    })
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('LLM non-JSON reply');
  const parsed = JSON.parse(raw.slice(start, end + 1));
  return { extracted: parsed.extracted || {}, reply: parsed.reply || '' };
}
