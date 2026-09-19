<svelte:head>
  <title>Notifications</title>
</svelte:head>

<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Notification01Icon, Add01Icon, SentIcon, Delete01Icon, Link01Icon, Edit01Icon } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';

  type Notification = {
    id: string;
    title: string;
    body: string;
    category?: string;
    link?: string;
    sentAt: string;
    status: 'Sent' | 'Failed';
  };

  let notifications = $state<Notification[]>([]);
  let isLoading = $state(false);
  let isSubmitting = $state(false);

  let editMode = $state(false);
  let currentNotifId = $state('');

  // Confirm Modal state
  let isConfirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let onConfirmAction = $state<() => void>(() => {});

  let newNotif = $state({
    title: '',
    body: '',
    category: '',
    link: ''
  });

  async function loadNotifications() {
    isLoading = true;
    try {
      const res: any = await makeAdminRequest('notifications', 'GET');
      notifications = Array.isArray(res) ? res : (res.notifications || []);
    } catch (e) {
      notifications = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadNotifications();
  });

  async function sendNotification(e: Event) {
    e.preventDefault();
    if (!editMode) {
      confirmTitle = 'Send Global Notification';
      confirmMessage = 'Are you sure you want to send this global notification?';
      onConfirmAction = async () => {
        await executeSendNotification();
      };
      isConfirmOpen = true;
      return;
    }
    
    await executeSendNotification();
  }

  async function executeSendNotification() {
    
    isSubmitting = true;
    try {
      if (editMode) {
        await makeAdminRequest(`notifications?id=${currentNotifId}`, 'PUT', newNotif);
        addToast('Notification updated successfully!', 'success');
      } else {
        await makeAdminRequest('notifications/send', 'POST', newNotif);
        addToast('Notification sent successfully!', 'success');
      }
      clearForm();
      loadNotifications();
    } catch (e: any) {
      addToast(`Failed to save notification: ${e.message}`, 'error');
    } finally {
      isSubmitting = false;
    }
  }

  function editNotification(notif: Notification) {
    newNotif = {
      title: notif.title,
      body: notif.body,
      category: notif.category || '',
      link: notif.link || ''
    };
    currentNotifId = notif.id;
    editMode = true;
  }

  function clearForm() {
    newNotif = { title: '', body: '', category: '', link: '' };
    editMode = false;
    currentNotifId = '';
  }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
  <ConfirmModal bind:isOpen={isConfirmOpen} title={confirmTitle} message={confirmMessage} onConfirm={onConfirmAction} confirmText={confirmTitle.includes('Delete') ? 'Delete' : 'Confirm'} />
  
  <div>
    <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">Push Notifications</h1>
    <p class="text-muted-foreground mt-1 text-sm">Send and manage global push notifications to all users.</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Form -->
    <div class="lg:col-span-1 border-r border-border/50 sm:pr-8 space-y-4 min-w-0">
      <div class="bg-transparent mb-6 flex flex-wrap justify-between gap-4 sm:items-center items-start border-b border-border/50 pb-4">
        <h3 class="font-semibold text-foreground flex items-center gap-2">
          <HugeiconsIcon icon={editMode ? Edit01Icon : Add01Icon} size={18} />
          {editMode ? 'Edit Notification' : 'New Notification'}
        </h3>
        {#if editMode}
          <button onclick={clearForm} class="text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
        {/if}
      </div>
      <form onsubmit={sendNotification} class="space-y-4">
          <div class="space-y-1.5">
            <label for="notifTitle" class="text-xs font-semibold text-muted-foreground  ">Title *</label>
            <input id="notifTitle" type="text" bind:value={newNotif.title} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="e.g. Server Maintenance" />
          </div>
          
          <div class="space-y-1.5">
            <label for="notifCategory" class="text-xs font-semibold text-muted-foreground  ">Category / Tag</label>
            <input id="notifCategory" type="text" bind:value={newNotif.category} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="e.g. Update" />
          </div>
          
          <div class="space-y-1.5">
            <label for="notifBody" class="text-xs font-semibold text-muted-foreground  ">Message Body *</label>
            <textarea id="notifBody" bind:value={newNotif.body} required class="w-full min-h-[100px] bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all resize-y" placeholder="Notification content..."></textarea>
          </div>

          <div class="space-y-1.5">
            <label for="notifLink" class="text-xs font-semibold text-muted-foreground  ">Action Link (Optional)</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 flex items-center pointer-events-none text-muted-foreground">
                <HugeiconsIcon icon={Link01Icon} size={16} />
              </div>
              <input id="notifLink" type="url" bind:value={newNotif.link} class="w-full pl-6 bg-transparent border-0 border-b border-border/50 rounded-none py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="https://..." />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} class="mt-4 btn-base btn-primary">
            <HugeiconsIcon icon={Notification01Icon} size={16} />
            {isSubmitting ? 'Saving...' : (editMode ? 'Save Notification' : 'Send Notification')}
          </button>
        </form>
      </div>

    <!-- List -->
    <div class="lg:col-span-2 space-y-4 sm:pl-4 min-w-0">
      <h3 class="font-semibold text-foreground text-lg">Sent History</h3>
      
      {#if isLoading}
        <div class="flex items-center justify-center h-48 text-muted-foreground">
          <p class="animate-pulse font-medium">Loading history...</p>
        </div>
      {:else if notifications.length === 0}
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3 border-b border-border/50">
          <HugeiconsIcon icon={Notification01Icon} size={32} class="opacity-50" />
          <p class="text-sm font-medium">No sent notifications found.</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each notifications as notif}
            <div class="bg-transparent border-b border-border/50 pb-4 mb-2 flex items-start gap-4">
              <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <HugeiconsIcon icon={Notification01Icon} size={20} />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <h4 class="font-bold text-foreground text-sm flex items-center gap-2">
                    {notif.title}
                    {#if notif.category}
                      <span class="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">{notif.category}</span>
                    {/if}
                  </h4>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(notif.sentAt).toLocaleString()}
                    </span>
                    <button onclick={() => editNotification(notif)} class="text-muted-foreground hover:text-primary transition-colors">
                      <HugeiconsIcon icon={Edit01Icon} size={14} />
                    </button>
                    <button onclick={() => {
                      confirmTitle = 'Delete Notification';
                      confirmMessage = 'Are you sure you want to delete this notification?';
                      onConfirmAction = async () => {
                        try {
                          await makeAdminRequest(`notifications?id=${notif.id}`, 'DELETE');
                          loadNotifications();
                        } catch(e: any) { addToast(e.message, 'error'); }
                      };
                      isConfirmOpen = true;
                    }} class="text-muted-foreground hover:text-destructive transition-colors">
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
                    </button>
                  </div>
                </div>
                <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{notif.body}</p>
                {#if notif.link}
                  <a href={notif.link} target="_blank" class="text-xs text-primary hover:underline mt-2 inline-block">
                    {notif.link}
                  </a>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

</div>
