<svelte:head>
  <title>Security</title>
</svelte:head>

<script lang="ts">
  import { smoothCorners } from '@lisse/svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { AiPhone01Icon, AlertCircleIcon, Key01Icon, CheckmarkCircle01Icon, Loading01Icon } from '@hugeicons/core-free-icons';
  import { ShieldAlertIcon, ChevronDownIcon, Copy, QrCode, KeyRound, CheckCircle2, Smartphone, Laptop, MonitorSmartphone, Eye, EyeOff } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import { fade, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { goto } from '$app/navigation';
  import Modal from '$lib/components/Modal.svelte';
  import OtpInput from '$lib/components/OtpInput.svelte';
  import { pageCache } from '$lib/stores/cache';
  import QRCode from 'qrcode';

  // Password fields
  let currentPassword = $state('');
  let showCurrentPassword = $state(false);
  let newPassword = $state('');
  let showNewPassword = $state(false);
  let confirmPassword = $state('');
  let showConfirmPassword = $state(false);
  let isSavingPassword = $state(false);
  let passwordError = $state('');
  let passwordSuccess = $state('');

  // 2FA state
  let qrCodeUrl = $state('');
  let twoFactorSecret = $state('');
  let totpCode = $state('');
  let totpError = $state('');
  let mfaSuccess = $state('');
  let mfaRecoveryKeys = $state<string[]>([]);
  let isLoading = $state(false);

  let is2faEnabled = $state(false);
  let twoFactorEnabledDate = $state('');
  let show2faSetup = $state(false);
  let showRecoveryModal = $state(false);
  let showDisable2faModal = $state(false);
  let showDeleteAccountModal = $state(false);
  let deleteAccountPassword = $state('');
  let showDeletePassword = $state(false);
  let showRevokeSessionModal = $state(false);
  let sessionToRevoke = $state<string | null>(null);

  // Sessions state
  let sessions = $state<any[]>([]);
  let currentSessionId = $state('');

  function parseUserAgent(ua: string) {
    if (!ua) return 'Unknown Device';
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone')) os = 'iPhone';
    
    return `${os} • ${browser}`;
  }

  async function updatePassword(e: Event) {
    e.preventDefault();
    passwordError = '';
    passwordSuccess = '';

    if (newPassword !== confirmPassword) {
      passwordError = 'New passwords do not match';
      return;
    }

    isSavingPassword = true;
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('/api/v2/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      passwordSuccess = 'Password updated successfully!';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (err: any) {
      passwordError = err.message;
    } finally {
      isSavingPassword = false;
    }
  }

  async function toggle2fa() {
    if (is2faEnabled) {
      showDisable2faModal = true;
    } else {
      show2faSetup = true;
      totpCode = '';
      totpError = '';
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/v2/security/2fa/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json() as any;
        if (data.otpauthUrl) {
          qrCodeUrl = await QRCode.toDataURL(data.otpauthUrl);
        }
        twoFactorSecret = data.secret;
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function disable2FA() {
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/v2/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ disable2FA: true })
      });
      is2faEnabled = false;
      twoFactorEnabledDate = '';
      pageCache.set('security', { is2faEnabled, twoFactorEnabledDate, sessions: $state.snapshot(sessions), currentSessionId });
      mfaSuccess = '2FA disabled successfully';
      showDisable2faModal = false;
    } catch (e) {
      console.error(e);
    }
  }

  async function verify2fa() {
    totpError = '';
    const token = localStorage.getItem('token');
    if (totpCode.length !== 6 || isNaN(Number(totpCode))) {
      totpError = 'Please enter a valid 6-digit code';
      return;
    }

    try {
      const res = await fetch('/api/v2/security/2fa/verify', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: totpCode })
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      is2faEnabled = true;
      twoFactorEnabledDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      show2faSetup = false;
      showRecoveryModal = true;
      pageCache.set('security', { is2faEnabled, twoFactorEnabledDate, sessions: $state.snapshot(sessions), currentSessionId });
      mfaSuccess = '2FA enabled successfully!';
      mfaRecoveryKeys = [
        'ABCD-1234-EFGH',
        'IJKL-5678-MNOP',
        'QRST-9012-UVWX',
        'YZAB-3456-CDEF'
      ];
    } catch (e: any) {
      totpError = e.message;
    }
  }

  function confirmDisable2fa() {
    disable2FA();
    showDisable2faModal = false;
  }

  function confirmRevokeSession(id: string) {
    sessionToRevoke = id;
    showRevokeSessionModal = true;
  }

  async function executeRevokeSession() {
    if (!sessionToRevoke) return;
    const id = sessionToRevoke;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/v2/security/sessions?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      sessions = sessions.filter(s => s.id !== id);
      pageCache.set('security', { is2faEnabled, twoFactorEnabledDate, sessions: $state.snapshot(sessions), currentSessionId });
      showRevokeSessionModal = false;
      sessionToRevoke = null;
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteAccount() {
    showDeleteAccountModal = true;
    deleteAccountPassword = '';
  }

  async function confirmDeleteAccount() {
    if (!deleteAccountPassword) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v2/profile', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: deleteAccountPassword })
      });

      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.error || 'Failed to delete Materio ID');
      }

      addToast('Materio ID deleted', 'success');
      localStorage.removeItem('token');
      goto('/login');
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  }

  onMount(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      goto('/login');
      return;
    }

    const cached = pageCache.get<any>('security');
    if (cached) {
      is2faEnabled = cached.is2faEnabled;
      twoFactorEnabledDate = cached.twoFactorEnabledDate;
      sessions = cached.sessions;
      currentSessionId = cached.currentSessionId;
      return;
    }
    
    try {
      const res = await fetch('/api/v2/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json() as any;
      is2faEnabled = data.user.twoFactorEnabled;
      if (data.user.twoFactorEnabledAt) {
        twoFactorEnabledDate = new Date(data.user.twoFactorEnabledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      
      const sesRes = await fetch('/api/v2/security/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sesData = await sesRes.json() as any;
      sessions = sesData.sessions || [];
      currentSessionId = sesData.currentSessionId;
      
      pageCache.set('security', { 
        is2faEnabled, 
        twoFactorEnabledDate,
        sessions: $state.snapshot(sessions), 
        currentSessionId 
      });
    } catch (e) {
      console.error(e);
    }
  });
</script>

<div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 border-b border-border/60 pb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Security</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage your Materio ID security, passwords, and active login sessions.</p>
    </div>
  </div>

  <!-- Change Password (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
      <HugeiconsIcon icon={Key01Icon} size={18} class="text-muted-foreground" />
      <h3 class="font-semibold text-foreground text-sm">Change Password</h3>
    </div>

    {#if passwordError}
      <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{passwordError}</div>
    {/if}
    {#if passwordSuccess}
      <div class="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl">{passwordSuccess}</div>
    {/if}

    <form onsubmit={updatePassword} class="space-y-4 max-w-xl">
      <div class="grid grid-cols-1 gap-4">
        <div class="space-y-1.5">
          <label for="currentPassword" class="text-[13px] font-medium text-foreground">Current Password</label>
          <div class="relative">
            <input 
              id="currentPassword"
              type={showCurrentPassword ? "text" : "password"} 
              bind:value={currentPassword}
              required
              placeholder="Enter current password"
              class="w-full bg-background border border-border text-foreground text-sm px-3 py-2.5 outline-none focus:border-zinc-300 rounded-xl pr-10"
            />
            <button 
              type="button" 
              onclick={() => showCurrentPassword = !showCurrentPassword}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {#if showCurrentPassword}
                <EyeOff class="w-4 h-4" />
              {:else}
                <Eye class="w-4 h-4" />
              {/if}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label for="newPassword" class="text-[13px] font-medium text-foreground">New Password</label>
            <div class="relative">
              <input 
                id="newPassword"
                type={showNewPassword ? "text" : "password"} 
                bind:value={newPassword}
                required
                placeholder="Min. 8 characters"
                class="w-full bg-background border border-border text-foreground text-sm px-3 py-2.5 outline-none focus:border-zinc-300 rounded-xl pr-10"
              />
              <button 
                type="button" 
                onclick={() => showNewPassword = !showNewPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {#if showNewPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>
          <div class="space-y-1.5">
            <label for="confirmPassword" class="text-[13px] font-medium text-foreground">Confirm New Password</label>
            <div class="relative">
              <input 
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"} 
                bind:value={confirmPassword}
                required
                placeholder="Confirm new password"
                class="w-full bg-background border border-border text-foreground text-sm px-3 py-2.5 outline-none focus:border-zinc-300 rounded-xl pr-10"
              />
              <button 
                type="button" 
                onclick={() => showConfirmPassword = !showConfirmPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {#if showConfirmPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isSavingPassword}
        class="btn-base btn-primary"
      >
        {#if isSavingPassword}
          <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin text-white" />
        {/if}
        <span>{isSavingPassword ? 'Updating...' : 'Update Password'}</span>
      </button>
    </form>
  </div>

  <!-- Two-Factor Authentication (2FA) (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <ShieldAlertIcon size={24} class="text-muted-foreground" />
        <h2 class="text-lg font-semibold text-foreground">2-Step Verification</h2>
      </div>
      <button 
        onclick={toggle2fa}
        class="btn-base gap-2 {is2faEnabled ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20' : 'btn-secondary'}"
      >
        {#if is2faEnabled}
          <CheckCircle2 size={16} />
          {twoFactorEnabledDate ? `On since ${twoFactorEnabledDate}` : 'Enabled'}
        {:else}
          Enable 2FA
        {/if}
      </button>
    </div>

    <!-- Removed the separate green box since the button acts as the indicator -->

    <Modal bind:isOpen={show2faSetup} title="Set up two-factor authentication">
      <div class="space-y-6">
        <!-- QR Code Section -->
        <div class="space-y-3">
          <h3 class="flex items-center gap-2 font-medium text-foreground">
            <QrCode class="w-5 h-5 text-muted-foreground" />
            Scan QR code
          </h3>
          <p class="text-sm text-muted-foreground">Scan the QR code below or manually enter the secret key into your authenticator app.</p>
          
          <div class="flex flex-col sm:flex-row gap-6 p-4 bg-muted/20 border border-border rounded-xl">
            {#if qrCodeUrl}
              <div class="bg-white p-2 rounded-lg shrink-0 border border-border/50 self-center sm:self-start">
                <img src={qrCodeUrl} alt="2FA QR Code" class="w-28 h-28 object-contain mix-blend-multiply" />
              </div>
            {/if}
            <div class="space-y-3 flex-1 flex flex-col justify-center">
              <span class="text-sm font-medium text-foreground">Can't scan? Enter code manually:</span>
              <code class="text-sm font-mono bg-background border px-3 py-2 rounded-lg block select-all text-center sm:text-left">{twoFactorSecret || 'Loading...'}</code>
              <button class="btn-base btn-secondary self-start gap-2 text-xs py-1.5 px-3" onclick={() => navigator.clipboard.writeText(twoFactorSecret || '')}>
                 <Copy class="w-4 h-4" /> Copy code
              </button>
            </div>
          </div>
        </div>

        <!-- Enter Code Section -->
        <div class="space-y-4">
          <h3 class="flex items-center gap-2 font-medium text-foreground">
            <KeyRound class="w-5 h-5 text-muted-foreground" />
            Enter verification code
          </h3>
          <p class="text-sm text-muted-foreground">Enter the 6-digit code on your authenticator app.</p>
          
          <div class="py-2 flex justify-center">
            <OtpInput bind:value={totpCode} length={6} />
          </div>
        </div>

        {#if totpError}
          <div class="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">{totpError}</div>
        {/if}

        <!-- Footer -->
        <div class="flex justify-between items-center pt-4 border-t border-border/50">
          <button class="btn-base btn-secondary" onclick={() => show2faSetup = false}>Cancel</button>
          <button 
            class="btn-base btn-primary px-8" 
            onclick={verify2fa} 
            disabled={totpCode.length !== 6 || isLoading}
          >
            {#if isLoading}
               <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
            {/if}
            Verify
          </button>
        </div>
      </div>
    </Modal>

    <Modal bind:isOpen={showRecoveryModal} title="Recovery Codes">
      <div class="space-y-6">
        <div class="flex items-center gap-3 text-green-600 bg-green-500/10 p-3 rounded-xl border border-green-500/20">
          <CheckCircle2 class="w-5 h-5" />
          <span class="text-sm font-medium">Authenticator app configured successfully</span>
        </div>

        <div class="space-y-3">
          <p class="text-sm text-muted-foreground leading-relaxed">
            Save these recovery keys in a safe place. They can be used to access your Materio ID if you lose your 2FA device.
          </p>
          
          <div class="bg-muted/20 border border-border rounded-xl p-4">
            <div class="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              {#each mfaRecoveryKeys as key}
                <code class="text-sm font-mono bg-background border px-2 py-1.5 rounded-lg text-center block select-all">{key}</code>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-4 border-t border-border/50">
          <button class="btn-base btn-primary" onclick={() => showRecoveryModal = false}>I've saved them</button>
        </div>
      </div>
    </Modal>

    <Modal bind:isOpen={showDisable2faModal} title="Disable Two-Factor Authentication">
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground leading-relaxed">
          Are you sure you want to disable 2FA? This will significantly reduce your Materio ID security and make it easier for unauthorized users to access your data.
        </p>
        <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
          <button class="btn-base btn-secondary" onclick={() => showDisable2faModal = false}>Cancel</button>
          <button class="btn-base btn-destructive" onclick={confirmDisable2fa}>Disable 2FA</button>
        </div>
      </div>
    </Modal>
  </div>

  <!-- Active Sessions (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-4">
      <MonitorSmartphone class="w-[18px] h-[18px] text-muted-foreground" />
      <h3 class="font-semibold text-foreground text-sm">Active Sessions</h3>
    </div>

    <div class="divide-y divide-border/50 flex flex-col">
      {#each sessions as session (session.id)}
        <div animate:flip={{duration: 300}} transition:slide={{duration: 250}} class="flex items-center justify-between py-4 group">
          <div class="flex items-center gap-4 min-w-0">
            <div class="text-muted-foreground group-hover:text-primary transition-colors flex shrink-0">
              {#if session.user_agent?.includes('Android') || session.user_agent?.includes('iPhone') || session.user_agent?.includes('iPad')}
                <Smartphone class="w-6 h-6 stroke-[1.5]" />
              {:else}
                <Laptop class="w-6 h-6 stroke-[1.5]" />
              {/if}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-foreground truncate">{parseUserAgent(session.user_agent)}</span>
                {#if session.id === currentSessionId}
                  <span class="text-[9px] bg-green-500/10 text-green-600 border border-green-500/20 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">Current</span>
                {/if}
              </div>
              <p class="text-xs text-muted-foreground mt-0.5 truncate">{session.ip_address || 'Unknown IP'}</p>
            </div>
          </div>
          {#if session.id !== currentSessionId}
            <button 
              onclick={() => confirmRevokeSession(session.id)}
              class="btn-base btn-destructive !px-3 !py-1.5 !text-xs"
            >
              Revoke
            </button>
          {/if}
        </div>
      {/each}
      {#if sessions.length === 0}
        <div class="py-4 text-sm text-muted-foreground italic">No active sessions found.</div>
      {/if}
    </div>
  </div>

  <Modal bind:isOpen={showRevokeSessionModal} title="Revoke Session">
    <div class="space-y-4">
      <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-600 dark:text-amber-500">
        <HugeiconsIcon icon={AlertCircleIcon} size={20} class="shrink-0 mt-0.5" />
        <p class="text-sm">Are you sure you want to revoke this session? You will be logged out of that device immediately.</p>
      </div>
      <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
        <button class="btn-base btn-secondary" onclick={() => showRevokeSessionModal = false}>Cancel</button>
        <button class="btn-base btn-destructive" onclick={executeRevokeSession}>Revoke Session</button>
      </div>
    </div>
  </Modal>

  <!-- Danger Zone (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-red-500/20 p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-red-500/10 pb-4 mb-6">
      <HugeiconsIcon icon={AlertCircleIcon} size={18} class="text-red-500" />
      <h3 class="font-semibold text-red-500 text-sm">Danger Zone</h3>
    </div>

    <div class="flex flex-col sm:flex-row sm:sm:items-center items-start justify-between gap-4">
      <div>
        <h4 class="font-semibold text-sm text-foreground">Delete Materio ID</h4>
        <p class="text-xs text-muted-foreground mt-1">Permanently delete your Materio ID and all associated data.</p>
      </div>
      <button 
        onclick={deleteAccount}
        class="btn-base btn-destructive"
      >
        Delete Materio ID
      </button>
    </div>
  </div>

  <Modal bind:isOpen={showDeleteAccountModal} title="Delete Materio ID">
    <div class="space-y-4">
      <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500">
        <HugeiconsIcon icon={AlertCircleIcon} size={20} class="shrink-0 mt-0.5" />
        <p class="text-sm">This action cannot be undone. All your data, settings, and active sessions will be permanently erased.</p>
      </div>
      
      <div class="space-y-2">
        <label for="delete-password" class="text-sm font-medium text-foreground block">Enter your password to confirm:</label>
        <div class="relative">
          <input 
            id="delete-password"
            type={showDeletePassword ? "text" : "password"} 
            bind:value={deleteAccountPassword}
            class="w-full bg-background border border-border px-3 py-2 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-foreground text-sm pr-10"
            placeholder="Password"
          />
          <button 
            type="button" 
            onclick={() => showDeletePassword = !showDeletePassword}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {#if showDeletePassword}
              <EyeOff class="w-4 h-4" />
            {:else}
              <Eye class="w-4 h-4" />
            {/if}
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
        <button class="btn-base btn-secondary" onclick={() => showDeleteAccountModal = false}>Cancel</button>
        <button 
          class="btn-base btn-destructive" 
          onclick={confirmDeleteAccount}
          disabled={!deleteAccountPassword}
        >
          Permanently Delete
        </button>
      </div>
    </div>
  </Modal>
</div>
