<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Tag01Icon,
    CreditCardIcon,
    Loading01Icon,
    AlertCircleIcon,
    CheckmarkCircle01Icon,
    Cancel01Icon,
    Crown02Icon,
    UserIcon,
    ZapIcon,
    ArrowRight01Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import { userStore } from '$lib/stores/user.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import { fade } from 'svelte/transition';

  // Redeem state
  let giftCode = $state('');
  let isRedeeming = $state(false);
  let redeemError = $state('');
  let redeemSuccess = $state('');

  // Cancel state
  let showCancelModal = $state(false);
  let isCancelling = $state(false);
  let cancelError = $state('');

  // Transfer (super user) state
  let showTransferModal = $state(false);
  let successorUsername = $state('');
  let isTransferring = $state(false);
  let transferError = $state('');

  // Derived plan info
  let currentPlan = $derived(() => {
    if (userStore.user?.hasAdminPrivileges) return 'Super';
    if (userStore.user?.isPlusUser) return 'Pro';
    if (userStore.user?.isLiteUser) return 'Lite';
    return null;
  });

  let hasSubscription = $derived(() => {
    return currentPlan() !== null;
  });

  let planExpiry = $derived(() => {
    return userStore.user?.plusExpiry || null;
  });

  let isSuperUser = $derived(() => {
    return userStore.user?.hasAdminPrivileges === true;
  });

  // Plan display config
  const planConfig: Record<string, { label: string; color: string; bgClass: string; icon: any }> = {
    'Super': { label: 'Materio Super', color: 'text-amber-500', bgClass: 'bg-amber-500/10 border-amber-500/20', icon: Crown02Icon },
    'Pro': { label: 'Materio Pro', color: 'text-primary', bgClass: 'bg-primary/10 border-primary/20', icon: ZapIcon },
    'Lite': { label: 'Materio Lite', color: 'text-emerald-500', bgClass: 'bg-emerald-500/10 border-emerald-500/20', icon: CreditCardIcon }
  };

  async function redeemGiftCode() {
    if (!giftCode.trim()) return;
    isRedeeming = true;
    redeemError = '';
    redeemSuccess = '';

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v2/subscription/redeem', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: giftCode.trim() })
      });

      const data = await res.json() as any;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to redeem code');
      }

      redeemSuccess = data.message || 'Subscription activated!';
      giftCode = '';
      addToast(redeemSuccess, 'success', 'Gift Code Redeemed');

      // Refresh user data
      await userStore.fetchProfile();
    } catch (err: any) {
      redeemError = err.message;
      addToast(err.message, 'error', 'Redeem Failed');
    } finally {
      isRedeeming = false;
    }
  }

  function handleCancelClick() {
    cancelError = '';
    if (isSuperUser()) {
      showTransferModal = true;
    } else {
      showCancelModal = true;
    }
  }

  async function confirmCancel() {
    isCancelling = true;
    cancelError = '';

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v2/subscription/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json() as any;

      if (!res.ok) {
        if (data.requiresTransfer) {
          showCancelModal = false;
          showTransferModal = true;
          return;
        }
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      showCancelModal = false;
      addToast('Subscription cancelled successfully', 'success', 'Plan Cancelled');

      // Refresh user data
      await userStore.fetchProfile();
    } catch (err: any) {
      cancelError = err.message;
      addToast(err.message, 'error', 'Cancel Failed');
    } finally {
      isCancelling = false;
    }
  }

  async function confirmTransfer() {
    if (!successorUsername.trim()) {
      transferError = 'Please enter a username';
      return;
    }

    isTransferring = true;
    transferError = '';

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v2/subscription/transfer-admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ successorUsername: successorUsername.trim() })
      });

      const data = await res.json() as any;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to transfer admin privileges');
      }

      showTransferModal = false;
      successorUsername = '';
      addToast(data.message || 'Admin privileges transferred', 'success', 'Transfer Complete');

      // Refresh user data
      await userStore.fetchProfile();
    } catch (err: any) {
      transferError = err.message;
    } finally {
      isTransferring = false;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Payments and Subscription</title>
</svelte:head>

<div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6">
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 border-b border-border/60 pb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Payments and Subscription</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage your plan and subscription details.</p>
    </div>
  </div>

  <!-- Redeem Gift Code -->
  <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
      <HugeiconsIcon icon={Tag01Icon} size={18} class="text-muted-foreground" />
      <h3 class="font-semibold text-foreground text-sm">Redeem Gift Code</h3>
    </div>

    <div class="space-y-5">
      <p class="text-sm text-muted-foreground leading-relaxed max-w-2xl">
        Have a gift code? Enter it below to activate your Materio subscription.
      </p>

      {#if hasSubscription()}
        <div class="flex items-start gap-3 py-2">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} class="text-primary shrink-0 mt-0.5" />
          <p class="text-sm text-foreground">
            You have an active <span class="font-semibold">{currentPlan()}</span> subscription.
          </p>
        </div>
      {:else}
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            bind:value={giftCode}
            placeholder="YOUR-GIFT-CODE"
            disabled={isRedeeming}
            class="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-all uppercase tracking-wider font-mono"
            onkeydown={(e) => { if (e.key === 'Enter') redeemGiftCode(); }}
          />
          <button
            onclick={redeemGiftCode}
            disabled={isRedeeming || !giftCode.trim()}
            class="btn-base btn-primary shrink-0"
          >
            {#if isRedeeming}
              <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
              <span>Redeeming...</span>
            {:else}
              <span>Redeem</span>
            {/if}
          </button>
        </div>

        {#if redeemError}
          <div transition:fade={{ duration: 200 }} class="flex items-start gap-3 py-1">
            <HugeiconsIcon icon={AlertCircleIcon} size={18} class="text-destructive shrink-0 mt-0.5" />
            <p class="text-sm text-destructive">{redeemError}</p>
          </div>
        {/if}

        {#if redeemSuccess}
          <div transition:fade={{ duration: 200 }} class="flex items-start gap-3 py-1">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} class="text-primary shrink-0 mt-0.5" />
            <p class="text-sm font-medium text-foreground">{redeemSuccess}</p>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Active Subscription Details -->
  {#if hasSubscription()}
    {@const plan = currentPlan()!}
    {@const config = planConfig[plan]}
    <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
        <HugeiconsIcon icon={CreditCardIcon} size={18} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">Your Subscription</h3>
      </div>

      <div class="space-y-6">
        <!-- Plan card -->
        <div>
          <h4 class="font-bold text-foreground text-lg">{config.label}</h4>
          {#if planExpiry()}
            <p class="text-sm text-muted-foreground mt-0.5">
              Expires on <span class="font-medium text-foreground">{formatDate(planExpiry()!)}</span>
            </p>
          {:else}
            <p class="text-sm text-muted-foreground mt-0.5">
              <span class="font-medium">Forever plan</span>
            </p>
          {/if}
        </div>

        <!-- Cancel Plan -->
        <div class="pt-2 border-t border-border/50">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-foreground">Cancel Plan</h4>
              <p class="text-sm text-muted-foreground mt-0.5">
                {#if isSuperUser()}
                  Your must transfer admin privileges before cancelling.
                {:else}
                  Cancel your subscription and return to the free plan.
                {/if}
              </p>
            </div>
            <button
              onclick={handleCancelClick}
              class="btn-base btn-destructive shrink-0"
            >

              <span>{isSuperUser() ? 'Transfer & Cancel' : 'Cancel Plan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Info card for free users -->
  {#if !hasSubscription()}
    <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
        <HugeiconsIcon icon={AlertCircleIcon} size={18} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">About Subscriptions</h3>
      </div>

      <div class="space-y-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
        <p>
          Materio subscriptions are currently distributed through gift codes. If you've received an invite code with subscription perks, you can redeem it above to activate your plan.
        </p>
      </div>
    </div>
  {/if}
</div>

<!-- Cancel Confirmation Modal (non-super users) -->
<Modal bind:isOpen={showCancelModal} title="Cancel Subscription">
  <div class="space-y-5">
    <p class="text-sm text-muted-foreground leading-relaxed">
      Are you sure you want to cancel your <span class="font-semibold text-foreground">{currentPlan()}</span> subscription? You'll lose access to all premium features.
    </p>

    {#if cancelError}
      <Alert type="error" message={cancelError} />
    {/if}

    <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
      <button
        class="btn-base btn-secondary"
        onclick={() => showCancelModal = false}
      >Keep Plan</button>
      <button
        class="btn-base btn-destructive"
        onclick={confirmCancel}
        disabled={isCancelling}
      >
        {#if isCancelling}
          <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
        {/if}
        Cancel Plan
      </button>
    </div>
  </div>
</Modal>

<!-- Super User Transfer Modal -->
<Modal bind:isOpen={showTransferModal} title="Transfer Admin Privileges">
  <div class="space-y-5">
    <div>
      <h4 class="font-semibold text-foreground">Super users can't cancel directly</h4>
      <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
        You must first choose a successor to pass admin privileges to. The successor will receive an email notification about their promotion. Alternatively, another admin can revoke your access.
      </p>
    </div>

    <div class="space-y-3">
      <label for="successor-username" class="block text-sm font-medium text-foreground">
        Successor Username
      </label>
      <input
        id="successor-username"
        type="text"
        bind:value={successorUsername}
        placeholder="Enter username of the new admin"
        disabled={isTransferring}
        class="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-all"
        onkeydown={(e) => { if (e.key === 'Enter') confirmTransfer(); }}
      />
      <p class="text-xs text-muted-foreground">
        This user will be granted full admin access to Materio.
      </p>
    </div>

    {#if transferError}
      <Alert type="error" message={transferError} />
    {/if}

    <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
      <button
        class="btn-base btn-secondary"
        onclick={() => { showTransferModal = false; transferError = ''; successorUsername = ''; }}
      >Cancel</button>
      <button
        class="btn-base btn-destructive"
        onclick={confirmTransfer}
        disabled={isTransferring || !successorUsername.trim()}
      >
        {#if isTransferring}
          <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
        {/if}
        <HugeiconsIcon icon={UserIcon} size={16} />
        Transfer & Cancel
      </button>
    </div>
  </div>
</Modal>
