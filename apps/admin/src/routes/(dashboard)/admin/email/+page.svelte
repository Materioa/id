<svelte:head><title>Email — Materio Admin</title></svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { makeAdminRequest } from '$lib/api/admin';
  import { addToast } from '$lib/stores/toast';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Mail01Icon,
    RefreshIcon,
    Delete01Icon,
    Add01Icon,
    Search01Icon
  } from '@hugeicons/core-free-icons';
  import Modal from '$lib/components/Modal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  type EmailItem = {
    id: string;
    direction: 'inbox' | 'sent';
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text?: string;
    html?: string;
    read?: boolean;
    createdAt: string;
  };

  let activeTab = $state<'inbox' | 'sent'>('inbox');
  let emails = $state<EmailItem[]>([]);
  let unreadCount = $state(0);
  let isLoading = $state(true);
  let search = $state('');

  let selectedEmail = $state<EmailItem | null>(null);
  let viewModalOpen = $state(false);
  let showQuotedText = $state(false);

  function getMessageQuotes(msg?: EmailItem | null): { clean: string; quote: string | null } {
    if (!msg || !msg.text) return { clean: '', quote: null };
    const norm = msg.text.replace(/\r\n/g, '\n');
    const m = norm.match(/\n\s*(?:On\s+[\s\S]+?wrote:|--- On\s+[\s\S]+?wrote: ---|-----Original Message-----|From:[^\n]+\nSent:[^\n]+)[\s\S]*$/i);
    if (m && typeof m.index === 'number') {
      const clean = norm.slice(0, m.index).trim();
      const quote = norm.slice(m.index).trim();
      if (clean) return { clean, quote };
    }
    const bq = norm.match(/\n(?:\s*>[^\n]*\n*)+$/);
    if (bq && typeof bq.index === 'number') {
      const clean = norm.slice(0, bq.index).trim();
      const quote = norm.slice(bq.index).trim();
      if (clean) return { clean, quote };
    }
    return { clean: msg.text, quote: null };
  }

  let composeOpen = $state(false);
  let isSending = $state(false);
  let composeTo = $state('');
  let composeSubject = $state('');
  let composeBody = $state('');
  let composeFrom = $state('support@getmaterio.app');

  let deleteTarget = $state<EmailItem | null>(null);
  let confirmDeleteOpen = $state(false);

  async function loadEmails() {
    isLoading = true;
    try {
      const res: any = await makeAdminRequest(`email?folder=${activeTab}&search=${encodeURIComponent(search)}`, 'GET');
      emails = res.emails || [];
      unreadCount = res.unreadCount || 0;
    } catch (e: any) {
      addToast(e.message || 'Unable to load emails', 'error');
    } finally {
      isLoading = false;
    }
  }

  onMount(loadEmails);

  function openCompose(preset?: { to?: string; subject?: string; body?: string }) {
    composeTo = preset?.to || '';
    composeSubject = preset?.subject || '';
    composeBody = preset?.body || '';
    composeFrom = 'support@getmaterio.app';
    composeOpen = true;
  }

  function replyTo(email: EmailItem) {
    const target = email.direction === 'inbox' ? email.from : email.to;
    const match = target.match(/<([^>]+)>/);
    const cleanTo = match ? match[1] : target;
    const sub = email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`;
    const quote = `\n\n--- On ${new Date(email.createdAt).toLocaleDateString()}, ${email.from} wrote: ---\n${email.text || ''}`;

    viewModalOpen = false;
    openCompose({
      to: cleanTo,
      subject: sub,
      body: quote
    });
  }

  async function sendEmail() {
    if (!composeTo.trim()) { addToast('Enter a recipient email', 'error'); return; }
    if (!composeSubject.trim()) { addToast('Enter a subject', 'error'); return; }
    if (!composeBody.trim()) { addToast('Write a message', 'error'); return; }

    isSending = true;
    try {
      await makeAdminRequest('email', 'POST', {
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        text: composeBody,
        from: composeFrom.trim(),
        replyTo: composeFrom.trim().includes('@') ? composeFrom.trim() : 'support@getmaterio.app'
      });
      addToast('Email sent', 'success');
      composeOpen = false;
      composeTo = '';
      composeSubject = '';
      composeBody = '';
      if (activeTab === 'sent') await loadEmails();
    } catch (e: any) {
      addToast(e.message || 'Failed to send email', 'error');
    } finally {
      isSending = false;
    }
  }

  async function toggleRead(email: EmailItem) {
    try {
      const next = !email.read;
      await makeAdminRequest('email', 'PATCH', { id: email.id, read: next });
      email.read = next;
      emails = [...emails];
      if (next) unreadCount = Math.max(0, unreadCount - 1);
      else unreadCount++;
    } catch {}
  }

  async function deleteEmail() {
    if (!deleteTarget) return;
    try {
      await makeAdminRequest(`email?id=${encodeURIComponent(deleteTarget.id)}`, 'DELETE');
      emails = emails.filter((e) => e.id !== deleteTarget!.id);
      addToast('Deleted', 'success');
      deleteTarget = null;
      if (selectedEmail?.id === deleteTarget?.id) {
        selectedEmail = null;
        viewModalOpen = false;
      }
    } catch (e: any) {
      addToast(e.message || 'Unable to delete', 'error');
    }
  }

  let visibleEmails = $derived.by(() => {
    let list = emails;
    if (activeTab === 'inbox') list = list.filter((e) => e.direction === 'inbox');
    else if (activeTab === 'sent') list = list.filter((e) => e.direction === 'sent');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.subject.toLowerCase().includes(q) ||
        e.to.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        (e.text || '').toLowerCase().includes(q)
      );
    }
    return list;
  });
</script>

<div class="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
  <!-- Minimal Header -->
  <div class="flex items-center justify-between pb-4 border-b border-border/40">
    <div>
      <h1 class="text-xl sm:text-2xl font-serif font-normal tracking-tight">Email</h1>
      <p class="text-muted-foreground text-xs mt-0.5">Inbox and sent messages</p>
    </div>
    <div class="flex items-center gap-2">
      <button class="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors" onclick={loadEmails} title="Refresh">
        <HugeiconsIcon icon={RefreshIcon} size={15} />
      </button>
      <button class="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 transition-colors" onclick={() => openCompose()}>
        <HugeiconsIcon icon={Add01Icon} size={14} />
        New Message
      </button>
    </div>
  </div>

  <!-- Tabs & Search -->
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <div class="flex items-center gap-1 p-1 bg-muted/40 rounded-lg">
      <button
        onclick={() => { activeTab = 'inbox'; loadEmails(); }}
        class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors {activeTab === 'inbox' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
      >
        Inbox {#if unreadCount > 0}<span class="ml-1 opacity-75 font-semibold">({unreadCount})</span>{/if}
      </button>
      <button
        onclick={() => { activeTab = 'sent'; loadEmails(); }}
        class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors {activeTab === 'sent' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
      >
        Sent
      </button>
    </div>

    <div class="relative min-w-48 sm:min-w-64">
      <input
        class="w-full border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs bg-background text-foreground outline-none focus:border-foreground/30"
        placeholder="Search..."
        bind:value={search}
        oninput={loadEmails}
      />
      <div class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <HugeiconsIcon icon={Search01Icon} size={13} />
      </div>
    </div>
  </div>

  <!-- Messages List -->
  {#if isLoading}
    <div class="py-16 text-center text-muted-foreground text-xs">Loading...</div>
  {:else if visibleEmails.length === 0}
    <div class="py-16 text-center text-muted-foreground text-xs border border-dashed border-border/60 rounded-xl">
      No messages.
    </div>
  {:else}
    <div class="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden bg-card/40">
      {#each visibleEmails as email (email.id)}
        <div
          role="button"
          tabindex="0"
          class="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer {email.direction === 'inbox' && !email.read ? 'font-medium bg-muted/10' : ''}"
          onclick={() => { selectedEmail = email; showQuotedText = false; viewModalOpen = true; if (!email.read) toggleRead(email); }}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectedEmail = email; showQuotedText = false; viewModalOpen = true; if (!email.read) toggleRead(email); } }}
        >
          <div class="flex items-center gap-3 min-w-0 flex-1">
            {#if email.direction === 'inbox'}
              <button
                class="size-2 rounded-full shrink-0 transition-all {email.read ? 'bg-transparent border border-muted-foreground/30' : 'bg-primary'}"
                onclick={(e) => { e.stopPropagation(); toggleRead(email); }}
                title={email.read ? 'Mark unread' : 'Mark read'}
              ></button>
            {/if}

            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-xs truncate text-foreground font-medium">
                  {email.direction === 'inbox' ? email.from : email.to}
                </span>
                <span class="text-[11px] text-muted-foreground shrink-0 font-normal">
                  {email.createdAt ? new Date(email.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
              <p class="text-xs text-foreground/90 truncate mt-0.5">
                {email.subject}
              </p>
              <p class="text-[11px] text-muted-foreground truncate font-normal mt-0.5">
                {email.text || (email.html ? email.html.replace(/<[^>]*>?/gm, '') : '')}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button class="p-1.5 rounded text-muted-foreground hover:text-foreground" onclick={(e) => { e.stopPropagation(); replyTo(email); }} title="Reply">
              <HugeiconsIcon icon={Mail01Icon} size={14} />
            </button>
            <button class="p-1.5 rounded text-muted-foreground hover:text-destructive" onclick={(e) => { e.stopPropagation(); deleteTarget = email; confirmDeleteOpen = true; }} title="Delete">
              <HugeiconsIcon icon={Delete01Icon} size={14} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Compose Modal -->
<Modal bind:isOpen={composeOpen} title="New Message" onClose={() => composeOpen = false} maxWidthClass="sm:max-w-2xl md:max-w-3xl">
  <div class="space-y-3 text-xs">
    <div>
      <span class="text-muted-foreground block mb-1">From</span>
      <input
        class="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground outline-none text-xs"
        bind:value={composeFrom}
        placeholder="support@getmaterio.app"
      />
    </div>

    <div>
      <span class="text-muted-foreground block mb-1">To</span>
      <input
        class="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground outline-none text-xs"
        placeholder="name@example.com"
        bind:value={composeTo}
      />
    </div>

    <div>
      <span class="text-muted-foreground block mb-1">Subject</span>
      <input
        class="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground outline-none text-xs"
        placeholder="Subject line"
        bind:value={composeSubject}
      />
    </div>

    <div>
      <span class="text-muted-foreground block mb-1">Message</span>
      <textarea
        rows="7"
        class="w-full border border-border rounded-lg p-3 bg-background text-foreground outline-none text-xs resize-y"
        placeholder="Write your message..."
        bind:value={composeBody}
      ></textarea>
    </div>

    <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
      <button class="px-3.5 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer" onclick={() => composeOpen = false}>
        Cancel
      </button>
      <button class="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer" onclick={sendEmail} disabled={isSending}>
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </div>
  </div>
</Modal>

<!-- View Message Modal -->
<Modal bind:isOpen={viewModalOpen} title={selectedEmail ? selectedEmail.subject : 'Message'} onClose={() => { viewModalOpen = false; selectedEmail = null; showQuotedText = false; }} maxWidthClass="sm:max-w-2xl lg:max-w-3xl">
  {#if selectedEmail}
    {@const parsed = getMessageQuotes(selectedEmail)}
    <div class="space-y-4 text-xs">
      <div class="pb-3 border-b border-border/40 space-y-1">
        <div class="flex items-baseline justify-between text-muted-foreground flex-wrap gap-2">
          <span>From: <strong class="text-foreground">{selectedEmail.from}</strong></span>
          <span class="text-[11px]">{selectedEmail.createdAt ? new Date(selectedEmail.createdAt).toLocaleString() : ''}</span>
        </div>
        <div class="text-muted-foreground">To: <span class="text-foreground">{selectedEmail.to}</span></div>
      </div>

      <div class="min-h-32 leading-relaxed text-foreground text-xs space-y-2.5">
        {#if selectedEmail.html}
          <div class="email-html-body overflow-x-auto max-w-none text-xs leading-relaxed">
            {@html selectedEmail.html}
          </div>
        {:else}
          <div class="whitespace-pre-wrap leading-relaxed text-foreground text-xs font-sans">
            {parsed.clean || selectedEmail.text || 'No message content'}
          </div>
        {/if}

        {#if parsed.quote && !selectedEmail.html}
          <div class="pt-1">
            <button
              type="button"
              class="px-2 py-0.5 rounded text-[11px] font-mono tracking-wider text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 transition-colors inline-flex items-center gap-1 cursor-pointer"
              onclick={() => (showQuotedText = !showQuotedText)}
              title="Toggle quoted email history"
            >
              <span>···</span>
              <span class="text-[10px] font-sans opacity-75">{showQuotedText ? 'Hide quoted text' : 'Show quoted text'}</span>
            </button>
            {#if showQuotedText}
              <div class="mt-2 pl-3 border-l-2 border-border/60 text-[11px] text-muted-foreground/80 whitespace-pre-wrap leading-relaxed font-sans bg-muted/20 p-2.5 rounded-r-lg max-h-60 overflow-y-auto">
                {parsed.quote}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-border/40">
        <button class="text-destructive text-xs hover:underline cursor-pointer" onclick={() => { deleteTarget = selectedEmail; confirmDeleteOpen = true; }}>
          Delete
        </button>
        <div class="flex items-center gap-2">
          <button class="px-3.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer" onclick={() => { viewModalOpen = false; showQuotedText = false; }}>
            Close
          </button>
          <button class="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity" onclick={() => replyTo(selectedEmail!)}>
            Reply
          </button>
        </div>
      </div>
    </div>
  {/if}
</Modal>

<ConfirmModal
  bind:isOpen={confirmDeleteOpen}
  title="Delete message?"
  message="Are you sure you want to delete this message?"
  confirmText="Delete"
  onConfirm={deleteEmail}
  onCancel={() => deleteTarget = null}
/>
