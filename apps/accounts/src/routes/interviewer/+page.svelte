<svelte:head><title>Materio Interviewer</title></svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { ArrowUp01Icon, Tick01Icon } from '@hugeicons/core-free-icons';

  type Msg = { role: 'user' | 'assistant'; content: string };
  type FormDef = { id: string; title: string; description: string; context?: string; kind?: string; fields: any[]; interview?: { openingQuestion?: string; skipAllowed?: boolean; completeMessage?: string } };

  let form = $state<FormDef | null>(null);
  let messages = $state<Msg[]>([]);
  let values = $state<Record<string, string>>({});
  let skipped = $state<string[]>([]);
  let answer = $state('');
  let isSending = $state(false);
  let isComplete = $state(false);
  let sessionId = $state(crypto.randomUUID());
  let loadError = $state('');
  let needsAuth = $state(false);
  let examTag = $state('');

  const formId = $page.url.searchParams.get('form') || 'viva-question-bank';
  const examCode = $page.url.searchParams.get('exam') || '';
  const examSubject = $page.url.searchParams.get('subject') || '';

  function authHeaders() {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('materio_auth_token');
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }

  let requiredTotal = $derived((form?.fields || []).filter((f) => f.required).length);
  let requiredDone = $derived((form?.fields || []).filter((f) => f.required && values[f.name]).length);
  let progress = $derived(requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 0);
  let nextField = $derived((form?.fields || []).find((f) => f.required && !values[f.name] && !skipped.includes(f.name)) || null);

  onMount(async () => {
    try {
      const examCtx: any = {};
      if (examCode) examCtx.code = examCode;
      if (examSubject) examCtx.subject = examSubject;
      if (examCode || examSubject) examTag = [examSubject, examCode].filter(Boolean).join(' · ');
      const res = await fetch(`/api/v2/interviewer?form=${encodeURIComponent(formId)}`);
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the form');
      form = data.form;
      const opening = form.interview?.openingQuestion || form.description || 'Tell me your response in your own words.';
      messages = [{ role: 'assistant', content: opening }];
    } catch (e: any) { loadError = e.message || 'Could not load the form'; }
  });

  async function send() {
    const text = answer.trim();
    if (!text || isSending || isComplete || !form) return;
    answer = '';
    messages = [...messages, { role: 'user', content: text }];
    isSending = true;
    try {
      const res = await fetch('/api/v2/interviewer', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId, formId: form.id, text, examContext: { code: examCode, subject: examSubject } })
      });
      const data: any = await res.json();
      if (res.status === 401 && data.requiresAuth) {
        needsAuth = true;
        messages = [...messages, { role: 'assistant', content: 'This form needs a signed-in account (beta review). Please sign in, then continue.' }];
        return;
      }
      if (!res.ok) throw new Error(data.error);
      values = { ...values, ...(data.extracted || {}) };
      messages = [...messages, { role: 'assistant', content: data.message || data.reply }];
      if (data.complete) finish(data.message);
    } catch (e: any) {
      messages = [...messages, { role: 'assistant', content: e.message || 'That could not be saved. Try again.' }];
    } finally { isSending = false; }
  }

  async function skipField() {
    if (isSending || isComplete || !form) return;
    const target = nextField?.name;
    messages = [...messages, { role: 'assistant', content: target ? `Skipped “${nextField.label}”.` : 'Skipped.' }];
    try {
      const res = await fetch('/api/v2/interviewer', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId, action: 'skip', field: target })
      });
      const data: any = await res.json();
      if (data.skipped) skipped = data.skipped;
      if (data.extracted) values = { ...values, ...data.extracted };
      if (data.reply || data.message) messages = [...messages, { role: 'assistant', content: data.reply || data.message }];
      if (data.complete) finish(data.reply || data.message);
    } catch { /* optimistic skip already shown */ }
  }

  async function finish(lastMessage?: string) {
    isComplete = true;
    try {
      await fetch('/api/v2/interviewer', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ sessionId, action: 'complete', examContext: { code: examCode, subject: examSubject } })
      });
    } catch { /* background finalise; already shown as complete */ }
    if (lastMessage && !messages.at(-1)?.content.includes(lastMessage.slice(0, 20))) {
      messages = [...messages, { role: 'assistant', content: lastMessage }];
    }
  }

  function restart() {
    sessionId = crypto.randomUUID();
    values = {}; skipped = []; isComplete = false; answer = '';
    messages = [{ role: 'assistant', content: form?.interview?.openingQuestion || 'Let’s go again — what would you like to share?' }];
  }
</script>

{#if loadError}
  <main class="shell"><div class="card"><h1>Something went wrong</h1><p class="lede">{loadError}</p><a class="send" href="/overview">Back home</a></div></main>
{:else if !form}
  <main class="shell"><div class="card"><p class="lede">Preparing your questions...</p></div></main>
{:else}
  <main class="shell">
    <header class="topbar"><a href="/" class="wordmark">MATERIO</a><span>Interviewer · {form.kind || 'interview'}</span></header>
    <section class="card">
      <div class="intro-mark">MI</div>
      <h1>{form.title}</h1>
      <p class="lede">{form.description || 'Answer in your own words — the interviewer organises everything as you go.'}</p>
      {#if examTag}<p class="examtag">Linked exam: {examTag}</p>{/if}

      {#if requiredTotal > 0}
        <div class="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div class="bar" style="width: {progress}%"></div>
        </div>
        <p class="progress-label">{requiredDone} of {requiredTotal} required points captured{#if skipped.length} · {skipped.length} skipped{/if}</p>
      {/if}

      <div class="conversation" aria-live="polite">
        {#each messages as m}
          <div class="message {m.role}"><span class="who">{m.role === 'assistant' ? 'M' : 'You'}</span><p>{m.content}</p></div>
        {/each}
        {#if isSending}<div class="message assistant"><span class="who">M</span><p class="typing"><i></i><i></i><i></i></p></div>{/if}
        {#if Object.keys(values).length}
          <div class="captured"><small>Captured so far</small>
            {#each Object.entries(values) as [k, v]}<div><b>{k}</b><span>{v}</span></div>{/each}
          </div>
        {/if}
        {#if isComplete}
          <div class="done"><HugeiconsIcon icon={Tick01Icon} size={16} /> Response recorded — thank you.</div>
        {/if}
        {#if needsAuth}
          <div class="done auth"><a href="/login?next={encodeURIComponent(`/interviewer?form=${form.id}`)}">Sign in to continue this interview</a></div>
        {/if}
      </div>

      {#if !isComplete}
        <form onsubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea bind:value={answer} rows="3" placeholder="Write naturally — press Enter to send (Shift+Enter for a new line)..." aria-label="Your response"
            onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
          <div class="composer-actions">
            {#if form.interview?.skipAllowed !== false && nextField}
              <button type="button" class="skip" onclick={skipField}>Skip this question</button>
            {:else}<span></span>{/if}
            <button class="send" disabled={isSending || !answer.trim()}>{isSending ? 'Reading...' : 'Send response'} <HugeiconsIcon icon={ArrowUp01Icon} size={14} /></button>
          </div>
        </form>
      {:else}
        <div class="composer-actions"><span></span><button class="send" onclick={restart}>Start another response</button></div>
      {/if}
    </section>
  </main>
{/if}

<style>
  :global(body) { margin: 0; background: #e8e7df; color: #22221f; font-family: 'Manrope', 'Helvetica Neue', sans-serif; }
  .shell { min-height: 100vh; padding: 28px clamp(18px, 8vw, 110px); box-sizing: border-box; }
  .topbar { display: flex; justify-content: space-between; align-items: baseline; max-width: 980px; margin: 0 auto 18px; font-size: 12px; color: #77756f; letter-spacing: .04em; }
  .wordmark { color: #22221f; text-decoration: none; font-weight: 800; letter-spacing: .12em; }
  .card { max-width: 655px; margin: 0 auto; min-height: calc(100vh - 105px); background: #fbfbfa; border-radius: 18px; padding: clamp(30px, 7vw, 72px) clamp(24px, 7vw, 64px) 30px; box-sizing: border-box; display: flex; flex-direction: column; box-shadow: 0 12px 40px #39382f12; }
  .card h1 { text-align: center; font-size: clamp(24px, 4vw, 32px); margin: 0; letter-spacing: -.03em; }
  .intro-mark { width: 44px; height: 44px; border: 1px solid #22221f; border-radius: 50%; display: grid; place-items: center; font-size: 11px; letter-spacing: .08em; margin: 0 auto 25px; }
  .lede { max-width: 440px; margin: 12px auto 10px; text-align: center; color: #696861; line-height: 1.55; font-size: 14px; }
  .examtag { text-align: center; font-size: 12px; color: #8a6d1b; background: #faf3dd; border: 1px solid #e8d9a8; border-radius: 999px; padding: 5px 14px; margin: 6px auto 0; width: fit-content; }
  .progress { height: 5px; background: #e4e3dc; border-radius: 999px; margin: 22px 0 6px; overflow: hidden; }
  .progress .bar { height: 100%; background: #22221f; border-radius: 999px; transition: width .4s ease; }
  .progress-label { font-size: 11px; color: #77756f; margin: 0 0 8px; text-align: center; }
  .conversation { flex: 1; display: flex; flex-direction: column; gap: 15px; margin-top: 12px; }
  .message { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.5; }
  .who { flex: 0 0 auto; color: #77756f; font-size: 11px; padding-top: 3px; min-width: 28px; }
  .message p { margin: 0; max-width: 480px; }
  .message.user { flex-direction: row-reverse; text-align: right; }
  .message.user .who { color: #22221f; }
  .typing { display: inline-flex; gap: 4px; padding: 6px 0; }
  .typing i { width: 6px; height: 6px; border-radius: 50%; background: #b9b8b1; animation: blink 1.1s infinite; }
  .typing i:nth-child(2) { animation-delay: .2s; } .typing i:nth-child(3) { animation-delay: .4s; }
  @keyframes blink { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
  .captured { margin: 8px 0 10px 38px; padding: 14px 16px; border: 1px solid #e1e0da; border-radius: 10px; background: #f6f5f1; }
  .captured small { color: #77756f; font-size: 11px; display: block; margin-bottom: 7px; }
  .captured div { display: flex; gap: 10px; font-size: 12px; margin-top: 5px; }
  .captured b { min-width: 82px; text-transform: capitalize; } .captured span { color: #65645f; }
  .done { display: flex; align-items: center; gap: 8px; font-size: 13px; background: #eef7ee; border: 1px solid #cfe6cf; color: #2f6b2f; border-radius: 10px; padding: 12px 14px; }
  .done.auth { background: #faf3dd; border-color: #e8d9a8; color: #8a6d1b; }
  .done.auth a { color: inherit; font-weight: 700; }
  form { margin-top: 28px; }
  textarea { width: 100%; box-sizing: border-box; border: 1px solid #dad9d2; border-radius: 11px; background: #f7f6f2; padding: 15px; resize: vertical; font: inherit; font-size: 14px; outline: none; }
  textarea:focus { border-color: #22221f; }
  .composer-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
  button { border: 0; font: inherit; cursor: pointer; }
  .skip { background: none; color: #77756f; text-decoration: underline; text-underline-offset: 3px; font-size: 12px; padding: 8px 0; }
  .send { background: #22221f; color: white; padding: 12px 16px; border-radius: 9px; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
  .send:disabled { opacity: .45; cursor: wait; }
  @media (max-width: 560px) { .shell { padding: 16px 10px; } .card { min-height: calc(100vh - 66px); border-radius: 14px; padding: 32px 20px 22px; } }
</style>
