<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { addToast } from '$lib/stores/toast';
  import { goto } from '$app/navigation';
  import Modal from '$lib/components/Modal.svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    DashboardSquare01Icon, 
    BookOpen01Icon, 
    UserGroupIcon, 
    Search01Icon,
    ShieldBanIcon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';

  type TopPdf = {
    title: string;
    reads: number;
    unique_readers: number;
  };

  type TopUser = {
    user_id?: string;
    anon_id?: string;
    username?: string;
    display_name?: string;
    participant_type: string;
    reading_time_human: string;
    pdf_reads: number;
    ip_address?: string;
    fingerprint?: string;
  };

  let topPdfs = $state<TopPdf[]>([]);
  let topUsers = $state<TopUser[]>([]);
  let isLoading = $state(true);
  let errorMsg = $state('');
  
  let searchQuery = $state('');

  // Quick Ban Modal state
  let isBanModalOpen = $state(false);
  let banTargetUser = $state<TopUser | null>(null);
  let banReason = $state('');
  let isSubmittingBan = $state(false);

  async function loadInsights() {
    isLoading = true;
    errorMsg = '';
    try {
      const q = searchQuery ? `?pdfSearch=${encodeURIComponent(searchQuery)}` : '';
      const res: any = await makeAdminRequest(`reading-insights${q}`, 'GET');
      topPdfs = res.top_pdfs || [];
      topUsers = res.top_users || [];
    } catch (e: any) {
      errorMsg = e.message || 'Failed to load reading insights';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadInsights();
  });
  
  function getDisplayName(user: TopUser) {
    if (user.participant_type === 'anon' || (!user.user_id && user.anon_id)) return 'Anonymous';
    return user.display_name || user.username || user.user_id || 'Unknown User';
  }

  function handleSearch(e: Event) {
    e.preventDefault();
    loadInsights();
  }

  function openBanModal(user: TopUser) {
    banTargetUser = user;
    banReason = '';
    isBanModalOpen = true;
  }

  function closeBanModal() {
    isBanModalOpen = false;
    banTargetUser = null;
    banReason = '';
  }

  async function handleApplyBan() {
    if (!banTargetUser) return;
    if (!banReason.trim()) {
      addToast('Please enter a reason for the ban', 'warning');
      return;
    }

    isSubmittingBan = true;
    try {
      const isAnon = banTargetUser.participant_type === 'anon' || (!banTargetUser.user_id && Boolean(banTargetUser.anon_id || banTargetUser.username));
      const payload: any = {
        target_type: isAnon ? 'anonymous' : 'account',
        reason: banReason.trim(),
        body: banReason.trim()
      };

      if (isAnon) {
        const anonId = banTargetUser.anon_id || banTargetUser.username;
        payload.anon_id = anonId;
        payload.fingerprint = banTargetUser.fingerprint || (anonId ? anonId.split('-')[0] : undefined);
        payload.ip = banTargetUser.ip_address || undefined;
      } else {
        payload.user_id = banTargetUser.user_id;
        payload.username = banTargetUser.username;
        payload.display_name = banTargetUser.display_name;
      }

      await makeAdminRequest('bans', 'POST', payload);
      addToast(`Ban rule applied for ${getDisplayName(banTargetUser)}`, 'success');
      closeBanModal();
    } catch (err: any) {
      addToast(`Failed to ban: ${err.message}`, 'error');
    } finally {
      isSubmittingBan = false;
    }
  }

  function openInBanManager() {
    if (!banTargetUser) return;
    const isAnon = banTargetUser.participant_type === 'anon' || (!banTargetUser.user_id && Boolean(banTargetUser.anon_id || banTargetUser.username));
    const params = new URLSearchParams();

    if (isAnon) {
      params.set('banType', 'anonymous');
      const anonId = banTargetUser.anon_id || banTargetUser.username || '';
      if (anonId) params.set('anonId', anonId);
      const fp = banTargetUser.fingerprint || (anonId ? anonId.split('-')[0] : '');
      if (fp) params.set('fingerprint', fp);
      if (banTargetUser.ip_address) params.set('ip', banTargetUser.ip_address);
    } else {
      params.set('banType', 'account');
      if (banTargetUser.user_id) params.set('userId', banTargetUser.user_id);
      if (banTargetUser.username) params.set('username', banTargetUser.username);
      if (banTargetUser.display_name) params.set('displayName', banTargetUser.display_name);
    }

    closeBanModal();
    goto(`/admin/bans?${params.toString()}`);
  }
</script>

<div class="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
  <div>
    <h1 class="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
      <HugeiconsIcon icon={DashboardSquare01Icon} size={24} class="text-primary" />
      Admin Overview
    </h1>
    <p class="text-muted-foreground mt-1 text-sm">Monitor reading insights, top PDFs, and platform engagement.</p>
  </div>

  {#if errorMsg}
    <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
      {errorMsg}
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    
    <!-- Top PDFs -->
    <div class="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
      <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 mb-4">
        <h3 class="font-semibold text-foreground flex items-center gap-2">
          <HugeiconsIcon icon={BookOpen01Icon} size={18} class="text-blue-500" />
          Top PDFs Read
        </h3>
        <form onsubmit={handleSearch} class="relative w-48">
          <HugeiconsIcon icon={Search01Icon} size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            bind:value={searchQuery} 
            placeholder="Search PDFs..." 
            class="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground transition-all"
          />
        </form>
      </div>

      <div class="flex-1 overflow-auto -mx-2 px-2">
        {#if isLoading}
          <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading data...</div>
        {:else if topPdfs.length === 0}
          <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">No PDF reading data found.</div>
        {:else}
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-muted-foreground sticky top-0 bg-card z-10">
              <tr>
                <th class="px-2 py-1.5 font-medium">#</th>
                <th class="px-2 py-1.5 font-medium">PDF Title</th>
                <th class="px-2 py-1.5 font-medium text-right">Reads</th>
                <th class="px-2 py-1.5 font-medium text-right">Unique Readers</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              {#each topPdfs as pdf, i}
                <tr class="hover:bg-muted/30 transition-colors">
                  <td class="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td class="px-2 py-1.5 font-medium text-foreground truncate max-w-[200px]" title={pdf.title}>{pdf.title || 'Untitled PDF'}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums">{pdf.reads}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{pdf.unique_readers}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>

    <!-- Top Users -->
    <div class="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
      <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 mb-4">
        <h3 class="font-semibold text-foreground flex items-center gap-2">
          <HugeiconsIcon icon={UserGroupIcon} size={18} class="text-amber-500" />
          Top Users by Reading Time
        </h3>
      </div>

      <div class="flex-1 overflow-auto -mx-2 px-2">
        {#if isLoading}
          <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading data...</div>
        {:else if topUsers.length === 0}
          <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">No user reading data found.</div>
        {:else}
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-muted-foreground sticky top-0 bg-card z-10">
              <tr>
                <th class="px-2 py-1.5 font-medium">#</th>
                <th class="px-2 py-1.5 font-medium">User</th>
                <th class="px-2 py-1.5 font-medium text-right">Reading Time</th>
                <th class="px-2 py-1.5 font-medium text-right">PDFs</th>
                <th class="px-2 py-1.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              {#each topUsers as user, i}
                <tr class="hover:bg-muted/30 transition-colors group">
                  <td class="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td class="px-2 py-1.5">
                    <div class="flex flex-col">
                      <span class="font-medium text-foreground truncate max-w-[140px]" title={getDisplayName(user)}>{getDisplayName(user)}</span>
                      {#if user.participant_type === 'anon' || (!user.user_id && user.anon_id)}
                        <span class="text-[10px] text-muted-foreground uppercase font-mono">{String(user.anon_id || user.username).slice(-8)}</span>
                      {:else if user.username}
                        <span class="text-[10px] text-muted-foreground truncate">@{user.username}</span>
                      {/if}
                    </div>
                  </td>
                  <td class="px-2 py-1.5 text-right tabular-nums text-primary font-medium">{user.reading_time_human || '00:00:00'}</td>
                  <td class="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{user.pdf_reads || 0}</td>
                  <td class="px-2 py-1.5 text-right">
                    <button 
                      type="button"
                      onclick={() => openBanModal(user)}
                      class="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors inline-flex items-center justify-center"
                      title="Ban this user / profile"
                    >
                      <HugeiconsIcon icon={ShieldBanIcon} size={15} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick Ban Modal -->
  <Modal bind:isOpen={isBanModalOpen} title="Ban User" onClose={closeBanModal}>
    {#if banTargetUser}
      <div class="space-y-4">
        <div class="text-sm">
          <span class="text-muted-foreground">Target: </span>
          <span class="font-medium text-foreground">{getDisplayName(banTargetUser)}</span>
          {#if banTargetUser.username && banTargetUser.participant_type !== 'anon'}
            <span class="text-muted-foreground"> (@{banTargetUser.username})</span>
          {/if}
        </div>

        <div class="space-y-1.5">
          <label for="modalBanReason" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Reason for Ban *
          </label>
          <input
            id="modalBanReason"
            type="text"
            bind:value={banReason}
            placeholder="e.g. Abusive behavior, spam"
            required
            class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all"
          />
        </div>

        <div class="flex items-center justify-between pt-4">
          <button
            type="button"
            onclick={openInBanManager}
            class="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Open in Ban Manager
          </button>
          
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={closeBanModal}
              class="btn-base btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={handleApplyBan}
              disabled={isSubmittingBan}
              class="btn-base btn-destructive"
            >
              {isSubmittingBan ? 'Applying...' : 'Apply Ban'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </Modal>

</div>
