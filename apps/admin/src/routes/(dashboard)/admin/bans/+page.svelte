<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { makeAdminRequest } from '$lib/api/admin';
  import { addToast } from '$lib/stores/toast';

  interface UserSearchResult {
    id: string;
    username: string;
    display_name?: string;
    email?: string;
    profile_picture?: string;
  }

  interface ModerationRule {
    id: string;
    action: string;
    active: boolean;
    target_type: 'account' | 'anonymous';
    user_id?: string;
    username?: string;
    display_name?: string;
    email?: string;
    profile_picture?: string;
    anon_id?: string;
    fingerprint?: string;
    ip?: string;
    reason: string;
    created_at: string;
  }

  let bans = $state<ModerationRule[]>([]);
  let isLoading = $state(true);
  let error = $state('');

  // Ban Type: 'account' | 'anonymous'
  let banType = $state<'account' | 'anonymous'>('account');

  // Account combobox states
  let userSearchQuery = $state('');
  let isSearchingUsers = $state(false);
  let userSearchResults = $state<UserSearchResult[]>([]);
  let isComboboxOpen = $state(false);
  let selectedUser = $state<UserSearchResult | null>(null);
  let searchTimeout: any = null;

  // Anonymous states
  let newAnonId = $state('');
  let newFingerprint = $state('');
  let newIp = $state('');

  // Reason
  let newReason = $state('');
  let isBanning = $state(false);

  async function loadBans() {
    isLoading = true;
    error = '';
    try {
      const data = await makeAdminRequest('bans') as any;
      bans = data.bans || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  function handleSearchInput(e: Event) {
    userSearchQuery = (e.target as HTMLInputElement).value;
    isComboboxOpen = true;

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const q = userSearchQuery.trim();
      if (!q) {
        userSearchResults = [];
        return;
      }
      isSearchingUsers = true;
      try {
        const res = await makeAdminRequest(`users/search?q=${encodeURIComponent(q)}`) as any;
        userSearchResults = res.users || [];
      } catch {
        userSearchResults = [];
      } finally {
        isSearchingUsers = false;
      }
    }, 200);
  }

  function selectUser(user: UserSearchResult) {
    selectedUser = user;
    userSearchQuery = `@${user.username}`;
    isComboboxOpen = false;
  }

  function clearSelectedUser() {
    selectedUser = null;
    userSearchQuery = '';
    userSearchResults = [];
  }

  async function createBan() {
    if (!newReason.trim()) {
      addToast('Please provide a reason for the ban', 'warning');
      return;
    }

    if (banType === 'account') {
      if (!selectedUser && !userSearchQuery.trim()) {
        addToast('Please select a user to ban', 'warning');
        return;
      }
    } else {
      if (!newAnonId.trim() && !newFingerprint.trim() && !newIp.trim()) {
        addToast('Please provide at least one identifier to ban (Anon ID, Fingerprint, or IP)', 'warning');
        return;
      }
    }

    isBanning = true;
    try {
      const payload: any = {
        target_type: banType,
        reason: newReason.trim()
      };

      if (banType === 'account') {
        if (selectedUser) {
          payload.user_id = selectedUser.id;
          payload.username = selectedUser.username;
          payload.display_name = selectedUser.display_name;
          payload.email = selectedUser.email;
          payload.profile_picture = selectedUser.profile_picture;
        } else {
          payload.username = userSearchQuery.trim().replace(/^@/, '');
        }
      } else {
        payload.anon_id = newAnonId.trim() || undefined;
        payload.fingerprint = newFingerprint.trim() || undefined;
        payload.ip = newIp.trim() || undefined;
      }

      await makeAdminRequest('bans', 'POST', payload);
      addToast('Ban applied successfully', 'success');

      clearSelectedUser();
      newAnonId = '';
      newFingerprint = '';
      newIp = '';
      newReason = '';
      await loadBans();
    } catch (e: any) {
      addToast(`Error: ${e.message}`, 'error');
    } finally {
      isBanning = false;
    }
  }

  async function toggleBanActive(ban: ModerationRule) {
    try {
      const next = !ban.active;
      await makeAdminRequest('bans', 'PATCH', { id: ban.id, active: next });
      ban.active = next;
    } catch (e: any) {
      addToast(`Failed: ${e.message}`, 'error');
    }
  }

  async function deleteBan(id: string) {
    if (!confirm('Are you sure you want to lift this ban?')) return;
    try {
      await makeAdminRequest(`bans?id=${id}`, 'DELETE');
      await loadBans();
    } catch (e: any) {
      addToast(`Error: ${e.message}`, 'error');
    }
  }

  onMount(() => {
    const params = $page.url.searchParams;
    const type = params.get('type') || params.get('banType');
    if (type === 'account' || type === 'anonymous') {
      banType = type;
    }
    if (params.get('userId') || params.get('username')) {
      banType = 'account';
      selectedUser = {
        id: params.get('userId') || '',
        username: params.get('username') || '',
        display_name: params.get('displayName') || undefined
      };
      userSearchQuery = `@${selectedUser.username || selectedUser.id}`;
    }
    if (params.get('anonId')) {
      banType = 'anonymous';
      newAnonId = params.get('anonId') || '';
    }
    if (params.get('fingerprint')) {
      banType = 'anonymous';
      newFingerprint = params.get('fingerprint') || '';
    }
    if (params.get('ip')) {
      banType = 'anonymous';
      newIp = params.get('ip') || '';
    }
    loadBans();
  });
</script>

<svelte:window onclick={(e) => {
  const el = e.target as HTMLElement;
  if (!el.closest('.combobox-wrapper')) {
    isComboboxOpen = false;
  }
}} />

<div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-foreground">Ban Management</h1>
    <p class="text-sm text-muted-foreground mt-1">Warn or ban abusive identities and Materio IDs.</p>
  </div>

  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-sm">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Form Side -->
    <div class="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-border/50 pb-8 lg:pb-0 lg:pr-8 space-y-5">
      <div class="border-b border-border/50 pb-3 flex items-center justify-between">
        <h3 class="font-semibold text-foreground">Create New Ban</h3>
        <div class="flex items-center gap-2 text-xs">
          <button
            type="button"
            onclick={() => banType = 'account'}
            class="font-medium transition-colors {banType === 'account' ? 'text-primary underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'}"
          >
            Materio ID
          </button>
          <span class="text-border">|</span>
          <button
            type="button"
            onclick={() => banType = 'anonymous'}
            class="font-medium transition-colors {banType === 'anonymous' ? 'text-primary underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'}"
          >
            Anonymous
          </button>
        </div>
      </div>

      <div class="space-y-4">
        {#if banType === 'account'}
          <div class="space-y-1.5 relative combobox-wrapper">
            <label for="userComboboxInput" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              User *
            </label>

            {#if selectedUser}
              <div class="flex items-center justify-between py-2 border-b border-border/50">
                <div class="flex items-center gap-2.5">
                  {#if selectedUser.profile_picture}
                    <img src={selectedUser.profile_picture} alt="" class="w-8 h-8 rounded-full object-cover border border-border/50" />
                  {:else}
                    <div class="w-8 h-8 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-xs">
                      {String(selectedUser.display_name || selectedUser.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  {/if}
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-foreground leading-tight">
                      {selectedUser.display_name || selectedUser.username}
                    </span>
                    <span class="text-xs text-muted-foreground leading-tight">
                      @{selectedUser.username}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onclick={clearSelectedUser}
                  class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Change
                </button>
              </div>
            {:else}
              <input
                id="userComboboxInput"
                type="text"
                value={userSearchQuery}
                oninput={handleSearchInput}
                onfocus={() => isComboboxOpen = true}
                placeholder="Type name or @username..."
                class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all"
              />

              {#if isComboboxOpen && (userSearchResults.length > 0 || (userSearchQuery.trim() && !isSearchingUsers))}
                <div class="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-border/40">
                  {#if userSearchResults.length === 0}
                    <div class="p-3 text-xs text-muted-foreground text-center">No users found</div>
                  {:else}
                    {#each userSearchResults as u}
                      <button
                        type="button"
                        onclick={() => selectUser(u)}
                        class="w-full flex items-center gap-2.5 p-2 hover:bg-muted/40 transition-colors text-left"
                      >
                        {#if u.profile_picture}
                          <img src={u.profile_picture} alt="" class="w-7 h-7 rounded-full object-cover border border-border/50 shrink-0" />
                        {:else}
                          <div class="w-7 h-7 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-xs shrink-0">
                            {String(u.display_name || u.username || 'U').charAt(0).toUpperCase()}
                          </div>
                        {/if}
                        <div class="flex flex-col min-w-0">
                          <span class="text-xs font-medium text-foreground truncate">
                            {u.display_name || u.username}
                          </span>
                          <span class="text-[11px] text-muted-foreground truncate">
                            @{u.username}
                          </span>
                        </div>
                      </button>
                    {/each}
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        {:else}
          <div class="space-y-1.5">
            <label for="anonId" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anon ID</label>
            <input type="text" id="anonId" bind:value={newAnonId} placeholder="from analytics" class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all font-mono" />
          </div>
          
          <div class="space-y-1.5">
            <label for="fingerprint" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Fingerprint</label>
            <input type="text" id="fingerprint" bind:value={newFingerprint} placeholder="fingerprint hash" class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all font-mono" />
          </div>
          
          <div class="space-y-1.5">
            <label for="ip" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP Address</label>
            <input type="text" id="ip" bind:value={newIp} placeholder="x.x.x.x" class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all font-mono" />
          </div>
        {/if}

        <div class="space-y-1.5">
          <label for="reason" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason for Ban *</label>
          <input type="text" id="reason" bind:value={newReason} placeholder="e.g. Abusive behavior, spam" required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
        </div>

        <button 
          type="button"
          onclick={createBan} 
          disabled={isBanning} 
          class="w-full btn-base btn-destructive !text-white font-semibold mt-4 shadow-sm"
        >
          {isBanning ? 'Processing...' : 'Apply Ban'}
        </button>
      </div>
    </div>

    <!-- List Side -->
    <div class="lg:col-span-2 space-y-4">
      <div class="flex items-center justify-between pb-1">
        <h3 class="font-semibold text-foreground text-sm">Existing Moderation Rules</h3>
        <span class="text-xs text-muted-foreground">{bans.length} {bans.length === 1 ? 'rule' : 'rules'}</span>
      </div>

      <!-- Mobile Cards View (< md) -->
      <div class="block md:hidden space-y-3">
        {#if isLoading}
          <div class="p-6 text-center text-sm text-muted-foreground bg-card/30 border border-border/50 rounded-xl">
            Loading bans...
          </div>
        {:else if bans.length === 0}
          <div class="p-6 text-center text-sm text-muted-foreground bg-card/30 border border-dashed border-border/50 rounded-xl">
            No bans found.
          </div>
        {:else}
          {#each bans as ban}
            <div class="p-4 bg-card/40 border border-border/60 rounded-xl space-y-3">
              <div class="flex items-start justify-between gap-2">
                <!-- Target User/Anon -->
                <div class="flex items-center gap-2.5 min-w-0">
                  {#if ban.target_type === 'account' || ban.user_id || ban.username}
                    {#if ban.profile_picture}
                      <img src={ban.profile_picture} alt="" class="w-8 h-8 rounded-full object-cover border border-border/50 shrink-0" />
                    {:else}
                      <div class="w-8 h-8 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-xs shrink-0">
                        {String(ban.display_name || ban.username || 'U').charAt(0).toUpperCase()}
                      </div>
                    {/if}
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-semibold text-foreground truncate">
                        {ban.display_name || ban.username}
                      </span>
                      <span class="text-xs text-muted-foreground truncate">
                        @{ban.username}
                      </span>
                    </div>
                  {:else}
                    <div class="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs shrink-0 font-medium">
                      ?
                    </div>
                    <div class="flex flex-col">
                      <span class="text-sm font-semibold text-foreground">Anonymous</span>
                      <span class="text-xs text-muted-foreground">Device / IP</span>
                    </div>
                  {/if}
                </div>

                <!-- Status Toggle Badge -->
                <button
                  type="button"
                  onclick={() => toggleBanActive(ban)}
                  class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 {ban.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border/50'}"
                >
                  {ban.active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <!-- Identifier & Reason -->
              <div class="space-y-1.5 pt-1 text-xs">
                <div class="flex items-center gap-1.5 text-muted-foreground font-mono bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border/30 break-all text-[11px]">
                  <span class="text-[10px] uppercase font-semibold text-muted-foreground/80 tracking-wider shrink-0">ID:</span>
                  <span class="truncate">{ban.target_type === 'account' ? (ban.email || ban.user_id || '-') : (ban.anon_id || ban.fingerprint || ban.ip || '-')}</span>
                </div>

                {#if ban.reason}
                  <div class="text-foreground text-xs leading-relaxed px-0.5">
                    <span class="text-muted-foreground">Reason:</span> <span class="font-medium text-foreground">{ban.reason}</span>
                  </div>
                {/if}
              </div>

              <!-- Footer with Date and Action -->
              <div class="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                <span class="text-muted-foreground text-[11px]">
                  {new Date(ban.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <button
                  type="button"
                  onclick={() => deleteBan(ban.id)}
                  class="btn-base btn-secondary !px-3 !py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Unban
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Desktop Table View (>= md) -->
      <div class="hidden md:block overflow-hidden border border-border/50 rounded-xl bg-card/30">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="bg-muted/30 text-muted-foreground border-b border-border/50">
              <tr>
                <th class="px-6 py-4 font-medium">Target</th>
                <th class="px-6 py-4 font-medium">Identifier</th>
                <th class="px-6 py-4 font-medium">Reason</th>
                <th class="px-6 py-4 font-medium text-center">Status</th>
                <th class="px-6 py-4 font-medium">Date</th>
                <th class="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/50">
              {#if isLoading}
                <tr>
                  <td colspan="6" class="px-6 py-8 text-center text-muted-foreground">Loading bans...</td>
                </tr>
              {:else if bans.length === 0}
                <tr>
                  <td colspan="6" class="px-6 py-8 text-center text-muted-foreground border-dashed border-t">No bans found.</td>
                </tr>
              {:else}
                {#each bans as ban}
                  <tr class="hover:bg-muted/30 transition-colors group">
                    <td class="px-6 py-4">
                      {#if ban.target_type === 'account' || ban.user_id || ban.username}
                        <div class="flex items-center gap-2">
                          {#if ban.profile_picture}
                            <img src={ban.profile_picture} alt="" class="w-6 h-6 rounded-full object-cover border border-border/50" />
                          {:else}
                            <div class="w-6 h-6 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-[10px]">
                              {String(ban.display_name || ban.username || 'U').charAt(0).toUpperCase()}
                            </div>
                          {/if}
                          <div class="flex flex-col">
                            <span class="text-xs font-medium text-foreground">{ban.display_name || ban.username}</span>
                            <span class="text-[10px] text-muted-foreground">@{ban.username}</span>
                          </div>
                        </div>
                      {:else}
                        <span class="text-xs text-muted-foreground">Anonymous</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 font-mono text-xs text-muted-foreground max-w-[180px] truncate" title={ban.target_type === 'account' ? (ban.email || ban.user_id || '-') : (ban.anon_id || ban.fingerprint || ban.ip || '-')}>
                      {ban.target_type === 'account' ? (ban.email || ban.user_id || '-') : (ban.anon_id || ban.fingerprint || ban.ip || '-')}
                    </td>
                    <td class="px-6 py-4 text-foreground font-medium text-xs max-w-[200px] truncate" title={ban.reason}>
                      {ban.reason}
                    </td>
                    <td class="px-6 py-4 text-center">
                      <button
                        type="button"
                        onclick={() => toggleBanActive(ban)}
                        class="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors {ban.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border/50'}"
                      >
                        {ban.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td class="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(ban.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 text-right">
                      <button 
                        type="button"
                        onclick={() => deleteBan(ban.id)} 
                        class="text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-all text-xs font-medium"
                      >
                        Unban
                      </button>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
