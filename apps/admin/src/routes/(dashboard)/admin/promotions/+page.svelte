<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    Megaphone01Icon, Add01Icon, CheckmarkCircle01Icon,
    Delete01Icon, Link01Icon, Image01Icon, Calendar01Icon, Edit01Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import Modal from '$lib/components/Modal.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';

  type Promotion = {
    id: string;
    title: string;
    description: string;
    category: string;
    buttonText: string;
    buttonLink: string;
    imageUrl: string;
    orientation: string;
    mediaFit: string;
    isActive: boolean;
    createdAt: string;
  };

  let promotions = $state<Promotion[]>([]);
  let activePromotions = $derived(promotions.filter(p => p.isActive));
  let historyPromotions = $derived(promotions.filter(p => !p.isActive));
  let isLoading = $state(false);
  let activeTab = $state<'active' | 'history'>('active');

  let newPromo = $state({
    title: '',
    description: '',
    category: 'whats-new',
    buttonText: '',
    buttonLink: '',
    imageUrl: '',
    orientation: 'horizontal',
    mediaFit: 'cover',
    isActive: true
  });
  let isSubmitting = $state(false);
    let isPromoModalOpen = $state(false);
  let editingPromoId = $state<string | null>(null);

  async function loadPromotions() {
    isLoading = true;
    try {
      const res: any = await makeAdminRequest('promotions?all=true', 'GET');
      promotions = Array.isArray(res) ? res : (res.promotions || []);
    } catch (e: any) {
      console.error(e);
      promotions = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadPromotions();
  });

  function editPromotion(promo: Promotion) {
    isPromoModalOpen = true;
    editingPromoId = promo.id;
    newPromo = {
      title: promo.title,
      description: promo.description,
      category: promo.category || 'whats-new',
      buttonText: promo.buttonText,
      buttonLink: promo.buttonLink,
      imageUrl: promo.imageUrl,
      orientation: promo.orientation || 'horizontal',
      mediaFit: promo.mediaFit || 'cover',
      isActive: promo.isActive
    };
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    editingPromoId = null;
    newPromo = { title: '', description: '', category: 'whats-new', buttonText: '', buttonLink: '', imageUrl: '', orientation: 'horizontal', mediaFit: 'cover', isActive: true };
  }

  async function createPromotion(e: Event) {
    e.preventDefault();
    isSubmitting = true;
    try {
      if (editingPromoId) {
        await makeAdminRequest(`promotions?id=${editingPromoId}`, 'PUT', { id: editingPromoId, ...newPromo });
        addToast('Promotion updated successfully!');
        cancelEdit();
      } else {
        await makeAdminRequest('promotions', 'POST', newPromo);
        addToast('Promotion created successfully!');
        cancelEdit();
      }
      loadPromotions();
    } catch (e: any) {
      addToast(`Failed to save promotion: ${e.message}`);
    } finally {
      isSubmitting = false;
    }
  }

  async function toggleStatus(promo: Promotion) {
    if (promo.isActive && !confirm('Are you sure you want to deactivate this promotion?')) return;
    if (!promo.isActive && !confirm('Are you sure you want to activate this promotion? This will disable other active promotions.')) return;
    try {
      // The backend accepts ?id= in URL or id in body. We'll pass in body.
      await makeAdminRequest(`promotions?id=${promo.id}`, 'PUT', { id: promo.id, isActive: !promo.isActive });
      loadPromotions();
    } catch (e: any) {
      addToast(`Failed to update status: ${e.message}`);
    }
  }

  async function deletePromotion(id: string) {
    if (!confirm('Are you sure you want to delete this promotion? This cannot be undone.')) return;
    try {
      await makeAdminRequest(`promotions?id=${id}`, 'DELETE');
      loadPromotions();
    } catch (e: any) {
      addToast(`Failed to delete promotion: ${e.message}`);
    }
  }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
  <div>
    <h1 class="text-2xl font-bold text-foreground tracking-tight">Promotions Management</h1>
    <p class="text-muted-foreground mt-1 text-sm">Create and manage global promotional modals and banners.</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Form Modal -->
      <Modal bind:isOpen={isPromoModalOpen} title={editingPromoId ? 'Edit Promotion' : 'New Promotion'} onClose={cancelEdit}>
        <form onsubmit={(e) => { createPromotion(e); isPromoModalOpen = false; }} class="space-y-4 px-6 pb-6 pt-2">
          
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label for="promoTitle" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</label>
              <input id="promoTitle" type="text" bind:value={newPromo.title} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="e.g. Premium Plan Discount" />
            </div>
            <div class="space-y-1.5">
              <label for="promoCat" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
              <input id="promoCat" type="text" bind:value={newPromo.category} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="e.g. whats-new" />
            </div>
          </div>
          
          <div class="space-y-1.5">
            <label for="promoDesc" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea id="promoDesc" bind:value={newPromo.description} required class="w-full min-h-[100px] bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all resize-y" placeholder="Detail the offer..."></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label for="promoBtnText" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button Text</label>
              <input id="promoBtnText" type="text" bind:value={newPromo.buttonText} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="e.g. Upgrade" />
            </div>
            <div class="space-y-1.5">
              <label for="promoBtnLink" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button Link</label>
              <input id="promoBtnLink" type="url" bind:value={newPromo.buttonLink} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="https://..." />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="space-y-1.5 col-span-1">
              <label for="promoImg" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image URL</label>
              <input id="promoImg" type="url" bind:value={newPromo.imageUrl} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="https://..." />
            </div>
            <div class="space-y-1.5 col-span-1">
              <label for="promoFit" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media Fit</label>
              <Dropdown bind:value={newPromo.mediaFit} options={[
                { value: 'cover', label: 'Cover (Fill & Crop)' },
                { value: 'contain', label: 'Contain (Fit)' },
                { value: 'scale-down', label: 'Scale Down' },
                { value: 'fill', label: 'Fill (Stretch)' },
                { value: 'none', label: 'None' }
              ]} />
            </div>
            <div class="space-y-1.5 col-span-1">
              <label for="promoOrientation" class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Orientation</label>
              <Dropdown bind:value={newPromo.orientation} options={[
                { value: 'horizontal', label: 'Horizontal' },
                { value: 'vertical', label: 'Vertical' }
              ]} />
            </div>
          </div>

          <Checkbox bind:checked={newPromo.isActive} label="Set as Active" />

          <div class="flex items-center gap-3 mt-4">
            <button type="submit" disabled={isSubmitting} class="w-full btn-base btn-primary mt-4">
              <HugeiconsIcon icon={editingPromoId ? Edit01Icon : Megaphone01Icon} size={16} />
              {isSubmitting ? 'Saving...' : editingPromoId ? 'Update Promotion' : 'Publish Promotion'}
            </button>
            
            {#if editingPromoId}
              <button type="button" onclick={cancelEdit} class="w-full btn-base btn-secondary mt-2">
                Cancel Edit
              </button>
            {/if}
          </div>
        
        </form>
      </Modal>

      <div class="mb-6 lg:col-span-1 pr-8 border-r border-border/50">
        <button onclick={() => isPromoModalOpen = true} class="w-full btn-base btn-primary">
          <HugeiconsIcon icon={Add01Icon} size={18} /> New Promotion
        </button>
      </div>

    <!-- List -->
    <div class="lg:col-span-2 space-y-4 pl-4">
      <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 mb-6 border-b border-border/50 pb-4">
        <h3 class="font-semibold text-foreground text-lg">Promotions List</h3>
        <div class="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
          <button 
            onclick={() => activeTab = 'active'}
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {activeTab === 'active' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            Active ({activePromotions.length})
          </button>
          <button 
            onclick={() => activeTab = 'history'}
            class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {activeTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            History ({historyPromotions.length})
          </button>
        </div>
      </div>
      
      {#if isLoading}
        <div class="flex items-center justify-center h-48 text-muted-foreground">
          <p class="animate-pulse font-medium">Loading promotions...</p>
        </div>
      {:else if (activeTab === 'active' ? activePromotions : historyPromotions).length === 0}
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3 border-b border-border/50">
          <HugeiconsIcon icon={Megaphone01Icon} size={32} class="opacity-50" />
          <p class="text-sm font-medium">No {activeTab} promotions found.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each (activeTab === 'active' ? activePromotions : historyPromotions) as promo}
            <div class="bg-transparent border-b border-border/50 pb-4 flex flex-col">
              {#if promo.imageUrl}
                <div class="h-32 bg-muted/50 relative overflow-hidden flex items-center justify-center mb-4">
                  <img src={promo.imageUrl} alt="Promo" class="object-cover w-full h-full" onerror={(e) => { const target = e.currentTarget as HTMLImageElement; target.style.display = 'none'; }} />
                </div>
              {/if}
              <div class="flex-1 flex flex-col">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <h4 class="font-semibold text-foreground">{promo.title}</h4>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider {promo.isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground'}">
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p class="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{promo.description}</p>
                
                <div class="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                  <span class="text-xs text-muted-foreground flex items-center gap-1">
                    <HugeiconsIcon icon={Calendar01Icon} size={12} />
                    {new Date(promo.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                  
                  <div class="flex items-center gap-1">
                    <button onclick={() => editPromotion(promo)} class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background transition-colors" title="Edit">
                      <HugeiconsIcon icon={Edit01Icon} size={16} />
                    </button>
                    <button onclick={() => toggleStatus(promo)} class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background transition-colors" title={promo.isActive ? "Deactivate" : "Activate"}>
                      <HugeiconsIcon icon={promo.isActive ? CheckmarkCircle01Icon : CheckmarkCircle01Icon} size={16} class={promo.isActive ? "text-primary" : ""} />
                    </button>
                    <button onclick={() => deletePromotion(promo.id)} class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                      <HugeiconsIcon icon={Delete01Icon} size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

</div>
