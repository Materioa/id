<script lang="ts">
  import { smoothCorners } from '@lisse/svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    GlobeIcon, 
    CheckmarkCircle01Icon, 
    AlertCircleIcon, 
    ArrowRight01Icon, 
    Loading01Icon, 
    CancelCircleIcon 
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let isLinked = $state(false);
  let isConnecting = $state(false);
  let googleEmail = $state('');
  let successMsg = $state('');

  function linkDrive() {
    isConnecting = true;
    successMsg = '';
    setTimeout(() => {
      isLinked = true;
      isConnecting = false;
      googleEmail = 'user.materio@gmail.com';
      successMsg = 'Google Drive successfully connected!';
      localStorage.setItem('google_drive_linked', 'true');
      localStorage.setItem('google_drive_email', googleEmail);
    }, 1500);
  }

  function unlinkDrive() {
    if (confirm('Are you sure you want to disconnect Google Drive? Any synced files will no longer be accessible.')) {
      isLinked = false;
      googleEmail = '';
      successMsg = 'Google Drive disconnected.';
      localStorage.removeItem('google_drive_linked');
      localStorage.removeItem('google_drive_email');
    }
  }

  onMount(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      goto('/login');
      return;
    }

    const linked = localStorage.getItem('google_drive_linked');
    if (linked === 'true') {
      isLinked = true;
      googleEmail = localStorage.getItem('google_drive_email') || 'user.materio@gmail.com';
    }
  });
</script>

<div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 border-b border-border/60 pb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Integrations</h1>
      <p class="text-sm text-muted-foreground mt-1">Connect your Materio ID with external services like Google Drive to enable cloud storage features.</p>
    </div>
  </div>

  {#if successMsg}
    <div class="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl flex items-center gap-2 max-w-xl">
      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} class="text-green-500" />
      <span>{successMsg}</span>
    </div>
  {/if}

  <!-- Google Drive Card (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-border/60 p-8 shadow-sm rounded-2xl">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex items-start gap-4">
        <!-- Google Drive Icon -->
        <div class="w-16 h-16 rounded-2xl bg-[#e8f0fe] flex items-center justify-center shrink-0">
          <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none">
            <path d="M7.74 3.75h8.52l5.74 9.94H13.48L7.74 3.75z" fill="#FFC107"/>
            <path d="M16.26 3.75L10.52 13.7h11.48l-5.74-9.95z" fill="#FFB300"/>
            <path d="M7.74 3.75L2 13.69l5.74 9.94 5.74-9.94L7.74 3.75z" fill="#4CAF50"/>
            <path d="M7.74 23.63H19.2l2.8-4.85H10.52l-2.78 4.85z" fill="#2196F3"/>
            <path d="M10.52 13.69l-2.78 4.85-5.74-4.85L7.74 3.75l2.78 9.94z" fill="#1565C0"/>
            <path d="M10.52 13.69L2 13.69l5.74 9.94 2.78-9.94z" fill="#0D47A1"/>
          </svg>
        </div>
        <div class="space-y-1.5">
          <h3 class="font-bold text-lg text-foreground flex items-center gap-2">
            Google Drive
            {#if isLinked}
              <span class="text-[9px] bg-green-500/10 text-green-600 border border-green-500/20 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Connected</span>
            {/if}
          </h3>
          <p class="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Authorize Materio to sync your reading files, notes, and session logs directly to a dedicated folder in your Google Drive cloud storage.
          </p>
        </div>
      </div>

      <div class="shrink-0 self-start md:self-center">
        {#if isConnecting}
          <div class="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin text-zinc-500" />
            <span>Connecting...</span>
          </div>
        {:else}
          <button 
            onclick={isLinked ? unlinkDrive : linkDrive}
            class="font-semibold text-sm px-5 py-2.5 transition-all shadow-sm rounded-xl flex items-center gap-2 cursor-pointer border border-transparent {isLinked ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-zinc-850 hover:bg-zinc-800 text-white'}"
          >
            {#if isLinked}
              <span>Disconnect</span>
            {:else}
              <span>Connect Account</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            {/if}
          </button>
        {/if}
      </div>
    </div>

    <!-- Details when linked -->
    {#if isLinked}
      <div class="border-t border-border/50 pt-6 mt-8 space-y-4 animate-in fade-in duration-300">
        <h4 class="font-semibold text-sm text-foreground">Connection Details</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
          <div class="bg-muted/40 border border-border/50 p-3.5 rounded-2xl">
            <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Connected Email</span>
            <span class="text-sm font-semibold text-foreground mt-0.5 block">{googleEmail}</span>
          </div>
          <div class="bg-muted/40 border border-border/50 p-3.5 rounded-2xl">
            <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sync Folder</span>
            <span class="text-sm font-semibold text-foreground mt-0.5 block">/Materio-Sync</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
