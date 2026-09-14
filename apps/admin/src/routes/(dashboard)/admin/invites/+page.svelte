<script lang="ts">
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import Modal from '$lib/components/Modal.svelte';
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { PlusSignIcon, Delete01Icon, Copy01Icon, Shield01Icon, ZapIcon } from '@hugeicons/core-free-icons';
  import { fade } from 'svelte/transition';

  let invites = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state('');
  
  let totalInvites = $derived(invites.length);
  let activeInvites = $derived(invites.filter(i => new Date(i.expires_at) >= new Date() && !i.redeemed).length);
  let totalUses = $derived(invites.reduce((total, invite) => total + (invite.current_uses || 0), 0));

  // Form states
    let isInviteModalOpen = $state(false);
  let newExpires = $state(30);
  let customCode = $state('');
  let maxUses = $state(1);
  let isGenerating = $state(false);

  // Confirmation Modal state
  let isConfirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmAction = $state<(() => Promise<void>) | null>(null);
  let isConfirming = $state(false);

  async function loadInvites() {
    isLoading = true;
    error = '';
    try {
      const data = await makeAdminRequest('invites') as any;
      invites = data.invites || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function generateInvite(isPlus: boolean = false) {
    isGenerating = true;
    try {
      await makeAdminRequest('invites', 'POST', {
        containsPlusPerks: isPlus,
        expiresInDays: newExpires,
        customCode: customCode.trim() || undefined,
        maxUses: Math.max(1, maxUses)
      });
      // reset form
      customCode = '';
      maxUses = 1;
      newExpires = 30;
      await loadInvites();
    } catch (e: any) {
      addToast(`Error: ${e.message}`);
    } finally {
      isGenerating = false;
    }
  }

  function deleteInvite(code: string) {
    confirmTitle = 'Delete Invite Code';
    confirmMessage = 'Are you sure you want to delete this invite code? This action cannot be undone.';
    confirmAction = async () => {
      await makeAdminRequest(`invites?code=${code}`, 'DELETE');
      await loadInvites();
    };
    isConfirmOpen = true;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard!');
  }

  function toggleAdmin(userId: string, makeAdmin: boolean) {
    confirmTitle = makeAdmin ? 'Grant Admin Privileges' : 'Remove Admin Privileges';
    confirmMessage = `Are you sure you want to ${makeAdmin ? 'grant' : 'remove'} admin privileges for this user?`;
    confirmAction = async () => {
      await makeAdminRequest('users/toggle-admin', 'POST', { userId, makeAdmin });
      await loadInvites();
    };
    isConfirmOpen = true;
  }

  function togglePlus(userId: string, makePlus: boolean) {
    confirmTitle = makePlus ? 'Grant Plus Privileges' : 'Remove Plus Privileges';
    confirmMessage = `Are you sure you want to ${makePlus ? 'grant' : 'remove'} Plus privileges for this user?`;
    confirmAction = async () => {
      await makeAdminRequest('users/toggle-plus', 'POST', { userId, makePlus });
      await loadInvites();
    };
    isConfirmOpen = true;
  }

  async function executeConfirm() {
    if (!confirmAction) return;
    isConfirming = true;
    try {
      await confirmAction();
    } catch (e: any) {
      addToast(`Error: ${e.message}`);
    } finally {
      isConfirming = false;
      isConfirmOpen = false;
    }
  }

  onMount(() => {
    loadInvites();
  });
</script>

<div class="space-y-6 max-w-4xl mx-auto" in:fade>
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Invite Management</h1>
      <p class="text-sm text-muted-foreground mt-1">Generate and manage system invitation codes.</p>
    </div>
  </div>

  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-sm">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/50 pb-8 mb-8 tabular-nums">
    <div class="p-4 flex flex-col justify-center">
      <p class="text-sm font-medium text-muted-foreground">Total Invites</p>
      <p class="text-2xl font-bold text-foreground">{totalInvites}</p>
    </div>
    <div class="p-4 flex flex-col justify-center border-l border-border/50">
      <p class="text-sm font-medium text-muted-foreground">Active Invites</p>
      <p class="text-2xl font-bold text-foreground">{activeInvites}</p>
    </div>
    <div class="p-4 flex flex-col justify-center border-l border-border/50">
      <p class="text-sm font-medium text-muted-foreground">Total Uses</p>
      <p class="text-2xl font-bold text-foreground">{totalUses}</p>
    </div>
  </div>

  <!-- Form Modal -->
  <Modal bind:isOpen={isInviteModalOpen} title="Generate New Invite">
    <div class="p-6 space-y-4">
      <div class="space-y-4">
        <div class="space-y-2">
          <label for="customCode" class="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">Custom Code (Optional)</label>
          <input type="text" id="customCode" bind:value={customCode} placeholder="Leave empty for random" class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all uppercase tracking-wider font-mono" />
        </div>
        <div class="flex gap-4">
          <div class="space-y-2 w-1/2">
            <label for="expires" class="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">Expires In (Days)</label>
            <input type="number" id="expires" bind:value={newExpires} min="1" max="365" class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
          </div>
          <div class="space-y-2 w-1/2">
            <label for="uses" class="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">Max Uses</label>
            <input type="number" id="uses" bind:value={maxUses} min="1" class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
          </div>
        </div>
      </div>
      <div class="flex gap-4">
        <button onclick={() => { generateInvite(false); isInviteModalOpen = false; }} disabled={isGenerating} class="w-full btn-base btn-primary">
          <HugeiconsIcon icon={PlusSignIcon} size={16} />
          {isGenerating ? 'Generating...' : 'Regular Invite'}
        </button>
        <button onclick={() => { generateInvite(true); isInviteModalOpen = false; }} disabled={isGenerating} class="w-full btn-base btn-secondary">
          <HugeiconsIcon icon={PlusSignIcon} size={16} />
          {isGenerating ? 'Generating...' : 'Plus Invite'}
        </button>
      </div>
    </div>
  </Modal>

  <div class="border-b border-border/50 pb-8 mb-8">
    <button onclick={() => isInviteModalOpen = true} class="btn-base btn-primary">
      <HugeiconsIcon icon={PlusSignIcon} size={16} /> Generate New Invite
    </button>
  </div>

  <div class="overflow-hidden">
    <div class="overflow-x-auto w-full max-w-[100vw]">
      <table class="w-full text-sm text-left">
        <thead class="bg-muted/50 text-muted-foreground border-b border-border/50">
          <tr>
            <th class="px-6 py-4 font-medium">Code</th>
            <th class="px-6 py-4 font-medium">Type</th>
            <th class="px-6 py-4 font-medium">Status</th>
            <th class="px-6 py-4 font-medium">Used By</th>
            <th class="px-6 py-4 font-medium">Created</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/50">
          {#if isLoading}
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-muted-foreground">Loading invites...</td>
            </tr>
          {:else if invites.length === 0}
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-muted-foreground">No invite codes found.</td>
            </tr>
          {:else}
            {#each invites as invite}
              <tr class="hover:bg-muted/30 transition-colors whitespace-nowrap">
                <td class="px-6 py-4 font-mono font-medium">{invite.code}</td>
                <td class="px-6 py-4 capitalize">
                  <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium {invite.contains_plus_perks ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}">
                    {invite.contains_plus_perks ? 'Plus' : 'Regular'}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col gap-0.5">
                    {#if invite.redeemed || (invite.max_uses > 0 && invite.current_uses >= invite.max_uses)}
                      <span class="text-muted-foreground font-medium">Fully Used</span>
                    {:else if new Date(invite.expires_at) < new Date()}
                      <span class="text-destructive font-medium">Expired</span>
                    {:else}
                      <span class="text-green-500 font-medium">Active</span>
                    {/if}
                    {#if invite.max_uses > 1}
                      <span class="text-xs text-muted-foreground">{invite.current_uses} / {invite.max_uses} uses</span>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 text-foreground font-medium">
                  {#if invite.redemptions?.length}
                    {@const visibleRedemptions = invite.redemptions.slice(0, 5)}
                    <div class="flex items-center">
                      {#each visibleRedemptions as redemption, index}
                        {@const user = redemption.user}
                        <div class="relative group {index > 0 ? '-ml-3' : ''}" style={`z-index: ${visibleRedemptions.length - index}`}>
                          {#if user?.profile_picture}
                            <img
                              src={user.profile_picture}
                              alt={user.display_name || user.username || 'Redeemed by user'}
                              class="w-8 h-8 rounded-full object-cover border-2 border-background"
                            />
                          {:else}
                            <div class="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                              {(user?.display_name || user?.username || '?').charAt(0).toUpperCase()}
                            </div>
                          {/if}
                          <span class="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow group-hover:opacity-100">
                            {user?.display_name || user?.username || 'Unknown user'}
                          </span>
                        </div>
                      {/each}
                      {#if invite.redemptions.length > 5}
                        <span class="-ml-3 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-xs font-semibold text-muted-foreground">
                          +{invite.redemptions.length - 5}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-muted-foreground">-</span>
                  {/if}
                </td>
                <td class="px-6 py-4 text-muted-foreground tabular-nums">{new Date(invite.created_at).toLocaleDateString()}</td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-1">
                    {#if invite.redemptions?.length}
                      {#each invite.redemptions as redemption}
                        {@const user = redemption.user}
                        {#if user?.has_admin_privileges}
                        <button onclick={() => toggleAdmin(user.id, false)} class="p-2 text-green-500 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Remove Admin">
                          <HugeiconsIcon icon={Shield01Icon} size={16} />
                        </button>
                      {:else}
                        <button onclick={() => toggleAdmin(user.id, true)} class="p-2 text-muted-foreground/50 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-colors" title="Make Admin">
                          <HugeiconsIcon icon={Shield01Icon} size={16} />
                        </button>
                        {/if}
                        
                        {#if user?.is_plus_user}
                        <button onclick={() => togglePlus(user.id, false)} class="p-2 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Remove Plus">
                          <HugeiconsIcon icon={ZapIcon} size={16} />
                        </button>
                      {:else}
                        <button onclick={() => togglePlus(user.id, true)} class="p-2 text-muted-foreground/50 hover:text-secondary-foreground hover:bg-secondary/10 rounded-lg transition-colors" title="Grant Plus">
                          <HugeiconsIcon icon={ZapIcon} size={16} />
                        </button>
                        {/if}
                      {/each}
                      <div class="w-px h-4 bg-border mx-1"></div>
                    {/if}
                    
                    <button onclick={() => copyToClipboard(invite.code)} class="p-2 text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-lg transition-colors" title="Copy code">
                      <HugeiconsIcon icon={Copy01Icon} size={16} />
                    </button>
                    <button onclick={() => deleteInvite(invite.code)} class="p-2 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete">
                      <HugeiconsIcon icon={Delete01Icon} size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Confirmation Modal -->
<Modal bind:isOpen={isConfirmOpen} title={confirmTitle}>
  <div class="space-y-5">
    <p class="text-sm text-muted-foreground leading-relaxed">
      {confirmMessage}
    </p>

    <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
      <button
        class="btn-base btn-secondary"
        onclick={() => isConfirmOpen = false}
        disabled={isConfirming}
      >Cancel</button>
      <button
        class="btn-base btn-destructive"
        onclick={executeConfirm}
        disabled={isConfirming}
      >
        {isConfirming ? 'Confirming...' : 'Confirm'}
      </button>
    </div>
  </div>
</Modal>
