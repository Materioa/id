<svelte:head>
  <title>Writer</title>
</svelte:head>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { addToast } from '$lib/stores/toast';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import PostAnalyticsModal from '$lib/components/PostAnalyticsModal.svelte';
  import PostPhotoStack from '$lib/components/PostPhotoStack.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Add01Icon,
    Search01Icon,
    Cancel01Icon,
    Analytics01Icon,
    Upload01Icon
  } from '@hugeicons/core-free-icons';

  let { data }: { data: { posts: any[]; exodusPosts?: any[] } } = $props();

  let deletedIds = $state<Set<string>>(new Set());
  let roomPosts = $derived((data.posts || []).filter((p) => !deletedIds.has(p.id)));
  let exodusPosts = $derived((data.exodusPosts || []).filter((p) => !deletedIds.has(p.id)));

  // Scope: 'room' | 'exodus'
  let activeScope = $state<'room' | 'exodus'>('room');

  // Search & Filter
  let searchQuery = $state('');
  let statusFilter = $state('all'); // 'all', 'published', 'draft'
  let selectedCategory = $state('all');
  let exodusTypeFilter = $state('all'); // 'all', 'changelog', 'doc', 'legal'

  // Modals
  let postToDelete = $state<any | null>(null);
  let isDeleting = $state(false);
  let postForAnalytics = $state<{ id: string; title: string } | null>(null);

  // Extract all images in a post (cover + markdown embedded)
  function extractPostImages(post: any): string[] {
    if (Array.isArray(post.images) && post.images.length) {
      return post.images;
    }
    const list: string[] = [];
    const cover = post.image || post.metadata?.image;
    if (cover) list.push(cover);

    if (post.content) {
      const regex = /!\[.*?\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+)\)/g;
      let match;
      while ((match = regex.exec(post.content)) !== null) {
        if (!list.includes(match[1])) {
          list.push(match[1]);
        }
      }
    }
    return list;
  }

  // Human date formatting (OpenRunde, non-mono)
  function formatDate(d?: string) {
    if (!d) return '';
    try {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return d;
      return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return d;
    }
  }

  // Categories for Room dropdown
  let categoryOptions = $derived([
    { value: 'all', label: 'All categories' },
    ...Array.from(
      new Set(
        roomPosts
          .map((p) => p.category || (p.categories && p.categories[0]) || '')
          .filter((c) => c && c.trim() !== '')
      )
    ).map((c) => ({ value: c, label: c }))
  ]);

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Drafts' }
  ];

  const exodusTypeOptions = [
    { value: 'all', label: 'All documents' },
    { value: 'changelog', label: 'Changelog' },
    { value: 'doc', label: 'Docs' },
    { value: 'legal', label: 'Legal' }
  ];

  // Filtered Room Posts
  let filteredRoomPosts = $derived.by(() => {
    return roomPosts.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (statusFilter === 'published') {
        if (p.draft || p.hidden || p.visibility === 'private') return false;
      } else if (statusFilter === 'draft') {
        if (!p.draft) return false;
      }

      if (selectedCategory !== 'all') {
        const cat = p.category || (p.categories && p.categories[0]) || '';
        if (cat !== selectedCategory) return false;
      }

      return true;
    });
  });

  // Filtered Exodus Posts
  let filteredExodusPosts = $derived.by(() => {
    return exodusPosts.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q) ||
        (p.filename || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (exodusTypeFilter !== 'all') {
        if (p.docType !== exodusTypeFilter) return false;
      }

      return true;
    });
  });

  function getRowOptions(post: any) {
    const opts = [{ value: 'edit', label: 'Edit' }];
    if (activeScope === 'room') {
      opts.push({ value: 'analytics', label: 'Analytics' });
    }
    if (post.url) {
      opts.push({ value: 'live', label: 'View live' });
    }
    opts.push({ value: 'delete', label: 'Delete' });
    return opts;
  }

  function handleRowAction(post: any, action: string) {
    if (action === 'edit') {
      if (activeScope === 'room') {
        goto(`/admin/writer/editor/${post.id}?scope=room`);
      } else {
        goto(`/admin/writer/editor/${post.id}?scope=exodus&docType=${post.docType || 'doc'}`);
      }
    } else if (action === 'analytics') {
      postForAnalytics = { id: post.id, title: post.title || post.slug };
    } else if (action === 'live') {
      const base = activeScope === 'room' ? 'https://room.getmaterio.app' : 'https://getmaterio.app';
      window.open(`${base}${post.url}`, '_blank');
    } else if (action === 'delete') {
      postToDelete = post;
    }
  }

  async function confirmDeletePost() {
    if (!postToDelete) return;
    isDeleting = true;
    try {
      const res = await fetch(`/api/admin/posts?id=${encodeURIComponent(postToDelete.id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as any;
        throw new Error(errData.error || 'Failed to delete');
      }

      deletedIds = new Set([...deletedIds, postToDelete.id]);
      addToast('Deleted successfully', 'success');
      postToDelete = null;
    } catch (err: any) {
      addToast(err.message || 'Error deleting', 'error');
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 font-sans animate-in fade-in duration-300">
  <!-- Top Bar -->
  <div class="flex items-center justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground truncate">
        Writer
      </h1>
      <p class="text-muted-foreground mt-0.5 sm:mt-1 text-xs sm:text-sm font-sans truncate">
        Publish technical notes, docs, changelogs, and legal pages.
      </p>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <a
        href="/admin/writer/analytics"
        class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
        title="Readership analytics"
      >
        <HugeiconsIcon icon={Analytics01Icon} size={18} />
      </a>
      <a
        href="/admin/writer/mcp-upload"
        class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
        title="Upload asset"
      >
        <HugeiconsIcon icon={Upload01Icon} size={18} />
      </a>

      <!-- Primary Create Action -->
      <a
        href={activeScope === 'room' ? '/admin/writer/editor/new?scope=room' : `/admin/writer/editor/new?scope=exodus&docType=${exodusTypeFilter === 'all' ? 'doc' : exodusTypeFilter}`}
        class="btn-base btn-primary text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 sm:py-2 inline-flex items-center gap-1.5 ml-1"
      >
        <HugeiconsIcon icon={Add01Icon} size={16} />
        <span>New</span>
      </a>
    </div>
  </div>

  <!-- Scope Control & Filters with custom Dropdowns -->
  <div class="flex flex-col gap-3 pt-2 border-t border-border/50">
    <div class="flex flex-wrap items-center justify-between gap-2.5">
      <!-- Apple-style Scope Switcher -->
      <div class="flex items-center gap-1 p-1 bg-muted/40 rounded-xl shrink-0">
        <button
          onclick={() => (activeScope = 'room')}
          class="px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 {activeScope === 'room' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
        >
          Room ({roomPosts.length})
        </button>
        <button
          onclick={() => (activeScope = 'exodus')}
          class="px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 {activeScope === 'exodus' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
        >
          Website ({exodusPosts.length})
        </button>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-2">
        {#if activeScope === 'room'}
          <div class="w-28 sm:w-32">
            <Dropdown
              compact={true}
              options={statusOptions}
              bind:value={statusFilter}
            />
          </div>
          {#if categoryOptions.length > 2}
            <div class="w-32 sm:w-36">
              <Dropdown
                compact={true}
                options={categoryOptions}
                bind:value={selectedCategory}
              />
            </div>
          {/if}
        {:else}
          <div class="w-32 sm:w-36">
            <Dropdown
              compact={true}
              options={exodusTypeOptions}
              bind:value={exodusTypeFilter}
            />
          </div>
        {/if}
      </div>
    </div>

    <!-- Search input: full-width on mobile, right-aligned on desktop -->
    <div class="relative w-full sm:w-64 sm:self-end">
      <HugeiconsIcon icon={Search01Icon} size={15} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search..."
        class="w-full pl-8 pr-7 py-1.5 bg-background border border-border/70 rounded-lg text-xs font-sans text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 transition-colors"
      />
      {#if searchQuery}
        <button
          onclick={() => (searchQuery = '')}
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={12} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Articles List: only photo stack, title, date, and custom dropdown options -->
  {#if activeScope === 'room'}
    <div class="border-t border-border/50 divide-y divide-border/40 group/list">
      {#each filteredRoomPosts as post}
        <div class="py-3.5 sm:py-4 flex items-center justify-between gap-3 sm:gap-5 group transition-all duration-200 group-hover/list:opacity-40 hover:!opacity-100">
          <!-- Left: Photo Fan Stack -->
          <PostPhotoStack images={extractPostImages(post)} alt={post.title} />

          <!-- Center: Title and Date only -->
          <div class="min-w-0 flex-1">
            <a
              href={`/admin/writer/editor/${post.id}?scope=room`}
              class="font-serif text-[17px] font-normal tracking-tight text-foreground group-hover:text-primary transition-colors truncate block"
            >
              {post.title || post.slug}
            </a>
            <div class="text-xs text-muted-foreground font-sans mt-0.5">
              {formatDate(post.date || post.created_at)}
              {#if post.draft}
                <span class="text-amber-600 dark:text-amber-400 ml-1.5">· Draft</span>
              {/if}
            </div>
          </div>

          <!-- Right: Custom Dropdown for Options -->
          <div class="w-20 sm:w-24 shrink-0">
            <Dropdown
              compact={true}
              align="right"
              resetOnSelect={true}
              placeholder="Options"
              options={getRowOptions(post)}
              onchange={(val) => handleRowAction(post, val)}
            />
          </div>
        </div>
      {/each}

      {#if filteredRoomPosts.length === 0}
        <div class="py-20 text-center text-xs text-muted-foreground font-sans">
          No articles found.
        </div>
      {/if}
    </div>
  {:else}
    <!-- Exodus Pages List -->
    <div class="border-t border-border/50 divide-y divide-border/40 group/list">
      {#each filteredExodusPosts as page}
        <div class="py-3.5 sm:py-4 flex items-center justify-between gap-3 sm:gap-5 group transition-all duration-200 group-hover/list:opacity-40 hover:!opacity-100">
          <!-- Left: Photo Fan Stack -->
          <PostPhotoStack images={extractPostImages(page)} alt={page.title} />

          <!-- Center: Title and Date only -->
          <div class="min-w-0 flex-1">
            <a
              href={`/admin/writer/editor/${page.id}?scope=exodus&docType=${page.docType}`}
              class="font-serif text-[17px] font-normal tracking-tight text-foreground group-hover:text-primary transition-colors truncate block"
            >
              {page.title || page.filename}
            </a>
            <div class="text-xs text-muted-foreground font-sans mt-0.5">
              {formatDate(page.date)}
            </div>
          </div>

          <!-- Right: Custom Dropdown for Options -->
          <div class="w-20 sm:w-24 shrink-0">
            <Dropdown
              compact={true}
              align="right"
              resetOnSelect={true}
              placeholder="Options"
              options={getRowOptions(page)}
              onchange={(val) => handleRowAction(page, val)}
            />
          </div>
        </div>
      {/each}

      {#if filteredExodusPosts.length === 0}
        <div class="py-20 text-center text-xs text-muted-foreground font-sans">
          No website documents found.
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Confirm Delete Modal -->
{#if postToDelete}
  <ConfirmModal
    isOpen={Boolean(postToDelete)}
    title="Delete post"
    message={`Permanently delete "${postToDelete.title || postToDelete.slug || postToDelete.filename}"?`}
    confirmText={isDeleting ? 'Deleting...' : 'Delete'}
    confirmVariant="danger"
    onConfirm={confirmDeletePost}
    onCancel={() => (postToDelete = null)}
  />
{/if}

<!-- Telemetry Modal -->
{#if postForAnalytics}
  <PostAnalyticsModal
    postId={postForAnalytics.id}
    postTitle={postForAnalytics.title}
    onClose={() => (postForAnalytics = null)}
  />
{/if}
