<svelte:head>
  <title>Releases</title>
</svelte:head>

<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { CodeIcon, Add01Icon, Delete01Icon, Edit01Icon } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import Modal from '$lib/components/Modal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  type Release = {
    id: string;
    version: string;
    branch?: string;
    notes: string;
    date: string;
    link?: string;
    status: 'Active' | 'History';
  };

  let releases = $state<Release[]>([]);
  let activeReleases = $derived(releases.filter(r => r.status !== 'History'));
  let historyReleases = $derived(releases.filter(r => r.status === 'History'));
  let isLoading = $state(false);
  let activeTab = $state<'active' | 'history'>('active');
  let isSubmitting = $state(false);

  // Confirm Modal state
  let isConfirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let onConfirmAction = $state<() => void>(() => {});

    let isReleaseModalOpen = $state(false);
  let editMode = $state(false);
  let currentReleaseId = $state('');

  let newRelease = $state({
    version: '',
    branch: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    link: ''
  });

  async function loadReleases() {
    isLoading = true;
    try {
      const res: any = await makeAdminRequest('releases', 'GET');
      releases = Array.isArray(res) ? res : (res.releases || []);
    } catch (e) {
      releases = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadReleases();
  });

  async function createRelease(e: Event) {
    e.preventDefault();
    isSubmitting = true;
    try {
      if (editMode) {
        await makeAdminRequest(`releases?id=${currentReleaseId}`, 'PUT', newRelease);
        addToast('Release updated!');
      } else {
        await makeAdminRequest('releases', 'POST', newRelease);
        addToast('Release added!');
      }
      clearForm();
      loadReleases();
    } catch (e: any) {
      addToast(`Failed to save release: ${e.message}`);
    } finally {
      isSubmitting = false;
    }
  }

  function editRelease(release: Release) {
    isReleaseModalOpen = true;
    newRelease = {
      version: release.version,
      branch: release.branch || '',
      notes: release.notes,
      date: release.date ? new Date(release.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      link: release.link || ''
    };
    currentReleaseId = release.id;
    editMode = true;
  }

  function clearForm() {
    newRelease = { version: '', branch: '', notes: '', date: new Date().toISOString().split('T')[0], link: '' };
    editMode = false;
    currentReleaseId = '';
  }

  async function deleteRelease(id: string) {
    confirmTitle = 'Delete Release';
    confirmMessage = 'Are you sure you want to delete this release? This cannot be undone.';
    onConfirmAction = async () => {
      try {
        await makeAdminRequest(`releases?id=${id}`, 'DELETE');
        loadReleases();
      } catch (e: any) {
        addToast(`Failed to delete release: ${e.message}`, 'error');
      }
    };
    isConfirmOpen = true;
  }

  async function toggleReleaseStatus(release: Release) {
    if (release.status !== 'History') {
      confirmTitle = 'Move to History';
      confirmMessage = 'Are you sure you want to move this release to history?';
      onConfirmAction = async () => {
        try {
          await makeAdminRequest(`releases?id=${release.id}`, 'PUT', { status: 'History' });
          loadReleases();
        } catch (e: any) {
          addToast(`Failed to update release: ${e.message}`, 'error');
        }
      };
      isConfirmOpen = true;
    }
  }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
  <ConfirmModal bind:isOpen={isConfirmOpen} title={confirmTitle} message={confirmMessage} onConfirm={onConfirmAction} confirmText={confirmTitle.includes('Delete') ? 'Delete' : 'Confirm'} />
  
  <div>
    <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">App Releases</h1>
    <p class="text-muted-foreground mt-1 text-sm">Manage version history and release notes.</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Form Modal -->
    <Modal bind:isOpen={isReleaseModalOpen} title={editMode ? 'Edit Release' : 'New Release'} onClose={clearForm}>
      <form onsubmit={(e) => { createRelease(e); isReleaseModalOpen = false; }} class="space-y-4 px-6 pb-6 pt-2">
        
          <div class="space-y-1.5">
            <label for="releaseVersion" class="text-xs font-semibold text-muted-foreground  ">Version (e.g. v2.1.0) *</label>
            <input id="releaseVersion" type="text" bind:value={newRelease.version} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="v2.0.0" />
          </div>
          
          <div class="space-y-1.5">
            <label for="releaseBranch" class="text-xs font-semibold text-muted-foreground  ">Branch</label>
            <input id="releaseBranch" type="text" bind:value={newRelease.branch} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="e.g. main" />
          </div>
          
          <div class="space-y-1.5">
            <label for="releaseNotes" class="text-xs font-semibold text-muted-foreground  ">Release Notes / Changes *</label>
            <textarea id="releaseNotes" bind:value={newRelease.notes} required class="w-full min-h-[100px] bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all resize-y" placeholder="What's new..."></textarea>
          </div>

          <div class="space-y-1.5">
            <label for="releaseDate" class="text-xs font-semibold text-muted-foreground  ">Build Date *</label>
            <input id="releaseDate" type="date" bind:value={newRelease.date} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
          </div>

          <div class="space-y-1.5">
            <label for="releaseLink" class="text-xs font-semibold text-muted-foreground  ">App Link (Optional)</label>
            <input id="releaseLink" type="url" bind:value={newRelease.link} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="https://..." />
          </div>

          <button type="submit" disabled={isSubmitting} class="w-full btn-base btn-primary mt-4">
            <HugeiconsIcon icon={CodeIcon} size={16} />
            {isSubmitting ? 'Saving...' : (editMode ? 'Save Release' : 'Publish Release')}
          </button>
        
      </form>
    </Modal>

    <div class="mb-6 lg:col-span-1 pr-8 border-r border-border/50">
      <button onclick={() => isReleaseModalOpen = true} class="w-full btn-base btn-primary">
        <HugeiconsIcon icon={Add01Icon} size={18} /> New Release
      </button>
    </div>

    <!-- List -->
    <div class="lg:col-span-2 space-y-4 pl-4">
      <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 mb-6 border-b border-border/50 pb-4">
        <h3 class="font-semibold text-foreground text-lg">Release History</h3>
        <div class="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
          <button 
            onclick={() => activeTab = 'active'}
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {activeTab === 'active' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            Active ({activeReleases.length})
          </button>
          <button 
            onclick={() => activeTab = 'history'}
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {activeTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            History ({historyReleases.length})
          </button>
        </div>
      </div>
      
      {#if isLoading}
        <div class="flex items-center justify-center h-48 text-muted-foreground">
          <p class="animate-pulse font-medium">Loading releases...</p>
        </div>
      {:else if (activeTab === 'active' ? activeReleases : historyReleases).length === 0}
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3 border-b border-border/50">
          <HugeiconsIcon icon={CodeIcon} size={32} class="opacity-50" />
          <p class="text-sm font-medium">No {activeTab} releases found.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each (activeTab === 'active' ? activeReleases : historyReleases) as release}
            <div class="bg-transparent border-b border-border/50 pb-6 mb-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <HugeiconsIcon icon={CodeIcon} size={20} />
                  </div>
                  <div>
                    <h4 class="font-bold text-foreground text-lg flex items-center gap-2">
                      {release.version}
                      {#if release.branch}
                        <span class="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground ">{release.branch}</span>
                      {/if}
                    </h4>
                    <p class="text-xs text-muted-foreground">{new Date(release.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick={() => editRelease(release)} class="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-colors">
                    <HugeiconsIcon icon={Edit01Icon} size={16} />
                  </button>
                  {#if release.status !== 'History'}
                    <button onclick={() => toggleReleaseStatus(release)} class="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-colors text-xs font-medium">
                      Archive
                    </button>
                  {/if}
                  <button onclick={() => deleteRelease(release.id)} class="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                    <HugeiconsIcon icon={Delete01Icon} size={16} />
                  </button>
                </div>
              </div>
              <p class="text-sm text-foreground whitespace-pre-wrap">{release.notes}</p>
              {#if release.link}
                <a href={release.link} target="_blank" class="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  View App / Download
                </a>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

</div>
