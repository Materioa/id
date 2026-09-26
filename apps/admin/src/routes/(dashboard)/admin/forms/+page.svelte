<svelte:head><title>Forms & Wizards</title></svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { makeAdminRequest } from '$lib/api/admin';
  import { addToast } from '$lib/stores/toast';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Folder01Icon, Add01Icon, Delete01Icon, Edit01Icon, SaveIcon, RefreshIcon, ViewIcon, CheckmarkCircle01Icon, Comment01Icon, Mail01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
  import Modal from '$lib/components/Modal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';

  type Field = { name: string; label: string; type: string; required?: boolean; options?: any[]; placeholder?: string; hint?: string; minLength?: number; maxLength?: number; accept?: string };
  type Step = { id: string; type: string; title: string; subtitle?: string; content?: string[]; description?: string };
  type Doc = {
    id: string; kind: 'popup' | 'interview'; title: string; description: string; icon: string;
    context: string; published?: boolean; fields: Field[]; steps: Step[];
    confirmations: { name: string; label: string; required?: boolean }[];
    submitButton: { text: string; icon: string };
    fileUpload?: any; requiresAuth?: boolean; legacy?: string | null;
    interview: { openingQuestion: string; systemPrompt: string; skipAllowed: boolean; asyncSubmit: boolean; completeMessage: string };
    triggers: { examTypes: string[]; autoShow: boolean };
    updatedAt?: string;
  };
  type Response = { id: string; formId: string; kind?: string; sessionId?: string; userId?: string; username?: string; userEmail?: string; values?: Record<string, string>; skipped?: string[]; status?: string; reviewed?: boolean; examContext?: any; updatedAt?: string };
  type Session = { id: string; sessionId?: string; formId: string; status?: string; messages?: { role: string; content: string }[]; extracted?: Record<string, string>; updatedAt?: string };
  type Row = { key: string; source: 'chat' | 'popup' | 'bug'; id: string; formId: string; excerpt: string; status: string; reviewed: boolean; email: string; date: string; answers: [string, string][]; skipped: string[]; files: any[]; who: [string, string][]; raw: any };
  const REVIEW_STATUS = ['Reviewed', 'Uploaded', 'Invalid', 'Duplicate', 'Needs reply'];
  const FRESH_STATUS = ['pending', 'open', 'completed', 'done', 'in_progress', ''];
  function isFresh(r: { reviewed: boolean; status: string }) { return !r.reviewed && FRESH_STATUS.includes(r.status || ''); }
  type Rule = { id: string; enabled: boolean; formId: string; trigger: { type: string; delay: number; conditions: { minVisits: number; minDaysSinceFirstVisit: number; pages: string[]; excludePages: string[]; userType: string } }; frequency: string; customFrequencyHours: any; showOn: string; startDate: any; endDate: any; priority: number };

  let docs = $state<Doc[]>([]);
  let sessions = $state<Session[]>([]);
  let responses = $state<Response[]>([]);
  let submissions = $state<any[]>([]);
  let bugs = $state<any[]>([]);
  let templates = $state<Doc[]>([]);
  let activity = $state<{ enabled: boolean; activities: Rule[]; settings: any }>({ enabled: true, activities: [], settings: {} });

  let activeTab = $state<'popups' | 'interviews' | 'responses'>('popups');
  let search = $state('');
  let statusFilter = $state<'all' | 'live' | 'draft'>('all');
  let isLoading = $state(true);
  let isSaving = $state(false);

  let showEditor = $state(false);
  let pickStep = $state<'pick' | 'edit'>('pick');
  let editorTab = $state('basics');
  let editing = $state<Doc | null>(null);
  let editingRule = $state<Rule | null>(null);
  let isNew = $state(false);
  let deleteTarget = $state<Doc | null>(null);
  let confirmDeleteOpen = $state(false);
  let deleteResponseTarget = $state<Row | null>(null);
  let confirmDeleteResponseOpen = $state(false);
  let detailResponse = $state<Row | null>(null);
  let detailOpen = $state(false);
  let previewDoc = $state<Doc | null>(null);
  let previewOpen = $state(false);

  const contexts = ['general', 'viva', 'practical', 'recruiting', 'curation'];
  const fieldTypes = ['text', 'textarea', 'email', 'select', 'rating', 'file'];

  function normKind(t: any): 'popup' | 'interview' { return t?.kind === 'interview' ? 'interview' : 'popup'; }

  async function load() {
    isLoading = true;
    try {
      const data: any = await makeAdminRequest('forms', 'GET');
      docs = (data.forms || []).map((f: any) => ({ ...f, kind: normKind(f) }));
      sessions = data.sessions || [];
      responses = data.responses || [];
      submissions = data.submissions || [];
      bugs = data.bugs || [];
      templates = (data.templates || []).map((t: any) => ({ ...t, kind: normKind(t) }));
      if (data.activity) activity = { enabled: data.activity.enabled !== false, activities: data.activity.activities || [], settings: data.activity.settings || {} };
      if (!selectedSection) {
        const first = docs.find((d) => responses.some((r) => r.formId === d.id) || submissions.some((s) => s.formType === d.id))?.id;
        selectedSection = first || (bugs.length ? 'bug-report' : '');
      }
    } catch (e: any) { addToast(e.message || 'Unable to load', 'error'); }
    finally { isLoading = false; }
  }
  onMount(load);

  let wantKind = $derived(activeTab === 'interviews' ? 'interview' : 'popup');
  let visibleDocs = $derived.by(() => docs.filter((d) => {
    if (d.kind !== wantKind) return false;
    if (statusFilter === 'live' && d.published !== true) return false;
    if (statusFilter === 'draft' && d.published === true) return false;
    if (search && !(d.title + ' ' + d.description).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }));
  let allRows = $derived.by<Row[]>(() => {
    const rows: Row[] = [];
    const filesOf = (obj: any) => Array.isArray(obj?.files) ? obj.files : [];
    for (const r of responses) {
      if (!r.formId) continue;
      const vals = r.values || {};
      const ans = Object.entries(vals).map(([k, v]) => [fieldLabel(r.formId, k), String(v)] as [string, string]);
      const who: [string, string][] = [];
      if (r.username) who.push(['Name', String(r.username)]);
      who.push(['Signed in', r.userId ? 'Yes' : 'No']);
      if (r.userId) who.push(['Account ID', String(r.userId)]);
      if (r.sessionId) who.push(['Chat session', String(r.sessionId)]);
      rows.push({ key: `chat-${r.id}`, source: 'chat', id: r.id, formId: r.formId, excerpt: ans.length ? `${ans[0][0]}: ${ans[0][1]}`.slice(0, 120) : 'No answers yet', status: r.status || 'done', reviewed: r.reviewed === true, email: String(vals.email || vals.contact || r.userEmail || ''), date: r.updatedAt || '', answers: ans, skipped: r.skipped || [], files: filesOf(vals), who, raw: r });
    }
    for (const s of submissions) {
      if (!s.formType) continue;
      const d = s.data || {};
      const ans = Object.entries(d).filter(([k]) => k !== 'files').map(([k, v]) => [fieldLabel(s.formType, k), typeof v === 'object' ? JSON.stringify(v) : String(v)] as [string, string]);
      const u = s.user || {};
      const who: [string, string][] = [];
      if (u.displayName || u.username) who.push(['Name', String(u.displayName || u.username)]);
      who.push(['Signed in', u.type === 'authenticated' ? 'Yes' : 'No']);
      if (u.githubUsername) who.push(['GitHub', String(u.githubUsername)]);
      if (u.userId) who.push(['Account ID', String(u.userId)]);
      rows.push({ key: `popup-${s.id}`, source: 'popup', id: s.id, formId: s.formType, excerpt: ans.length ? `${ans[0][0]}: ${ans[0][1]}`.slice(0, 120) : 'No answers yet', status: s.status || 'pending', reviewed: s.reviewed === true, email: String(u.email || d.email || ''), date: s.submittedAt || '', answers: ans, skipped: [], files: filesOf(d), who, raw: s });
    }
    for (const b of bugs) {
      const who: [string, string][] = [];
      if (b.meta?.sessionId) who.push(['Session', String(b.meta.sessionId)]);
      rows.push({ key: `bug-${b.id}`, source: 'bug', id: b.id, formId: 'bug-report', excerpt: b.title ? `Title: ${b.title}`.slice(0, 120) : 'No answers yet', status: b.status || 'open', reviewed: b.reviewed === true, email: String(b.email || ''), date: b.reportedAt || '', answers: [['Severity', String(b.severity || '')], ['Area', String(b.affectedArea || '')], ['What happened', String(b.description || '')], ['Steps', String(b.stepsToReproduce || '—')]], skipped: [], files: [], who, raw: b });
    }
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  });
  let filesOnly = $state(false);
  let selectedSection = $state('');
  let statusSel = $state('');
  let customStatus = $state('');
  let sections = $derived.by(() => {
    const ids: string[] = [];
    for (const d of docs) if (d.id) ids.push(d.id);
    for (const r of allRows) if (r.formId && !ids.includes(r.formId)) ids.push(r.formId);
    return ids.map((id) => {
      const mine = allRows.filter((r) => r.formId === id);
      const doc = docs.find((d) => d.id === id);
      const kind = doc ? (doc.kind === 'popup' ? 'Pop-up' : 'Chat') : (mine[0]?.source === 'bug' ? 'Bug report' : mine[0]?.source === 'chat' ? 'Chat' : 'Pop-up');
      return { id, title: docTitle(id), kind, total: mine.length, fresh: mine.filter((r) => !r.reviewed).length, rows: mine.filter((r) => !filesOnly || r.files.length > 0) };
    }).filter((s) => s.total > 0);
  });
  let newCounts = $derived.by(() => {
    const m = new Map<string, number>();
    for (const r of allRows) {
      if (isFresh(r)) m.set(r.formId, (m.get(r.formId) || 0) + 1);
    }
    return m;
  });
  let visibleSectionRows = $derived.by(() => {
    const sec = sections.find((s) => s.id === selectedSection) || sections[0];
    if (!sec) return [];
    return sec.rows;
  });
  let totalNew = $derived([...newCounts.values()].reduce((a, b) => a + b, 0));
  let popupTemplates = $derived(templates.filter((t) => t.kind === 'popup'));
  let interviewTemplates = $derived(templates.filter((t) => t.kind === 'interview'));

  function blankDoc(kind: 'popup' | 'interview'): Doc {
    return {
      id: `${kind}-${Date.now()}`, kind,
      title: kind === 'popup' ? 'New pop-up' : 'New chat interview',
      description: '', icon: '', context: 'general', published: false,
      fields: [{ name: 'response', label: 'Response', type: 'textarea', required: true }],
      steps: kind === 'popup' ? [{ id: 'cover', type: 'cover', title: 'Welcome', subtitle: 'A couple of quick questions' }] : [],
      confirmations: [],
      submitButton: { text: kind === 'popup' ? 'Submit' : 'Send', icon: '' },
      fileUpload: { enabled: false },
      requiresAuth: false,
      legacy: null,
      interview: { openingQuestion: '', systemPrompt: '', skipAllowed: true, asyncSubmit: true, completeMessage: 'Thanks — your response has been recorded.' },
      triggers: { examTypes: [], autoShow: false }
    };
  }

  function openCreate() { pickStep = 'pick'; editing = null; editorTab = 'basics'; showEditor = true; }
  function plain<T>(v: T): T {
    // $state proxies can't go through structuredClone directly — snapshot first.
    try {
      const snap = $state.snapshot(v);
      return JSON.parse(JSON.stringify(snap));
    } catch (e: any) {
      addToast('Could not open this entry', 'error');
      throw e;
    }
  }
  function chooseTemplate(t: Doc) {
    try {
      const base = blankDoc(t.kind);
      editing = { ...base, ...plain(t), id: t.id, published: false };
      editingRule = editing.kind === 'popup' ? defaultRule(editing.id) : null;
      isNew = true; pickStep = 'edit'; editorTab = 'basics';
    } catch { /* toasted in plain() */ }
  }
  function chooseBlank(kind: 'popup' | 'interview') {
    editing = blankDoc(kind);
    editingRule = kind === 'popup' ? defaultRule(editing.id) : null;
    isNew = true; pickStep = 'edit'; editorTab = 'basics';
  }
  function editDoc(d: Doc) {
    try {
      editing = plain({ steps: [], confirmations: [], submitButton: { text: 'Submit', icon: '' }, fileUpload: { enabled: false }, requiresAuth: false, legacy: null, interview: { openingQuestion: '', systemPrompt: '', skipAllowed: true, asyncSubmit: true, completeMessage: '' }, triggers: { examTypes: [], autoShow: false }, ...plain(d) });
      editingRule = editing.kind === 'popup' ? plain(autoRule(editing.id) || defaultRule(editing.id)) : null;
      isNew = false; pickStep = 'edit'; editorTab = 'basics'; showEditor = true;
    } catch { /* toasted in plain() */ }
  }
  function closeEditor() { showEditor = false; editing = null; }

  async function save() {
    if (!editing) return;
    if (!editing.id.trim() || !editing.title.trim()) { addToast('Add a title and an ID first', 'error'); return; }
    if (!editing.fields.length) { addToast('Add at least one question', 'error'); return; }
    isSaving = true;
    try {
      await makeAdminRequest('forms', 'POST', editing);
      if (editing.kind === 'popup' && editingRule) {
        editingRule.formId = editing.id;
        // One rule per pop-up: drop any other rule pointing at the same form
        // so two schedules can never fight over (and double-fire) it.
        activity.activities = activity.activities.filter((r) => r.formId !== editing.id || r.id === editingRule!.id);
        const i = activity.activities.findIndex((r) => r.id === editingRule!.id);
        if (i >= 0) activity.activities[i] = editingRule;
        else activity.activities.push(editingRule);
        await makeAdminRequest('forms', 'POST', { scope: 'activity', enabled: activity.enabled, activities: activity.activities, settings: activity.settings });
      }
      addToast(isNew ? 'Created' : 'Saved', 'success');
      closeEditor(); await load();
    } catch (e: any) { addToast(e.message || 'Unable to save', 'error'); }
    finally { isSaving = false; }
  }

  async function togglePublish(d: Doc) {
    try {
      await makeAdminRequest('forms', 'PATCH', { id: d.id, published: !d.published });
      addToast(d.published ? 'Taken offline' : 'Now live', 'success');
      await load();
    } catch (e: any) { addToast(e.message || 'Unable to update', 'error'); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await makeAdminRequest(`forms?id=${encodeURIComponent(deleteTarget.id)}`, 'DELETE');
      addToast('Deleted', 'success');
      deleteTarget = null; await load();
    } catch (e: any) { addToast(e.message || 'Unable to delete', 'error'); }
  }

  async function confirmDeleteResponse() {
    if (!deleteResponseTarget) return;
    try {
      const map = { chat: 'responses', popup: 'submissions', bug: 'bugs' } as const;
      await makeAdminRequest(`forms?source=${map[deleteResponseTarget.source]}&responseId=${encodeURIComponent(deleteResponseTarget.id)}`, 'DELETE');
      const id = deleteResponseTarget.id;
      if (deleteResponseTarget.source === 'chat') responses = responses.filter((x: any) => x.id !== id);
      else if (deleteResponseTarget.source === 'popup') submissions = submissions.filter((x: any) => x.id !== id);
      else bugs = bugs.filter((x: any) => x.id !== id);
      addToast('Answer deleted', 'success');
      deleteResponseTarget = null; detailResponse = null;
    } catch (e: any) { addToast(e.message || 'Unable to delete', 'error'); }
  }

  async function markReviewed(row: Row, status = 'Reviewed') {
    try {
      const map = { chat: 'responses', popup: 'submissions', bug: 'bugs' } as const;
      await makeAdminRequest('forms', 'PATCH', { review: { source: map[row.source], id: row.id, status } });
      const stamp = { status, reviewed: true, reviewedAt: new Date().toISOString() };
      if (row.source === 'chat') { const it: any = responses.find((x: any) => x.id === row.id); if (it) Object.assign(it, stamp); responses = [...responses]; }
      else if (row.source === 'popup') { const it: any = submissions.find((x: any) => x.id === row.id); if (it) Object.assign(it, stamp); submissions = [...submissions]; }
      else { const it: any = bugs.find((x: any) => x.id === row.id); if (it) Object.assign(it, stamp); bugs = [...bugs]; }
      addToast(`Marked as ${status.toLowerCase()}`, 'success');
    } catch (e: any) { addToast(e.message || 'Unable to update', 'error'); }
  }

  function copyInterviewLink(d: Doc) {
    const link = `/interviewer?form=${encodeURIComponent(d.id)}`;
    try { navigator.clipboard?.writeText(link); addToast('Link copied', 'success'); }
    catch { addToast(link, 'success'); }
  }

  function sessionFor(row: Row) { return row.source === 'chat' ? sessions.find((s) => (s.sessionId || s.id) === row.raw.sessionId) : null; }
  function statusLabel(s: string) { return s === 'reviewed' ? 'Reviewed' : s === 'completed' || s === 'done' ? 'Done' : s === 'in_progress' ? 'In progress' : s === 'pending' ? 'New' : s === 'open' ? 'Open' : s || 'Done'; }
  function answerCount(id: string) {
    return responses.filter((r) => r.formId === id).length + submissions.filter((s) => s.formType === id).length + (id === 'bug-report' ? bugs.length : 0);
  }
  function fieldLabel(formId: string, key: string) {
    if (!key) return 'Answer';
    const f = docs.find((d) => d.id === formId)?.fields.find((x) => x.name === key);
    if (f?.label) return f.label;
    return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function docTitle(id: string) {
    if (!id) return 'Untitled form';
    const known = docs.find((d) => d.id === id)?.title || templates.find((t) => t.id === id)?.title;
    if (known) return known;
    if (id === 'bug-report') return 'Bug reports';
    return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function openAnswers(id: string) {
    activeTab = 'responses';
    selectedSection = id;
  }
  function timeAgo(iso?: string) {
    if (!iso) return '';
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  }

  function addField() {
    if (!editing) return;
    editing.fields = [...editing.fields, { name: `question${editing.fields.length + 1}`, label: 'New question', type: 'text', required: false }];
  }
  function addStep() {
    if (!editing) return;
    editing.steps = [...editing.steps, { id: `page-${editing.steps.length + 1}`, type: 'info', title: 'New page' }];
  }
  function addConfirmation() {
    if (!editing) return;
    editing.confirmations = [...(editing.confirmations || []), { name: `confirm${(editing.confirmations || []).length + 1}`, label: 'I confirm this is accurate', required: true }];
  }
  function toggleExamType(t: string) {
    if (!editing) return;
    const cur = editing.triggers.examTypes || [];
    editing.triggers.examTypes = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
  }
  function optLabels(field: Field) { return (field.options || []).map((o) => typeof o === 'string' ? o : o.label).join(', '); }
  function setStringOptions(field: Field, raw: string) {
    field.options = raw.split(',').map((s) => s.trim()).filter(Boolean);
    editing = editing ? { ...editing } : editing;
  }
  function setObjectOptionLabel(field: Field, index: number, label: string) {
    const o: any = field.options![index];
    field.options![index] = typeof o === 'string' ? label : { ...o, label };
    editing = editing ? { ...editing } : editing;
  }

  function editorTabs(kind: string): [string, string][] {
    if (kind === 'popup') return [['basics', 'Basics'], ['questions', 'Questions'], ['pages', 'Welcome pages'], ['auto', 'Auto-show'], ['preview', 'Preview']];
    return [['basics', 'Basics'], ['questions', 'Questions'], ['conversation', 'Conversation'], ['preview', 'Preview']];
  }

  function defaultRule(formId: string): Rule {
    return { id: `auto-${formId}`, enabled: false, formId, trigger: { type: 'pageLoad', delay: 3000, conditions: { minVisits: 1, minDaysSinceFirstVisit: 0, pages: [], excludePages: [], userType: 'any' } }, frequency: 'once', customFrequencyHours: null, showOn: 'all', startDate: null, endDate: null, priority: 10 };
  }
  function autoRule(formId: string) { return activity.activities.find((r) => r.formId === formId) || null; }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
    <div>
      <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight flex items-center gap-2"><HugeiconsIcon icon={Folder01Icon} size={24} class="text-primary" />Forms & Wizards</h1>
      <p class="text-muted-foreground mt-1 text-sm">Pop-up wizards appear over the site. Chat interviews hold a conversation that fills itself in.</p>
    </div>
    <div class="flex gap-2">
      <button class="px-3 py-2.5 rounded-xl border border-border text-sm" onclick={load} title="Refresh"><HugeiconsIcon icon={RefreshIcon} size={15} /></button>
      <button class="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm flex items-center gap-2 shadow-xs" onclick={openCreate}><HugeiconsIcon icon={Add01Icon} size={15} />New</button>
    </div>
  </div>

  <div class="flex items-center gap-2 p-1 bg-muted/40 rounded-xl w-fit max-w-full overflow-x-auto">
    <button onclick={() => activeTab = 'popups'} class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap {activeTab === 'popups' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}">Pop-up wizards</button>
    <button onclick={() => activeTab = 'interviews'} class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap {activeTab === 'interviews' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}">Chat interviews</button>
    <button onclick={() => activeTab = 'responses'} class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 {activeTab === 'responses' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}">Answers{#if totalNew}<span class="newdot">{totalNew} new</span>{/if}</button>
  </div>

  {#if isLoading}
    <div class="py-16 text-center text-muted-foreground text-sm">Loading...</div>
  {:else if activeTab === 'responses'}
    {@const sec = sections.find((s) => s.id === selectedSection) || sections[0]}
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 p-1 bg-muted/40 rounded-xl max-w-full overflow-x-auto">
          {#each sections as s}
            <button onclick={() => selectedSection = s.id} class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 {sec && sec.id === s.id ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}">{s.title} <span class="opacity-70">{s.total}</span>{#if s.fresh}<span class="newdot">{s.fresh} new</span>{/if}</button>
          {/each}
        </div>
        <button onclick={() => filesOnly = !filesOnly} class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap {filesOnly ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}">With files</button>
      </div>
    </div>
    {#if !sec}
      <div class="py-16 text-center text-muted-foreground text-sm border border-dashed border-border rounded-2xl">No answers yet. Once people respond, they appear here.</div>
    {:else}
      <div class="bg-card border border-border/60 rounded-2xl overflow-x-auto">
        <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/20">
          <h3 class="font-semibold text-sm">{sec.title}</h3>
          <span class="badge">{sec.kind}</span>
          <span class="text-[11px] text-muted-foreground">{sec.total} answers</span>
          {#if sec.fresh}<span class="newdot">{sec.fresh} new</span>{/if}
        </div>
        {#if visibleSectionRows.length}
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-muted-foreground"><tr><th class="text-left p-3 font-medium">Answer</th><th class="text-left p-3 font-medium">Status</th><th class="text-left p-3 font-medium">When</th><th class="p-3"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody class="divide-y divide-border/50">
            {#each visibleSectionRows as r}
              <tr class="hover:bg-muted/20">
                <td class="p-3 max-w-md"><span class="block truncate text-muted-foreground">{r.excerpt}</span>{#if r.files.length}<span class="badge">files: {r.files.length}</span>{/if}</td>
                <td class="p-3 whitespace-nowrap"><span class="badge">{statusLabel(r.status)}</span>{#if isFresh(r)}<span class="newdot ml-1">new</span>{/if}</td>
                <td class="p-3 text-muted-foreground text-xs whitespace-nowrap">{r.date ? new Date(r.date).toLocaleString() : ''}</td>
                <td class="p-3 rowactions">
                  <button class="iconbtn" title="View" onclick={() => { detailResponse = r; statusSel = ''; customStatus = ''; detailOpen = true; }}><HugeiconsIcon icon={ViewIcon} size={15} /></button>
                  {#if r.email}<a class="iconbtn" title="Email them" href="mailto:{r.email}"><HugeiconsIcon icon={Mail01Icon} size={15} /></a>{/if}
                  {#if isFresh(r)}<button class="iconbtn" title="Mark reviewed" onclick={() => markReviewed(r)}><HugeiconsIcon icon={Tick01Icon} size={15} /></button>{/if}
                  <button class="iconbtn danger" title="Delete" onclick={() => { deleteResponseTarget = r; confirmDeleteResponseOpen = true; }}><HugeiconsIcon icon={Delete01Icon} size={15} /></button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {:else}<p class="p-6 text-center text-muted-foreground text-xs">Nothing with files in this section.</p>{/if}
      </div>
    {/if}
  {:else}
    <div class="flex flex-wrap gap-3 items-center">
      <input class="filter grow min-w-40" placeholder="Search..." bind:value={search} />
      <div class="w-44"><Dropdown options={[{ value: 'all', label: 'All statuses' }, { value: 'live', label: 'Live' }, { value: 'draft', label: 'Drafts' }]} bind:value={statusFilter} /></div>
    </div>

    {#if visibleDocs.length === 0}
      <div class="py-16 text-center border border-dashed border-border rounded-2xl space-y-3">
        <p class="text-muted-foreground text-sm">{#if docs.length}Nothing matches. Try clearing the search.{:else if activeTab === 'popups'}No pop-ups yet. Start from one of the main-site templates.{:else}No interviews yet. Start from a template or a blank chat.{/if}</p>
        {#if !docs.length}<button class="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm" onclick={openCreate}>Browse templates</button>{/if}
      </div>
    {:else}
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each visibleDocs as d}
          <article class="rounded-2xl border border-border/60 bg-background overflow-hidden flex flex-col">
            <div class="p-5 flex flex-col gap-2 grow">
              <div class="flex items-center gap-2">
                <span class={d.published ? 'live' : 'draft'}>{d.published ? 'Live' : 'Draft'}</span>
                {#if newCounts.get(d.id)}<span class="newdot">{newCounts.get(d.id)} new answers</span>{/if}
                {#if d.requiresAuth}<span class="badge">Sign-in needed</span>{/if}
                {#if d.legacy}<span class="badge">From main site</span>{/if}
              </div>
              <h3 class="font-semibold leading-snug">{d.title}</h3>
              <p class="text-xs text-muted-foreground line-clamp-2">{d.description || 'No description yet'}</p>
              <p class="text-[11px] text-muted-foreground">{d.fields.length} questions · {answerCount(d.id)} answers{#if d.updatedAt} · {timeAgo(d.updatedAt)}{/if}</p>
              {#if d.kind === 'popup'}<p class="text-[11px] {autoRule(d.id)?.enabled ? 'text-emerald-700' : 'text-muted-foreground'}">{autoRule(d.id)?.enabled ? 'Pops up on its own' : 'Opens from buttons only'}</p>{/if}
            </div>
            <div class="flex items-center gap-1 px-4 py-3 border-t border-border/50">
              <button class="iconbtn" title="Edit" onclick={() => editDoc(d)}><HugeiconsIcon icon={Edit01Icon} size={15} /></button>
              <button class="iconbtn" title="Preview" onclick={() => { previewDoc = d; previewOpen = true; }}><HugeiconsIcon icon={ViewIcon} size={15} /></button>
              <button class="answersbtn" title="See answers" onclick={() => openAnswers(d.id)}><HugeiconsIcon icon={Comment01Icon} size={15} /><span>{answerCount(d.id)}</span></button>
              <button class="iconbtn" title={d.published ? 'Take offline' : 'Publish'} onclick={() => togglePublish(d)}><HugeiconsIcon icon={CheckmarkCircle01Icon} size={15} /></button>
              <button class="iconbtn danger ml-auto" title="Delete" onclick={() => { deleteTarget = d; confirmDeleteOpen = true; }}><HugeiconsIcon icon={Delete01Icon} size={15} /></button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<Modal bind:isOpen={showEditor} title={pickStep === 'pick' ? 'What do you want to make?' : isNew ? 'New entry' : `Edit — ${editing?.title || ''}`} onClose={closeEditor} maxWidthClass="sm:max-w-4xl lg:max-w-5xl">
  {#if pickStep === 'pick'}
    <p class="text-sm text-muted-foreground mb-4">A pop-up appears over the site, styled like the promos. A chat interview is a full page that talks the visitor through the questions.</p>
    <h4 class="group-h">Pop-up wizard</h4>
    <div class="grid sm:grid-cols-2 gap-3 mb-6">
      <button class="tmpl" onclick={() => chooseBlank('popup')}><b>Start blank</b><span>A clean pop-up with one welcome page</span></button>
      {#each popupTemplates as t}
        <button class="tmpl" onclick={() => chooseTemplate(t)}><b>{t.title}</b><span>{t.description}</span></button>
      {/each}
    </div>
    <h4 class="group-h">Chat interview</h4>
    <div class="grid sm:grid-cols-2 gap-3">
      <button class="tmpl" onclick={() => chooseBlank('interview')}><b>Start blank</b><span>A clean chat that fills one answer box</span></button>
      {#each interviewTemplates as t}
        <button class="tmpl" onclick={() => chooseTemplate(t)}><b>{t.title}</b><span>{t.description}</span></button>
      {/each}
    </div>
  {:else if editing}
    <div class="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border/50 text-sm no-scrollbar mb-5">
      {#each editorTabs(editing.kind) as [key, label]}
        <button type="button" onclick={() => editorTab = key} class="px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium {editorTab === key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}">{label}</button>
      {/each}
    </div>

    {#if editorTab === 'basics'}
      <div class="grid sm:grid-cols-2 gap-4">
        <label class="fld">Title<input bind:value={editing.title} /></label>
        <label class="fld">ID <span class="hint">Lowercase, no spaces. Buttons and links use this to open it.</span><input bind:value={editing.id} /></label>
        <label class="fld">Shows as<div><Dropdown options={[{ value: 'popup', label: 'Pop-up wizard' }, { value: 'interview', label: 'Chat interview' }]} bind:value={editing.kind} /></div></label>
        <label class="fld">Topic<div><Dropdown options={contexts.map((c) => ({ value: c, label: c }))} bind:value={editing.context} /></div></label>
        <label class="fld">Button text (pop-up)<input bind:value={editing.submitButton.text} placeholder="Submit" /></label>
        <label class="fld check"><input type="checkbox" bind:checked={editing.published} /> Live on the site</label>
        <label class="fld check"><input type="checkbox" bind:checked={editing.requiresAuth} /> Only signed-in users</label>
      </div>
      <label class="fld mt-4">Short description<textarea rows="2" bind:value={editing.description}></textarea></label>
      {#if editing.kind === 'popup'}
        <div class="mt-4 text-sm">
          <p class="text-xs text-muted-foreground mb-2">Also suggest this pop-up on exam cards for:</p>
          <div class="flex gap-4">
            {#each ['viva', 'practical'] as t}<label class="flex items-center gap-2"><input type="checkbox" checked={editing.triggers.examTypes?.includes(t)} onchange={() => toggleExamType(t)} /> {t === 'viva' ? 'Viva exams' : 'Practical exams'}</label>{/each}
          </div>
        </div>
      {/if}
    {:else if editorTab === 'questions'}
      <div class="flex items-center justify-between mb-3"><h4 class="font-semibold text-sm">Questions{#if editing.kind === 'interview'} <span class="font-normal text-muted-foreground">— the chat fills these in by itself</span>{/if}</h4><button class="text-xs underline" onclick={addField}>Add question</button></div>
      <div class="space-y-3">
        {#each editing.fields as field, i}
          <div class="rounded-xl border border-border/50 p-3 space-y-2 bg-background">
            <div class="grid grid-cols-[1fr_1.5fr_150px_100px_auto] gap-2 items-center">
              <input bind:value={field.name} placeholder="name" title="Field name" />
              <input bind:value={field.label} placeholder="Question text" />
              <div><Dropdown options={fieldTypes.map((t) => ({ value: t, label: t }))} bind:value={field.type} /></div>
              <label class="text-[11px] flex items-center gap-1"><input type="checkbox" bind:checked={field.required} /> Must answer</label>
              <button class="iconbtn danger" onclick={() => { editing.fields = editing.fields.filter((_, x) => x !== i); }}><HugeiconsIcon icon={Delete01Icon} size={14} /></button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input placeholder="Example answer" bind:value={field.placeholder} />
              <input placeholder="Help text" bind:value={field.hint} />
              <input placeholder="Min length" type="number" min="0" bind:value={field.minLength} />
              <input placeholder="Max length" type="number" min="0" bind:value={field.maxLength} />
            </div>
            {#if field.type === 'file'}<input placeholder="Allowed files, e.g. .pdf" bind:value={field.accept} />{/if}
            {#if field.type === 'select'}
              {#if field.options?.length && typeof field.options[0] !== 'string'}
                <div class="grid sm:grid-cols-2 gap-2">
                  {#each field.options as opt, oi}
                    <div class="flex items-center gap-2 text-xs"><input value={opt.label} oninput={(e) => setObjectOptionLabel(field, oi, e.currentTarget.value)} /><code class="text-muted-foreground">{opt.value}</code></div>
                  {/each}
                </div>
              {:else}
                <input placeholder="Choices, separated by commas" value={optLabels(field)} oninput={(e) => setStringOptions(field, e.currentTarget.value)} />
              {/if}
            {/if}
          </div>
        {/each}
      </div>
      <div class="flex items-center justify-between mt-6 mb-2"><h4 class="font-semibold text-sm">Confirmation checkboxes</h4><button class="text-xs underline" onclick={addConfirmation}>Add checkbox</button></div>
      <div class="space-y-2">
        {#each (editing.confirmations || []) as conf, ci}
          <div class="grid grid-cols-[1fr_2fr_110px_auto] gap-2 items-center">
            <input bind:value={conf.name} placeholder="name" />
            <input bind:value={conf.label} placeholder="e.g. I confirm this is accurate" />
            <label class="text-[11px] flex items-center gap-1"><input type="checkbox" bind:checked={conf.required} /> Must tick</label>
            <button class="iconbtn danger" onclick={() => { editing.confirmations = editing.confirmations.filter((_, x) => x !== ci); }}><HugeiconsIcon icon={Delete01Icon} size={14} /></button>
          </div>
        {:else}<p class="text-xs text-muted-foreground">None. Most pop-ups ask visitors to confirm accuracy.</p>{/each}
      </div>
    {:else if editorTab === 'pages'}
      <div class="flex items-center justify-between mb-3"><h4 class="font-semibold text-sm">Welcome pages <span class="font-normal text-muted-foreground">— shown before the questions, like a cover and an intro</span></h4><button class="text-xs underline" onclick={addStep}>Add page</button></div>
      <div class="space-y-2">
        {#each editing.steps as step, i}
            <div class="grid grid-cols-[150px_1fr_1fr_auto] gap-2 items-center">
              <div><Dropdown options={[{ value: 'cover', label: 'Cover' }, { value: 'info', label: 'Intro' }, { value: 'form', label: 'Questions' }]} bind:value={step.type} /></div>
            <input bind:value={step.title} placeholder="Page heading" />
            <input bind:value={step.subtitle} placeholder="Subheading (optional)" />
            <button class="iconbtn danger" onclick={() => { editing.steps = editing.steps.filter((_, x) => x !== i); }}><HugeiconsIcon icon={Delete01Icon} size={14} /></button>
          </div>
        {:else}<p class="text-xs text-muted-foreground">No welcome pages — visitors go straight to the questions.</p>{/each}
      </div>
    {:else if editorTab === 'conversation'}
      <div class="grid gap-4">
        <label class="fld">First message<textarea rows="2" bind:value={editing.interview.openingQuestion} placeholder="e.g. What would you like to share today?"></textarea></label>
        <label class="fld">How the chat should behave <span class="hint">Short instructions, e.g. “Ask one question at a time and keep replies brief.”</span><textarea rows="3" bind:value={editing.interview.systemPrompt}></textarea></label>
        <label class="fld">Closing message<textarea rows="2" bind:value={editing.interview.completeMessage}></textarea></label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={editing.interview.skipAllowed} /> Let visitors skip a question</label>
      </div>
    {:else if editorTab === 'auto'}
      {#if editingRule}
        <div class="rounded-xl border border-border/60 bg-muted/20 p-4 mb-4 text-sm flex items-center gap-3">
          <input type="checkbox" bind:checked={editingRule.enabled} class="size-4" />
          <div><b>Pop this up on its own</b><p class="text-xs text-muted-foreground m-0">Off means it only opens from buttons and links.</p></div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <label class="fld">Wait after page loads (seconds)<input type="number" min="0" step="1" value={Math.round((editingRule.trigger.delay || 0) / 1000)} oninput={(e) => editingRule!.trigger.delay = Math.max(0, Number(e.currentTarget.value || 0)) * 1000} /></label>
          <label class="fld">Only after this many visits<input type="number" min="0" bind:value={editingRule.trigger.conditions.minVisits} /></label>
          <label class="fld">Show to<div><Dropdown options={[{ value: 'any', label: 'Everyone' }, { value: 'authenticated', label: 'Signed-in users' }, { value: 'anonymous', label: 'Guests' }]} bind:value={editingRule.trigger.conditions.userType} /></div></label>
          <label class="fld">Repeat<div><Dropdown options={[{ value: 'once', label: 'Just once per visitor' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'every-30days', label: 'Monthly' }, { value: 'custom', label: 'Custom…' }]} bind:value={editingRule.frequency} /></div></label>
          {#if editingRule.frequency === 'custom'}<label class="fld">Repeat every (hours)<input type="number" min="1" bind:value={editingRule.customFrequencyHours} /></label>{/if}
        </div>
        <p class="text-xs text-muted-foreground mt-4">Visitors also need the pop-up itself set to Live. Saving here saves everything on this page together.</p>
        <div class="mt-5 rounded-xl border border-border/60 p-4">
          <h4 class="font-semibold text-sm mb-1">Site-wide limits</h4>
          <p class="text-xs text-muted-foreground mb-3">Shared by every pop-up on the site.</p>
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="fld">Pop-ups per visit<input type="number" min="1" bind:value={activity.settings.maxFormsPerSession} /></label>
            <label class="fld">Wait between pop-ups (minutes)<input type="number" min="0" step="1" value={Math.round((activity.settings.minTimeBetweenForms || 0) / 60000)} oninput={(e) => activity.settings.minTimeBetweenForms = Math.max(0, Number(e.currentTarget.value || 0)) * 60000} /></label>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={activity.enabled} /> Auto-show turned on at all</label>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={activity.settings.respectDoNotDisturb} /> Respect “do not disturb”</label>
          </div>
        </div>
      {/if}
    {:else if editorTab === 'preview'}
      {#if editing.kind === 'popup'}
        <div class="pv-overlay">
          <div class="pv-modal">
            <div class="pv-mark">{(editing.title || 'M').slice(0, 1)}</div>
            <h3>{editing.title || 'Untitled'}</h3>
            <p>{editing.description || 'No description yet'}</p>
            {#if editing.steps.length}<p class="pv-pages">{editing.steps.filter((s) => s.type !== 'form').length} welcome page(s) first, then:</p>{/if}
            {#each editing.fields.slice(0, 4) as f}
              <div class="pv-field"><span>{f.label}{#if f.required} *{/if}</span><div class="pv-input">{f.type}</div></div>
            {/each}
            {#if editing.fields.length > 4}<p class="pv-more">+ {editing.fields.length - 4} more</p>{/if}
            <div class="pv-btn">{editing.submitButton.text || 'Submit'}</div>
          </div>
        </div>
      {:else}
        <div class="pv-chat">
          <div class="pv-msg"><span>M</span><p>{editing.interview.openingQuestion || editing.description || '...'}</p></div>
          <div class="pv-msg user"><p>Visitors answer in their own words…</p><span>You</span></div>
          <div class="pv-captured"><small>Captured automatically</small>{#each editing.fields.slice(0, 4) as f}<div><b>{f.label}</b></div>{/each}</div>
          <p class="pv-link">Lives at /interviewer?form={editing.id || '…'}</p>
        </div>
      {/if}
    {/if}

    <div class="flex justify-between gap-2 mt-6">
      <button class="px-4 py-2 rounded-xl border border-border text-sm" onclick={() => { pickStep = 'pick'; }}>← Templates</button>
      <div class="flex gap-2">
        <button class="px-4 py-2 rounded-xl border border-border text-sm" onclick={closeEditor}>Cancel</button>
        <button class="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm flex items-center gap-2" onclick={save} disabled={isSaving}><HugeiconsIcon icon={SaveIcon} size={15} />{isSaving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  {/if}
</Modal>

<Modal bind:isOpen={previewOpen} title={previewDoc ? `Preview — ${previewDoc.title}` : 'Preview'} onClose={() => { previewOpen = false; previewDoc = null; }} maxWidthClass="sm:max-w-2xl">
  {#if previewDoc}
    {#if previewDoc.kind === 'popup'}
      <div class="pv-overlay inline">
        <div class="pv-modal">
          <div class="pv-mark">{(previewDoc.title || 'M').slice(0, 1)}</div>
          <h3>{previewDoc.title}</h3>
          <p>{previewDoc.description}</p>
          {#each previewDoc.fields.slice(0, 5) as f}
            <div class="pv-field"><span>{f.label}{#if f.required} *{/if}</span><div class="pv-input">{f.type}</div></div>
          {/each}
          <div class="pv-btn">{previewDoc.submitButton?.text || 'Submit'}</div>
        </div>
      </div>
      <p class="text-xs text-muted-foreground mt-3">This is how it pops up over the site — same look as the promos. The live version is interactive.</p>
    {:else}
      <div class="pv-chat">
        <div class="pv-msg"><span>M</span><p>{previewDoc.interview?.openingQuestion || previewDoc.description}</p></div>
        <div class="pv-msg user"><p>Visitors answer in their own words…</p><span>You</span></div>
        <div class="pv-captured"><small>Captured automatically</small>{#each previewDoc.fields.slice(0, 5) as f}<div><b>{f.label}</b></div>{/each}</div>
      </div>
      <div class="flex items-center gap-2 mt-3">
        <code class="text-xs">/interviewer?form={previewDoc.id}</code>
        <button class="text-xs underline" onclick={() => copyInterviewLink(previewDoc!)}>Copy link</button>
      </div>
    {/if}
  {/if}
</Modal>

  <Modal bind:isOpen={detailOpen} title="Answer detail" onClose={() => { detailOpen = false; detailResponse = null; }} maxWidthClass="sm:max-w-2xl">
    {#if detailResponse}
      {@const s2 = sessionFor(detailResponse)}
      <p class="text-xs text-muted-foreground mb-3">{docTitle(detailResponse.formId)} · {detailResponse.source === 'chat' ? 'Chat' : detailResponse.source === 'popup' ? 'Pop-up' : 'Bug report'} · {detailResponse.date ? new Date(detailResponse.date).toLocaleString() : ''}</p>
      <h4 class="group-h">Answers</h4>
      <div class="rounded-xl border border-border/60 p-4 my-2 text-sm space-y-1">
        {#each detailResponse.answers as [k, v]}<div class="flex gap-3"><b class="min-w-28 capitalize">{k}</b><span class="text-muted-foreground">{v}</span></div>{:else}<p class="text-muted-foreground">Empty</p>{/each}
        {#if detailResponse.skipped?.length}<p class="text-xs text-muted-foreground pt-2">Skipped: {detailResponse.skipped.join(', ')}</p>{/if}
      </div>
      {#if detailResponse.source === 'chat'}
        <h4 class="group-h mt-4">Conversation</h4>
        <div class="rounded-xl border border-border/60 p-4 my-2 text-sm space-y-2 max-h-64 overflow-auto">
          {#each s2?.messages || [] as m}<div><b class="text-xs">{m.role === 'user' ? 'Visitor' : 'Interviewer'}: </b>{m.content}</div>{:else}<p class="text-muted-foreground">No transcript stored.</p>{/each}
        </div>
      {/if}
      {#if detailResponse.files.length}
        <h4 class="group-h mt-4">Attached files</h4>
        <div class="rounded-xl border border-border/60 p-4 my-2 text-sm space-y-1">
          {#each detailResponse.files as f}<div class="flex gap-3 items-baseline"><b>{f.filename || f.name}</b><span class="text-muted-foreground text-xs">{f.path || ''}{#if f.size} · {Math.round(f.size / 1024)} KB{/if}</span></div>{/each}
        </div>
      {/if}
      {#if detailResponse.who.length}
        <h4 class="group-h mt-4">Submitted by</h4>
        <div class="rounded-xl border border-border/60 p-4 my-2 text-sm space-y-1">
          {#each detailResponse.who as [k, v]}<div class="flex gap-3"><b class="min-w-28">{k}</b><span class="text-muted-foreground">{v}</span></div>{/each}
          {#if detailResponse.email}<div class="flex gap-3"><b class="min-w-28">Email</b><a class="text-primary underline" href="mailto:{detailResponse.email}">{detailResponse.email}</a></div>{/if}
        </div>
      {/if}
      <h4 class="group-h mt-4">Set status</h4>
      <div class="flex flex-wrap gap-2 my-2">
        {#each REVIEW_STATUS as t}
          <button class="tagchip {statusSel === t ? 'active' : ''}" onclick={() => { statusSel = t; customStatus = ''; }}>{t}</button>
        {/each}
      </div>
      <label class="fld mt-2">Or write your own<input bind:value={customStatus} oninput={() => statusSel = ''} placeholder="e.g. Needs design review" /></label>
      <div class="flex justify-between items-center mt-4">
        <div class="flex gap-2">
          {#if detailResponse.email}<a class="px-4 py-2 rounded-xl border border-border text-sm inline-flex items-center gap-2" href="mailto:{detailResponse.email}"><HugeiconsIcon icon={Mail01Icon} size={14} />Email them</a>{/if}
          <button class="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm" onclick={() => { const s = customStatus.trim() || statusSel; if (!s) { addToast('Pick or write a status first', 'error'); return; } if (detailResponse) { markReviewed(detailResponse, s); detailOpen = false; } }}>Save review</button>
        </div>
        <button class="px-4 py-2 rounded-xl border border-destructive/40 text-destructive text-sm" onclick={() => { deleteResponseTarget = detailResponse; detailOpen = false; detailResponse = null; confirmDeleteResponseOpen = true; }}>Delete</button>
      </div>
    {/if}
  </Modal>

<ConfirmModal bind:isOpen={confirmDeleteOpen} title="Delete this?" message={`Delete “${deleteTarget?.title}”? Its answers stay unless removed separately.`} confirmText="Delete" onConfirm={confirmDelete} onCancel={() => deleteTarget = null} />
<ConfirmModal bind:isOpen={confirmDeleteResponseOpen} title="Delete this answer?" message="This removes it permanently." confirmText="Delete" onConfirm={confirmDeleteResponse} onCancel={() => deleteResponseTarget = null} />

<style>
  .group-h { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: hsl(var(--muted-foreground)); margin-bottom: 8px; }
  .filter { border: 1px solid hsl(var(--border)); border-radius: 10px; padding: 8px 12px; font-size: 13px; background: hsl(var(--background)); color: hsl(var(--foreground)); }
  .badge { font-size: 10px; padding: 3px 9px; border-radius: 999px; background: hsl(var(--muted) / .5); color: hsl(var(--muted-foreground)); }
  .live { font-size: 10px; padding: 3px 9px; border-radius: 999px; background: hsl(142 60% 45% / .13); color: hsl(142 60% 32%); }
  .draft { font-size: 10px; padding: 3px 9px; border-radius: 999px; background: hsl(var(--muted) / .5); color: hsl(var(--muted-foreground)); }
  .newdot { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: hsl(215 25% 50% / .12); color: hsl(215 30% 40%); white-space: nowrap; }
  .tagchip { font-size: 12px; padding: 6px 14px; border-radius: 999px; border: 1px solid hsl(var(--border) / .7); color: hsl(var(--muted-foreground)); background: hsl(var(--background)); }
  .tagchip.active { border-color: hsl(var(--primary)); color: hsl(var(--primary)); background: hsl(var(--primary) / .08); font-weight: 600; }
  .iconbtn { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; padding: 7px; border-radius: 8px; color: hsl(var(--muted-foreground)); }
  .iconbtn:hover { background: hsl(var(--muted) / .5); color: hsl(var(--foreground)); }
  .iconbtn.danger:hover { color: hsl(var(--destructive)); background: hsl(var(--destructive) / .08); }
  .rowactions { white-space: nowrap; text-align: right; vertical-align: middle; }
  .rowactions .iconbtn, .rowactions a.iconbtn { display: inline-flex; }
  .answersbtn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 9px; border-radius: 8px; color: hsl(var(--muted-foreground)); }
  .answersbtn:hover { background: hsl(var(--muted) / .5); color: hsl(var(--foreground)); }
  .answersbtn span { font-size: 12px; line-height: 1; }
  .tmpl { text-align: left; border: 1px solid hsl(var(--border) / .6); border-radius: 12px; padding: 12px 14px; background: hsl(var(--background)); display: flex; flex-direction: column; gap: 3px; cursor: pointer; }
  .tmpl:hover { border-color: hsl(var(--primary)); }
  .tmpl b { font-size: 13px; } .tmpl span { font-size: 11px; color: hsl(var(--muted-foreground)); }
  .fld { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: hsl(var(--muted-foreground)); }
  .fld .hint { font-size: 11px; opacity: .8; }
  .fld input:not([type='checkbox']), .fld textarea { border: 1px solid hsl(var(--border)); border-radius: 9px; padding: 9px 11px; background: hsl(var(--background)); color: hsl(var(--foreground)); font-size: 13px; width: 100%; box-sizing: border-box; }
  .fld.check { flex-direction: row; align-items: center; padding-top: 24px; color: hsl(var(--foreground)); }
  input[type='checkbox'] { accent-color: hsl(var(--primary)); }
  .pv-overlay { background: rgb(0 0 0 / .45); border-radius: 16px; padding: 28px 18px; display: flex; justify-content: center; }
  .pv-overlay.inline { margin: 0; }
  .pv-modal { background: hsl(var(--card)); border-radius: 16px; padding: 26px 22px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 18px 50px rgb(0 0 0 / .3); }
  .pv-mark { width: 40px; height: 40px; border: 1px solid hsl(var(--border)); border-radius: 50%; display: grid; place-items: center; font-size: 12px; margin: 0 auto 12px; }
  .pv-modal h3 { margin: 0; font-size: 19px; letter-spacing: -.01em; }
  .pv-modal p { font-size: 12px; color: hsl(var(--muted-foreground)); margin: 8px 0; }
  .pv-pages { font-size: 11px !important; }
  .pv-field { text-align: left; margin-top: 10px; }
  .pv-field span { font-size: 11px; color: hsl(var(--muted-foreground)); }
  .pv-input { border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 8px 10px; font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 4px; background: hsl(var(--background)); }
  .pv-more { font-size: 11px !important; }
  .pv-btn { margin-top: 16px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 10px; padding: 11px; font-size: 13px; }
  .pv-chat { display: flex; flex-direction: column; gap: 12px; background: hsl(var(--muted) / .3); border-radius: 16px; padding: 20px 16px; }
  .pv-msg { display: flex; gap: 8px; font-size: 13px; align-items: flex-start; }
  .pv-msg span { font-size: 10px; color: hsl(var(--muted-foreground)); padding-top: 3px; min-width: 24px; }
  .pv-msg p { margin: 0; } .pv-msg.user { flex-direction: row-reverse; text-align: right; }
  .pv-captured { border: 1px solid hsl(var(--border)); border-radius: 10px; padding: 10px 12px; background: hsl(var(--background)); margin-left: 32px; }
  .pv-captured small { font-size: 10px; color: hsl(var(--muted-foreground)); display: block; margin-bottom: 4px; }
  .pv-captured div { font-size: 12px; margin-top: 3px; } .pv-captured b { text-transform: capitalize; font-weight: 600; }
  .pv-link { font-size: 11px; color: hsl(var(--muted-foreground)); margin: 0; }
</style>
