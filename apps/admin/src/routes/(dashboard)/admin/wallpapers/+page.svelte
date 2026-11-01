<svelte:head>
  <title>Wallpapers</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { makeAdminRequest } from '$lib/api/admin';
  import { addToast } from '$lib/stores/toast';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Add01Icon,
    Edit01Icon,
    Delete01Icon,
    StarIcon,
    Upload01Icon,
    ArrowReloadHorizontalIcon,
    Cancel01Icon,
    SmartPhone01Icon,
    Image01Icon
  } from '@hugeicons/core-free-icons';
  import Modal from '$lib/components/Modal.svelte';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';

  type DynamicSlot = {
    start: string;
    end: string;
    image: string;
    exclusiveDates?: string[];
  };

  type Wallpaper = {
    id: string;
    name: string;
    slug: string;
    type: 'dynamic' | 'standard';
    isDefault: boolean;
    desktopImage: string;
    mobileImage: string;
    slots: DynamicSlot[];
    startDate?: string | null;
    endDate?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };

  let wallpapers = $state<Wallpaper[]>([]);
  let isLoading = $state(false);
  let isSaving = $state(false);
  let isUploadingDesktop = $state(false);
  let isUploadingMobile = $state(false);
  let uploadingSlotIndex = $state<number | null>(null);

  // Modal states
  let isModalOpen = $state(false);
  let isEditMode = $state(false);
  let currentId = $state('');

  // Delete modal state
  let isConfirmOpen = $state(false);
  let confirmId = $state('');

  // Form state
  let formName = $state('');
  let formType = $state('standard');
  let formIsDefault = $state(false);
  let formDesktopImage = $state('');
  let formMobileImage = $state('');
  let formHasSchedule = $state(false);
  let formStartDate = $state('');
  let formEndDate = $state('');
  let formSlots = $state<DynamicSlot[]>([]);

  // Preview tab in modal
  let editorPreviewTab = $state<'desktop' | 'mobile'>('desktop');

  const typeOptions = [
    { value: 'standard', label: 'Standard Static' },
    { value: 'dynamic', label: 'Dynamic Time-based' }
  ];

  async function loadWallpapers() {
    isLoading = true;
    try {
      const res: any = await makeAdminRequest('wallpapers', 'GET');
      wallpapers = Array.isArray(res.wallpapers) ? res.wallpapers : [];
    } catch (err: any) {
      addToast(err.message || 'Failed to load wallpapers', 'error');
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadWallpapers();
  });

  function openNewModal() {
    isEditMode = false;
    currentId = '';
    formName = '';
    formType = 'standard';
    formIsDefault = false;
    formDesktopImage = '';
    formMobileImage = '';
    formHasSchedule = false;
    formStartDate = '';
    formEndDate = '';
    formSlots = [];
    editorPreviewTab = 'desktop';
    isModalOpen = true;
  }

  function openEditModal(w: Wallpaper) {
    isEditMode = true;
    currentId = w.id;
    formName = w.name;
    formType = w.type;
    formIsDefault = w.isDefault;
    formDesktopImage = w.desktopImage || '';
    formMobileImage = w.mobileImage || '';
    formHasSchedule = !!(w.startDate || w.endDate);
    formStartDate = w.startDate ? w.startDate.split('T')[0] : '';
    formEndDate = w.endDate ? w.endDate.split('T')[0] : '';
    formSlots = (w.slots || []).map((s) => ({
      start: s.start || '06:00',
      end: s.end || '18:00',
      image: s.image || '',
      exclusiveDates: Array.isArray(s.exclusiveDates) ? [...s.exclusiveDates] : []
    }));
    editorPreviewTab = 'desktop';
    isModalOpen = true;
  }

  function addSlot() {
    formSlots = [
      ...formSlots,
      {
        start: '06:00',
        end: '18:00',
        image: '',
        exclusiveDates: []
      }
    ];
  }

  function removeSlot(idx: number) {
    formSlots = formSlots.filter((_, i) => i !== idx);
  }

  async function uploadImageFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);

    const token = localStorage.getItem('token') || '';
    const res = await fetch('/api/v2/admin/wallpapers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: fd
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Upload failed');
    }
    return data.url;
  }

  async function handleDesktopUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    isUploadingDesktop = true;
    try {
      formDesktopImage = await uploadImageFile(file);
      if (!formMobileImage) formMobileImage = formDesktopImage;
      addToast('Desktop image uploaded', 'success');
    } catch (err: any) {
      addToast(err.message || 'Image upload failed', 'error');
    } finally {
      isUploadingDesktop = false;
      input.value = '';
    }
  }

  async function handleMobileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    isUploadingMobile = true;
    try {
      formMobileImage = await uploadImageFile(file);
      addToast('Mobile image uploaded', 'success');
    } catch (err: any) {
      addToast(err.message || 'Image upload failed', 'error');
    } finally {
      isUploadingMobile = false;
      input.value = '';
    }
  }

  async function handleSlotUpload(e: Event, idx: number) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    uploadingSlotIndex = idx;
    try {
      const url = await uploadImageFile(file);
      formSlots[idx].image = url;
      addToast('Slot image uploaded', 'success');
    } catch (err: any) {
      addToast(err.message || 'Image upload failed', 'error');
    } finally {
      uploadingSlotIndex = null;
      input.value = '';
    }
  }

  async function saveWallpaper(e: Event) {
    e.preventDefault();
    if (!formName.trim()) {
      addToast('Please enter a name', 'error');
      return;
    }

    isSaving = true;
    try {
      const payload: any = {
        name: formName.trim(),
        type: formType,
        isDefault: formIsDefault,
        desktopImage: formDesktopImage.trim(),
        mobileImage: formMobileImage.trim() || formDesktopImage.trim(),
        slots: formSlots,
        startDate: formHasSchedule && formStartDate ? new Date(formStartDate).toISOString() : null,
        endDate: formHasSchedule && formEndDate ? new Date(formEndDate + 'T23:59:59.999Z').toISOString() : null
      };

      if (isEditMode) {
        await makeAdminRequest(`wallpapers?id=${currentId}`, 'PUT', payload);
        addToast('Wallpaper updated', 'success');
      } else {
        await makeAdminRequest('wallpapers', 'POST', payload);
        addToast('Wallpaper created', 'success');
      }

      isModalOpen = false;
      await loadWallpapers();
    } catch (err: any) {
      addToast(err.message || 'Failed to save', 'error');
    } finally {
      isSaving = false;
    }
  }

  async function toggleDefault(w: Wallpaper) {
    try {
      await makeAdminRequest(`wallpapers?id=${w.id}`, 'PUT', { isDefault: true });
      addToast(`Set ${w.name} as default`, 'success');
      await loadWallpapers();
    } catch (err: any) {
      addToast(err.message || 'Failed to set default', 'error');
    }
  }

  function promptDelete(id: string) {
    confirmId = id;
    isConfirmOpen = true;
  }

  async function executeDelete() {
    try {
      await makeAdminRequest(`wallpapers?id=${confirmId}`, 'DELETE');
      addToast('Wallpaper deleted', 'success');
      await loadWallpapers();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete', 'error');
    }
  }
</script>

<div class="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
  <ConfirmModal
    bind:isOpen={isConfirmOpen}
    title="Delete Wallpaper"
    message="Are you sure you want to delete this wallpaper? This cannot be undone."
    confirmText="Delete"
    onConfirm={executeDelete}
  />

  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 pb-4 border-b border-border/40">
    <div>
      <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">Wallpapers</h1>
      <p class="text-muted-foreground mt-1 text-sm">Manage dynamic, seasonal, and standard wallpapers</p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn-base btn-secondary"
        onclick={loadWallpapers}
        title="Refresh list"
      >
        <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} class={isLoading ? 'animate-spin' : ''} />
        <span>Refresh</span>
      </button>
      <button
        type="button"
        class="btn-base btn-primary"
        onclick={openNewModal}
      >
        <HugeiconsIcon icon={Add01Icon} size={16} />
        <span>Add Wallpaper</span>
      </button>
    </div>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center h-48 text-muted-foreground text-sm">
      <p class="animate-pulse">Loading wallpapers...</p>
    </div>
  {:else if wallpapers.length === 0}
    <div class="py-16 text-center text-sm text-muted-foreground border-y border-border/30">
      No wallpapers configured. Click "Add Wallpaper" to create one.
    </div>
  {:else}
    <!-- Clean Minimalist List (No nested cards, no cards inside cards) -->
    <div class="divide-y divide-border/30 border-y border-border/30">
      {#each wallpapers as w (w.id)}
        <div class="py-3 flex items-center justify-between gap-4 group hover:bg-muted/15 transition-colors px-1 rounded-md">
          <div class="flex items-center gap-3.5 min-w-0">
            <!-- 16:9 Thumbnail -->
            <button
              type="button"
              class="w-20 h-12 rounded-md overflow-hidden bg-muted/40 shrink-0 border border-border/40 cursor-pointer block p-0"
              onclick={() => openEditModal(w)}
              title="Click to edit {w.name}"
            >
              {#if w.desktopImage}
                <img src={w.desktopImage} alt={w.name} class="w-full h-full object-cover" loading="lazy" />
              {:else if w.slots && w.slots[0]?.image}
                <img src={w.slots[0].image} alt={w.name} class="w-full h-full object-cover" loading="lazy" />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-muted-foreground">
                  <HugeiconsIcon icon={Image01Icon} size={18} class="opacity-40" />
                </div>
              {/if}
            </button>

            <!-- Metadata (Plain, clear typography, zero pills) -->
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-foreground truncate">{w.name}</span>
                {#if w.isDefault}
                  <span class="text-xs font-medium text-primary">Default</span>
                {/if}
              </div>
              <div class="text-xs text-muted-foreground mt-0.5">
                {w.type === 'dynamic' ? (w.slots?.length ? `Dynamic · ${w.slots.length} time slots` : 'Dynamic') : 'Standard'}
                {#if w.startDate || w.endDate}
                  &middot; {w.startDate ? new Date(w.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Start'} to {w.endDate ? new Date(w.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'End'}
                {/if}
              </div>
            </div>
          </div>

          <!-- Actions (Just minimal icon buttons) -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="p-2 rounded-lg transition-colors {w.isDefault ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
              title={w.isDefault ? 'Current Default' : 'Set as Default'}
              onclick={() => toggleDefault(w)}
            >
              <HugeiconsIcon icon={StarIcon} size={16} />
            </button>
            <button
              type="button"
              class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Edit"
              onclick={() => openEditModal(w)}
            >
              <HugeiconsIcon icon={Edit01Icon} size={16} />
            </button>
            <button
              type="button"
              class="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
              onclick={() => promptDelete(w.id)}
            >
              <HugeiconsIcon icon={Delete01Icon} size={16} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Edit / Add Modal -->
  <Modal
    bind:isOpen={isModalOpen}
    title={isEditMode ? 'Edit Wallpaper' : 'Add Wallpaper'}
    maxWidthClass="sm:max-w-2xl"
  >
    <form onsubmit={saveWallpaper} class="space-y-5 px-6 pb-6 pt-2">
      <!-- Name and Custom Dropdown -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label for="wpName" class="text-xs font-semibold text-muted-foreground">Wallpaper Name *</label>
          <input
            id="wpName"
            type="text"
            bind:value={formName}
            required
            placeholder="e.g. Flow, Aurora, Midnight"
            class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div class="space-y-1.5">
          <span class="text-xs font-semibold text-muted-foreground">Type</span>
          <Dropdown
            id="wallpaper-type-dropdown"
            options={typeOptions}
            bind:value={formType}
            placeholder="Select Type"
          />
        </div>
      </div>

      <!-- Settings Checkboxes -->
      <div class="flex items-center gap-6 pt-1">
        <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
          <input
            type="checkbox"
            bind:checked={formIsDefault}
            class="rounded border-border text-primary focus:ring-primary/30"
          />
          <span>Set as Default</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
          <input
            type="checkbox"
            bind:checked={formHasSchedule}
            class="rounded border-border text-primary focus:ring-primary/30"
          />
          <span>Seasonal Schedule</span>
        </label>
      </div>

      <!-- Schedule inputs (flat, no nested card) -->
      {#if formHasSchedule}
        <div class="grid grid-cols-2 gap-3 pt-1 border-t border-border/30">
          <div class="space-y-1">
            <label for="wpStartDate" class="text-[11px] text-muted-foreground font-medium">Start Date</label>
            <input
              id="wpStartDate"
              type="date"
              bind:value={formStartDate}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
            />
          </div>
          <div class="space-y-1">
            <label for="wpEndDate" class="text-[11px] text-muted-foreground font-medium">End Date</label>
            <input
              id="wpEndDate"
              type="date"
              bind:value={formEndDate}
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
            />
          </div>
        </div>
      {/if}

      <!-- Visual Preview & Image Upload (Clean, single container) -->
      <div class="space-y-2 pt-2 border-t border-border/30">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-muted-foreground">Preview & Upload</span>
          <div class="flex items-center gap-1 text-xs">
            <button
              type="button"
              class="px-2.5 py-1 rounded-md text-xs transition-colors {editorPreviewTab === 'desktop' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => editorPreviewTab = 'desktop'}
            >
              Desktop
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md text-xs transition-colors {editorPreviewTab === 'mobile' ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => editorPreviewTab = 'mobile'}
            >
              Mobile
            </button>
          </div>
        </div>

        {#if editorPreviewTab === 'desktop'}
          <div class="relative aspect-video w-full rounded-xl border border-border/80 bg-muted/20 overflow-hidden flex items-center justify-center group">
            {#if formDesktopImage}
              <img src={formDesktopImage} alt="Desktop preview" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label class="btn-base btn-secondary text-xs cursor-pointer">
                  <span>{isUploadingDesktop ? 'Uploading...' : 'Replace'}</span>
                  <input type="file" accept="image/*" class="hidden" onchange={handleDesktopUpload} disabled={isUploadingDesktop} />
                </label>
                <button
                  type="button"
                  class="btn-base btn-destructive text-xs"
                  onclick={() => formDesktopImage = ''}
                >
                  <span>Remove</span>
                </button>
              </div>
            {:else}
              <label class="flex flex-col items-center justify-center p-6 cursor-pointer text-center w-full h-full">
                <HugeiconsIcon icon={Upload01Icon} size={24} class="text-muted-foreground mb-1.5" />
                <span class="text-xs font-medium text-foreground">
                  {isUploadingDesktop ? 'Uploading...' : 'Upload desktop image'}
                </span>
                <span class="text-[11px] text-muted-foreground mt-0.5">WebP, PNG, or JPG</span>
                <input type="file" accept="image/*" class="hidden" onchange={handleDesktopUpload} disabled={isUploadingDesktop} />
              </label>
            {/if}
          </div>
        {:else}
          <div class="flex justify-center">
            <div class="relative w-48 aspect-[9/16] rounded-xl border border-border/80 bg-muted/20 overflow-hidden flex items-center justify-center group">
              {#if formMobileImage}
                <img src={formMobileImage} alt="Mobile preview" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <label class="btn-base btn-secondary text-xs cursor-pointer w-full text-center">
                    <span>{isUploadingMobile ? 'Uploading...' : 'Replace'}</span>
                    <input type="file" accept="image/*" class="hidden" onchange={handleMobileUpload} disabled={isUploadingMobile} />
                  </label>
                  <button
                    type="button"
                    class="btn-base btn-destructive text-xs w-full text-center"
                    onclick={() => formMobileImage = ''}
                  >
                    <span>Remove</span>
                  </button>
                </div>
              {:else}
                <label class="flex flex-col items-center justify-center p-4 cursor-pointer text-center w-full h-full">
                  <HugeiconsIcon icon={SmartPhone01Icon} size={24} class="text-muted-foreground mb-1.5" />
                  <span class="text-xs font-medium text-foreground">
                    {isUploadingMobile ? 'Uploading...' : 'Upload mobile image'}
                  </span>
                  <span class="text-[10px] text-muted-foreground mt-0.5">Defaults to desktop image</span>
                  <input type="file" accept="image/*" class="hidden" onchange={handleMobileUpload} disabled={isUploadingMobile} />
                </label>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Dynamic Time Slots (Flat list, no cards inside cards) -->
      {#if formType === 'dynamic'}
        <div class="space-y-3 pt-3 border-t border-border/30">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-muted-foreground">Time Slots ({formSlots.length})</span>
            <button
              type="button"
              class="btn-base btn-secondary text-xs"
              onclick={addSlot}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} />
              <span>Add Slot</span>
            </button>
          </div>

          {#if formSlots.length > 0}
            <div class="divide-y divide-border/20 max-h-56 overflow-y-auto pr-1">
              {#each formSlots as slot, idx}
                <div class="py-2.5 flex items-center gap-3 text-xs">
                  <!-- Thumbnail -->
                  <label class="relative w-14 h-9 rounded-md bg-muted border border-border/40 overflow-hidden shrink-0 cursor-pointer block p-0" title="Upload slot image">
                    {#if slot.image}
                      <img src={slot.image} alt="Slot" class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center text-muted-foreground">
                        <HugeiconsIcon icon={Upload01Icon} size={14} />
                      </div>
                    {/if}
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      onchange={(e) => handleSlotUpload(e, idx)}
                      disabled={uploadingSlotIndex === idx}
                    />
                  </label>

                  <!-- Time -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <input
                      type="time"
                      bind:value={slot.start}
                      class="bg-background border border-border rounded-md px-1.5 py-1 text-xs outline-none"
                    />
                    <span class="text-muted-foreground">to</span>
                    <input
                      type="time"
                      bind:value={slot.end}
                      class="bg-background border border-border rounded-md px-1.5 py-1 text-xs outline-none"
                    />
                  </div>

                  <!-- Dates -->
                  <input
                    type="text"
                    placeholder="Optional dates (e.g. 2025-12-25)"
                    value={(slot.exclusiveDates || []).join(', ')}
                    oninput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      slot.exclusiveDates = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
                    }}
                    class="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1 text-xs outline-none"
                  />

                  <!-- Delete -->
                  <button
                    type="button"
                    class="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    onclick={() => removeSlot(idx)}
                    title="Remove slot"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={15} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Footer -->
      <div class="pt-4 border-t border-border/40 flex items-center justify-end gap-2.5">
        <button
          type="button"
          class="btn-base btn-secondary"
          onclick={() => isModalOpen = false}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          class="btn-base btn-primary"
        >
          {#if isSaving}
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} class="animate-spin" />
            <span>Saving...</span>
          {:else}
            <span>{isEditMode ? 'Save Changes' : 'Create Wallpaper'}</span>
          {/if}
        </button>
      </div>
    </form>
  </Modal>
</div>
