<svelte:head>
  <title>{title ? `${title} — Editor` : 'Editor'}</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Marked } from 'marked';
  import { diffLines } from 'diff';
  import { addToast } from '$lib/stores/toast';
  import Dropdown from '$lib/components/Dropdown.svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    ArrowLeft02Icon,
    FloppyDiskIcon,
    Delete02Icon,
    Time04Icon,
    Settings02Icon,
    SparklesIcon,
    Heading01Icon,
    TextBoldIcon,
    TextItalicIcon,
    CodeIcon,
    QuoteDownIcon,
    ListViewIcon,
    ListOrderedIcon,
    Link01Icon,
    TableIcon,
    Image01Icon,
    Cancel01Icon,
    Add01Icon
  } from '@hugeicons/core-free-icons';
  import type { ExodusDocType } from '$lib/server/exodus-content';
  import authorsData from '$lib/authors.json';

  let { data }: { data: { post: any; versions: any[]; scope: 'room' | 'exodus'; docType?: ExodusDocType } } = $props();

  let id = $state(data.post?.id || 'new');
  let scope = $state<'room' | 'exodus'>(data.scope || 'room');
  let docType = $state<string>(data.docType || 'doc');

  let title = $state(data.post?.title || '');
  let slug = $state(data.post?.slug || '');
  let content = $state(data.post?.content || '');
  let author = $state(data.post?.author || data.post?.metadata?.author || 'Jinansh');
  let category = $state(data.post?.category || (data.post?.metadata?.category || ''));
  let date = $state(data.post?.date || new Date().toISOString().split('T')[0]);
  let excerpt = $state(data.post?.excerpt || data.post?.metadata?.excerpt || '');
  let image = $state(data.post?.image || data.post?.metadata?.image || '');
  let draft = $state(Boolean(data.post?.draft ?? data.post?.metadata?.draft));
  let hidden = $state(Boolean(data.post?.hidden ?? data.post?.metadata?.hidden));
  let visibility = $state(data.post?.visibility || data.post?.metadata?.visibility || 'public');

  // Custom frontmatter fields
  let customFields = $state<{ key: string; value: string }[]>([]);

  onMount(() => {
    if (data.post?.metadata) {
      const coreKeys = ['title', 'slug', 'author', 'category', 'date', 'excerpt', 'image', 'visibility', 'hidden', 'draft'];
      const extra: { key: string; value: string }[] = [];
      for (const [k, v] of Object.entries(data.post.metadata)) {
        if (!coreKeys.includes(k) && typeof v !== 'object') {
          extra.push({ key: k, value: String(v) });
        }
      }
      customFields = extra;
    }

    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) {
        editorMode = 'split';
      }
      const handleResize = () => {
        if (window.innerWidth < 640 && editorMode === 'split') {
          editorMode = 'write';
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  });

  // Editor mode: 'write' | 'split' | 'preview'
  let editorMode = $state<'write' | 'split' | 'preview'>('write');
  let isSaving = $state(false);
  let hasUnsavedChanges = $state(false);

  // Drawers
  let showSettingsDrawer = $state(false);
  let showHistoryDrawer = $state(false);
  let showOutlineModal = $state(false);

  // History
  let versions = $state(data.versions || []);
  let selectedVersion = $state<any | null>(null);
  let diffResults = $state<{ type: 'added' | 'removed' | 'same'; text: string }[]>([]);
  let diffStats = $state({ additions: 0, deletions: 0 });

  // Outline tool
  let outlineTopic = $state('');
  let isGeneratingOutline = $state(false);
  let generatedOutline = $state('');

  // Upload state
  let isUploadingMedia = $state(false);
  let isUploadingCover = $state(false);
  let textareaEl: HTMLTextAreaElement | null = $state(null);

  const authorOptions = Object.keys(authorsData).map((k) => ({ value: k, label: k }));

  const docTypeOptions = [
    { value: 'doc', label: 'Docs' },
    { value: 'changelog', label: 'Changelog' },
    { value: 'legal', label: 'Legal' }
  ];

  // Marked renderer
  const markedInstance = new Marked({ gfm: true, breaks: true });
  let renderedHtml = $derived.by(() => {
    try {
      return markedInstance.parse(content || '') as string;
    } catch {
      return '<p class="text-destructive">Error rendering preview.</p>';
    }
  });

  // Word count & reading time
  let wordCount = $derived((content || '').trim().split(/\s+/).filter(Boolean).length);
  let readingTimeMin = $derived(Math.max(1, Math.ceil(wordCount / 200)));

  function markDirty() {
    hasUnsavedChanges = true;
  }

  function addCustomField() {
    customFields = [...customFields, { key: '', value: '' }];
    markDirty();
  }

  function removeCustomField(index: number) {
    customFields = customFields.filter((_, i) => i !== index);
    markDirty();
  }

  function insertFormatting(prefix: string, suffix: string = '') {
    if (!textareaEl) return;
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const sel = content.substring(start, end) || 'text';
    const replacement = `${prefix}${sel}${suffix}`;

    content = content.substring(0, start) + replacement + content.substring(end);
    markDirty();

    setTimeout(() => {
      if (textareaEl) {
        textareaEl.focus();
        textareaEl.setSelectionRange(start + prefix.length, start + prefix.length + sel.length);
      }
    }, 0);
  }

  async function uploadMedia(file: File, isCover: boolean = false) {
    const formData = new FormData();
    formData.append('file', file);

    if (isCover) isUploadingCover = true;
    else isUploadingMedia = true;

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const resData = (await res.json()) as any;
      if (!res.ok || !resData.url) throw new Error(resData.error || 'Upload failed');

      if (isCover) {
        image = resData.url;
        addToast('Cover image updated', 'success');
      } else {
        insertFormatting(`\n![${file.name}](${resData.url})\n`);
        // If no cover image exists yet, make this first uploaded image the cover
        if (!image || !image.trim()) {
          image = resData.url;
          addToast('Image inserted & set as cover', 'success');
        } else {
          addToast('Image inserted', 'success');
        }
      }
      markDirty();
    } catch (err: any) {
      addToast(err.message || 'Error uploading media', 'error');
    } finally {
      if (isCover) isUploadingCover = false;
      else isUploadingMedia = false;
    }
  }

  function handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          uploadMedia(file, false);
          return;
        }
      }
    }
  }

  function handleDrop(e: DragEvent) {
    if (!e.dataTransfer) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        e.preventDefault();
        uploadMedia(file, false);
      }
    }
  }

  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
    }
  }

  async function savePost() {
    if (!title.trim() && !content.trim()) {
      addToast('Cannot save empty post', 'error');
      return;
    }

    isSaving = true;
    try {
      const metadataPayload: Record<string, any> = {
        author,
        category,
        date,
        excerpt,
        image,
        draft,
        hidden,
        visibility
      };

      for (const field of customFields) {
        if (field.key.trim()) {
          metadataPayload[field.key.trim()] = field.value;
        }
      }

      const payload = {
        id: id === 'new' ? undefined : id,
        scope,
        docType: scope === 'exodus' ? docType : undefined,
        title,
        slug: slug.trim() || undefined,
        content,
        author,
        category,
        date,
        excerpt,
        image,
        draft,
        hidden,
        visibility,
        metadata: metadataPayload
      };

      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = (await res.json()) as any;
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Save failed');
      }

      hasUnsavedChanges = false;
      addToast('Saved successfully', 'success');

      const newId = resData.id || resData.post?.id;
      if (id === 'new' && newId) {
        id = newId;
        window.history.replaceState({}, '', `/admin/writer/editor/${id}?scope=${scope}${scope === 'exodus' ? `&docType=${docType}` : ''}`);
      }
    } catch (err: any) {
      addToast(err.message || 'Error saving post', 'error');
    } finally {
      isSaving = false;
    }
  }

  async function deleteCurrentPost() {
    if (id === 'new') return;
    if (!confirm('Permanently delete this item?')) return;

    try {
      const res = await fetch(`/api/admin/posts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      addToast('Deleted', 'success');
      window.location.href = '/admin/writer';
    } catch (err: any) {
      addToast(err.message || 'Error deleting', 'error');
    }
  }

  function compareWithVersion(v: any) {
    selectedVersion = v;
    const oldContent = v.content || '';
    const currentContent = content || '';
    const diff = diffLines(oldContent, currentContent);

    let additions = 0;
    let deletions = 0;

    diffResults = diff.map((part) => {
      const type = part.added ? 'added' : part.removed ? 'removed' : 'same';
      const count = part.value.split('\n').filter(Boolean).length;
      if (part.added) additions += count;
      if (part.removed) deletions += count;
      return { type, text: part.value };
    });

    diffStats = { additions, deletions };
  }

  function restoreVersion(v: any) {
    if (!v) return;
    content = v.content || '';
    if (v.title) title = v.title;
    markDirty();
    selectedVersion = null;
    showHistoryDrawer = false;
    addToast('Restored content from revision', 'success');
  }

  async function generateOutline() {
    if (!outlineTopic.trim()) return;
    isGeneratingOutline = true;
    try {
      const res = await fetch('/api/admin/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: outlineTopic })
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to generate outline');
      generatedOutline = data.outline || '';
    } catch (err: any) {
      addToast(err.message || 'Error generating outline', 'error');
    } finally {
      isGeneratingOutline = false;
    }
  }

  function insertGeneratedOutline() {
    if (!generatedOutline) return;
    content = (content ? content + '\n\n' : '') + generatedOutline;
    markDirty();
    showOutlineModal = false;
    generatedOutline = '';
    outlineTopic = '';
    addToast('Outline inserted', 'success');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      savePost();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="h-full flex flex-col bg-card text-foreground font-sans overflow-hidden">
  <!-- Desktop Header: Sleek unified single row -->
  <header class="hidden sm:flex h-13 border-b border-border/50 px-4 items-center justify-between gap-3 shrink-0 bg-card">
    <!-- Left: Navigation & Scope -->
    <div class="flex items-center gap-3 min-w-0">
      <a
        href="/admin/writer"
        class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
        title="Back"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={18} />
      </a>

      <!-- Apple-style Scope Switcher -->
      <div class="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg text-xs">
        <button
          onclick={() => { scope = 'room'; markDirty(); }}
          class="px-2.5 py-1 rounded-md transition-all duration-150 {scope === 'room' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'}"
        >
          Room
        </button>
        <button
          onclick={() => { scope = 'exodus'; markDirty(); }}
          class="px-2.5 py-1 rounded-md transition-all duration-150 {scope === 'exodus' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'}"
        >
          Website
        </button>
      </div>

      {#if scope === 'exodus'}
        <div class="w-32">
          <Dropdown
            compact={true}
            options={docTypeOptions}
            bind:value={docType}
            onchange={markDirty}
          />
        </div>
      {/if}

      {#if hasUnsavedChanges}
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes"></span>
      {/if}
    </div>

    <!-- Center: View Mode Toggle -->
    <div class="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg text-xs">
      <button
        onclick={() => (editorMode = 'write')}
        class="px-2.5 py-1 rounded-md transition-colors {editorMode === 'write' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'}"
      >
        Write
      </button>
      <button
        onclick={() => (editorMode = 'split')}
        class="px-2.5 py-1 rounded-md transition-colors {editorMode === 'split' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'}"
      >
        Split
      </button>
      <button
        onclick={() => (editorMode = 'preview')}
        class="px-2.5 py-1 rounded-md transition-colors {editorMode === 'preview' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground hover:text-foreground'}"
      >
        Preview
      </button>
    </div>

    <!-- Right: Tool Icon Buttons & Save -->
    <div class="flex items-center gap-1">
      <button
        onclick={() => (showOutlineModal = true)}
        class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
        title="Outline assistant"
      >
        <HugeiconsIcon icon={SparklesIcon} size={17} />
      </button>

      {#if scope === 'room' && id !== 'new'}
        <button
          onclick={() => (showHistoryDrawer = true)}
          class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
          title="Revisions"
        >
          <HugeiconsIcon icon={Time04Icon} size={17} />
        </button>
      {/if}

      <button
        onclick={() => (showSettingsDrawer = true)}
        class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
        title="Settings"
      >
        <HugeiconsIcon icon={Settings02Icon} size={17} />
      </button>

      {#if id !== 'new'}
        <button
          onclick={deleteCurrentPost}
          class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          title="Delete"
        >
          <HugeiconsIcon icon={Delete02Icon} size={17} />
        </button>
      {/if}

      <button
        onclick={savePost}
        disabled={isSaving}
        class="btn-base btn-primary text-xs px-3.5 py-1.5 ml-1 inline-flex items-center gap-1.5"
      >
        <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
        <span>{isSaving ? 'Saving...' : 'Save'}</span>
      </button>
    </div>
  </header>

  <!-- Mobile Header: 2 clean uncrowded rows -->
  <header class="flex sm:hidden flex-col shrink-0 bg-card border-b border-border/50">
    <!-- Mobile Row 1: Back, Scope, and Primary Save -->
    <div class="h-12 px-3 flex items-center justify-between gap-2 border-b border-border/30">
      <div class="flex items-center gap-2 min-w-0">
        <a
          href="/admin/writer"
          class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors shrink-0"
          title="Back"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={17} />
        </a>

        <!-- Scope Switcher -->
        <div class="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg text-xs shrink-0">
          <button
            onclick={() => { scope = 'room'; markDirty(); }}
            class="px-2 py-0.5 rounded-md transition-all duration-150 {scope === 'room' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground'}"
          >
            Room
          </button>
          <button
            onclick={() => { scope = 'exodus'; markDirty(); }}
            class="px-2 py-0.5 rounded-md transition-all duration-150 {scope === 'exodus' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground'}"
          >
            Website
          </button>
        </div>

        {#if scope === 'exodus'}
          <div class="w-24 shrink-0">
            <Dropdown
              compact={true}
              options={docTypeOptions}
              bind:value={docType}
              onchange={markDirty}
            />
          </div>
        {/if}

        {#if hasUnsavedChanges}
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved changes"></span>
        {/if}
      </div>

      <!-- Save Button -->
      <button
        onclick={savePost}
        disabled={isSaving}
        class="btn-base btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1 shrink-0"
      >
        <HugeiconsIcon icon={FloppyDiskIcon} size={13} />
        <span>{isSaving ? '...' : 'Save'}</span>
      </button>
    </div>

    <!-- Mobile Row 2: Mode Toggle & Action Tools -->
    <div class="h-10 px-3 flex items-center justify-between gap-2 bg-card/60 backdrop-blur-xs">
      <!-- Mode Toggle -->
      <div class="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg text-xs">
        <button
          onclick={() => (editorMode = 'write')}
          class="px-2.5 py-0.5 rounded-md transition-colors {editorMode === 'write' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground'}"
        >
          Write
        </button>
        <button
          onclick={() => (editorMode = 'preview')}
          class="px-2.5 py-0.5 rounded-md transition-colors {editorMode === 'preview' ? 'bg-card text-foreground shadow-xs font-medium' : 'text-muted-foreground'}"
        >
          Preview
        </button>
      </div>

      <!-- Action Tools -->
      <div class="flex items-center gap-0.5">
        <button
          onclick={() => (showOutlineModal = true)}
          class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
          title="Outline assistant"
        >
          <HugeiconsIcon icon={SparklesIcon} size={16} />
        </button>

        {#if scope === 'room' && id !== 'new'}
          <button
            onclick={() => (showHistoryDrawer = true)}
            class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
            title="Revisions"
          >
            <HugeiconsIcon icon={Time04Icon} size={16} />
          </button>
        {/if}

        <button
          onclick={() => (showSettingsDrawer = true)}
          class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors"
          title="Settings"
        >
          <HugeiconsIcon icon={Settings02Icon} size={16} />
        </button>

        {#if id !== 'new'}
          <button
            onclick={deleteCurrentPost}
            class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Delete"
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </button>
        {/if}
      </div>
    </div>
  </header>

  <!-- Formatting Toolbar (Icon-only with Hugeicons) -->
  {#if editorMode !== 'preview'}
    <div class="h-9 border-b border-border/40 px-3 sm:px-4 flex items-center justify-between text-xs text-muted-foreground shrink-0 bg-card gap-2 overflow-hidden">
      <div class="flex items-center gap-0.5 overflow-x-auto no-scrollbar scroll-smooth min-w-0 pr-1">
        <button onclick={() => insertFormatting('## ')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Heading">
          <HugeiconsIcon icon={Heading01Icon} size={15} />
        </button>
        <button onclick={() => insertFormatting('**', '**')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Bold">
          <HugeiconsIcon icon={TextBoldIcon} size={15} />
        </button>
        <button onclick={() => insertFormatting('*', '*')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Italic">
          <HugeiconsIcon icon={TextItalicIcon} size={15} />
        </button>
        <button onclick={() => insertFormatting('`', '`')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Inline code">
          <HugeiconsIcon icon={CodeIcon} size={15} />
        </button>
        <button onclick={() => insertFormatting('> ')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Quote">
          <HugeiconsIcon icon={QuoteDownIcon} size={15} />
        </button>
        <button onclick={() => insertFormatting('- ')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Bullet list">
          <HugeiconsIcon icon={ListViewIcon} size={15} />
        </button>
        <button onclick={() => insertFormatting('1. ')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Numbered list">
          <HugeiconsIcon icon={ListOrderedIcon} size={15} />
        </button>
        <button onclick={() => insertFormatting('[', '](url)')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Link">
          <HugeiconsIcon icon={Link01Icon} size={15} />
        </button>
        <button onclick={() => insertFormatting('\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n')} class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors" title="Table">
          <HugeiconsIcon icon={TableIcon} size={15} />
        </button>

        <label class="p-1.5 sm:p-1 shrink-0 hover:text-foreground hover:bg-muted/50 rounded transition-colors cursor-pointer inline-flex items-center" title="Upload image">
          <input
            type="file"
            accept="image/*,video/*"
            class="hidden"
            onchange={(e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files && files[0]) uploadMedia(files[0], false);
            }}
          />
          <HugeiconsIcon icon={Image01Icon} size={15} />
        </label>
      </div>

      <div class="text-[11px] sm:text-xs font-sans text-muted-foreground/70 shrink-0 whitespace-nowrap pl-2 border-l border-border/30 sm:border-0">
        {wordCount}w · {readingTimeMin}m
      </div>
    </div>
  {/if}

  <!-- Writing Canvas / Split View (OpenRunde for text, Quadrant for title, pure bg-card) -->
  <main class="flex-1 min-h-0 flex overflow-hidden bg-card">
    <!-- Editor Pane -->
    {#if editorMode !== 'preview'}
      <div class="{editorMode === 'split' ? 'w-full sm:w-1/2 sm:border-r border-border/40' : 'w-full max-w-3xl mx-auto'} flex flex-col h-full bg-card overflow-hidden p-4 sm:p-8">
        <!-- Title input with Quadrant font -->
        <input
          type="text"
          bind:value={title}
          oninput={markDirty}
          placeholder="Title"
          class="w-full bg-transparent text-2xl sm:text-3xl font-serif font-normal text-foreground placeholder:text-muted-foreground/30 focus:outline-none border-0 px-0 pb-4 mb-2 shrink-0"
        />

        <!-- Body content with OpenRunde font (NOT mono) -->
        <textarea
          bind:this={textareaEl}
          bind:value={content}
          oninput={markDirty}
          onpaste={handlePaste}
          ondrop={handleDrop}
          ondragover={handleDragOver}
          placeholder="Start writing..."
          class="flex-1 w-full bg-transparent text-[15px] font-sans text-foreground leading-relaxed resize-none focus:outline-none overflow-y-auto"
        ></textarea>
      </div>
    {/if}

    <!-- Preview Pane -->
    {#if editorMode !== 'write'}
      <div class="{editorMode === 'split' ? 'hidden sm:block sm:w-1/2' : 'w-full max-w-3xl mx-auto'} h-full overflow-y-auto p-4 sm:p-8 bg-card">
        <div class="pb-4 mb-6 border-b border-border/40">
          <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">
            {title || 'Untitled'}
          </h1>
          {#if excerpt}
            <p class="text-sm font-sans text-muted-foreground mt-2 leading-relaxed">
              {excerpt}
            </p>
          {/if}
          {#if image}
            <div class="mt-4 rounded-lg overflow-hidden border border-border/50 max-h-60">
              <img src={image} alt="" class="w-full h-full object-cover" />
            </div>
          {/if}
        </div>

        <div class="prose prose-neutral dark:prose-invert max-w-none text-sm font-sans leading-relaxed prose-headings:font-serif prose-headings:font-normal prose-headings:tracking-tight prose-a:text-primary">
          {@html renderedHtml}
        </div>
      </div>
    {/if}
  </main>
</div>

<!-- Settings Drawer / Mobile Bottom Sheet -->
{#if showSettingsDrawer}
  <div class="fixed inset-0 z-50 flex flex-col justify-end md:flex-row md:justify-end bg-black/40 backdrop-blur-xs">
    <!-- Clickable backdrop -->
    <button
      type="button"
      class="fixed inset-0 bg-transparent -z-10 cursor-default"
      onclick={() => (showSettingsDrawer = false)}
      aria-label="Close settings"
    ></button>

    <div class="w-full max-w-sm sm:max-w-md bg-card border-t md:border-t-0 md:border-l border-border rounded-t-2xl md:rounded-none h-[90dvh] md:h-dvh max-h-dvh flex flex-col overflow-hidden font-sans shadow-2xl">
      <!-- Fixed Header -->
      <div class="px-5 pt-4 pb-3 border-b border-border/50 shrink-0 bg-card">
        <!-- Mobile grab handle -->
        <div class="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto -mt-1 mb-2 md:hidden"></div>
        <div class="flex items-center justify-between">
          <h2 class="text-base font-serif font-normal text-foreground">Settings</h2>
          <button onclick={() => (showSettingsDrawer = false)} class="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
      </div>

      <!-- Scrollable Form Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5 font-sans">

      <!-- Slug -->
      <div class="space-y-1">
        <label for="post-slug-input" class="text-xs text-muted-foreground font-sans">Slug</label>
        <input
          id="post-slug-input"
          type="text"
          bind:value={slug}
          oninput={markDirty}
          placeholder="auto-generated"
          class="w-full px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
        />
      </div>

      <!-- Author -->
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground font-sans">Author</label>
        <div class="flex items-center gap-2">
          <div class="w-36">
            <Dropdown
              value={author}
              options={authorOptions}
              placeholder="Select author"
              compact={true}
              onchange={(val: string) => { author = val; markDirty(); }}
            />
          </div>
          <input
            type="text"
            bind:value={author}
            oninput={markDirty}
            placeholder="Custom author..."
            class="flex-1 px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
          />
        </div>
      </div>

      <!-- Category -->
      <div class="space-y-1">
        <label for="post-category-input" class="text-xs text-muted-foreground font-sans">Category</label>
        <input
          id="post-category-input"
          type="text"
          bind:value={category}
          oninput={markDirty}
          placeholder="General"
          class="w-full px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
        />
      </div>

      <!-- Date -->
      <div class="space-y-1">
        <label for="post-date-input" class="text-xs text-muted-foreground font-sans">Date</label>
        <input
          id="post-date-input"
          type="date"
          bind:value={date}
          oninput={markDirty}
          class="w-full px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
        />
      </div>

      <!-- Excerpt -->
      <div class="space-y-1">
        <label for="post-excerpt-input" class="text-xs text-muted-foreground font-sans">Excerpt</label>
        <textarea
          id="post-excerpt-input"
          bind:value={excerpt}
          oninput={markDirty}
          rows="3"
          placeholder="Short description..."
          class="w-full px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground resize-none focus:outline-none focus:border-foreground/40"
        ></textarea>
      </div>

      <!-- Cover Image (with live preview and remove option) -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label for="post-image-input" class="text-xs text-muted-foreground font-sans">Cover image</label>
          {#if image}
            <button
              type="button"
              onclick={() => { image = ''; markDirty(); }}
              class="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Remove
            </button>
          {/if}
        </div>

        {#if image}
          <div class="relative w-full h-28 rounded-lg overflow-hidden border border-border/60 bg-muted/30">
            <img src={image} alt="Cover preview" class="w-full h-full object-cover" />
          </div>
        {/if}

        <div class="flex items-center gap-2">
          <input
            id="post-image-input"
            type="text"
            bind:value={image}
            oninput={markDirty}
            placeholder="https://..."
            class="flex-1 px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
          />
          <label class="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg cursor-pointer shrink-0">
            <input
              type="file"
              accept="image/*"
              class="hidden"
              onchange={(e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files[0]) uploadMedia(files[0], true);
              }}
            />
            <span>{isUploadingCover ? '...' : 'Upload'}</span>
          </label>
        </div>
      </div>

      <!-- Custom Frontmatter Fields -->
      <div class="pt-2 border-t border-border/50 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground font-sans">Frontmatter fields</span>
          <button
            type="button"
            onclick={addCustomField}
            class="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <HugeiconsIcon icon={Add01Icon} size={13} />
            <span>Add field</span>
          </button>
        </div>

        {#if customFields.length > 0}
          <div class="space-y-2">
            {#each customFields as field, idx}
              <div class="flex items-center gap-1.5">
                <input
                  type="text"
                  bind:value={field.key}
                  oninput={markDirty}
                  placeholder="key"
                  class="w-2/5 px-2.5 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                />
                <input
                  type="text"
                  bind:value={field.value}
                  oninput={markDirty}
                  placeholder="value"
                  class="flex-1 px-2.5 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
                />
                <button
                  type="button"
                  onclick={() => removeCustomField(idx)}
                  class="p-1 text-muted-foreground hover:text-destructive rounded transition-colors shrink-0"
                  title="Remove field"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} />
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-[11px] text-muted-foreground/60 italic">No custom frontmatter fields.</p>
        {/if}
      </div>

      <!-- Publication & Scopes -->
      <div class="pt-2 border-t border-border/50 space-y-3.5 text-xs font-sans">
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground font-sans block">Visibility</label>
          <Dropdown
            value={visibility}
            options={[
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Private' }
            ]}
            onchange={(val: string) => { visibility = val; markDirty(); }}
          />
          <p class="text-[11px] text-muted-foreground/70">
            {visibility === 'private' ? 'Private: restricted to authenticated admins and team.' : 'Public: open to all visitors.'}
          </p>
        </div>

        <div class="space-y-2 pt-2 border-t border-border/40">
          <label class="flex items-center justify-between cursor-pointer py-1">
            <div>
              <span class="text-foreground font-medium block">Draft mode</span>
              <span class="text-[11px] text-muted-foreground block">Save without publishing publicly</span>
            </div>
            <input type="checkbox" bind:checked={draft} onchange={markDirty} class="rounded border-border text-primary focus:ring-0 h-4 w-4" />
          </label>
          <label class="flex items-center justify-between cursor-pointer py-1">
            <div>
              <span class="text-foreground font-medium block">Unlisted</span>
              <span class="text-[11px] text-muted-foreground block">Hide from feed and navigation listings</span>
            </div>
            <input type="checkbox" bind:checked={hidden} onchange={markDirty} class="rounded border-border text-primary focus:ring-0 h-4 w-4" />
          </label>
        </div>
      </div>

      </div>

      <!-- Pinned Footer -->
      <div class="p-4 border-t border-border/50 shrink-0 bg-card/95 backdrop-blur-xs">
        <button
          onclick={() => (showSettingsDrawer = false)}
          class="w-full btn-base btn-primary text-xs py-2"
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- History Drawer / Mobile Bottom Sheet -->
{#if showHistoryDrawer}
  <div class="fixed inset-0 z-50 flex flex-col justify-end md:flex-row md:justify-end bg-black/40 backdrop-blur-xs">
    <!-- Clickable backdrop -->
    <button
      type="button"
      class="fixed inset-0 bg-transparent -z-10 cursor-default"
      onclick={() => (showHistoryDrawer = false)}
      aria-label="Close revisions"
    ></button>

    <div class="w-full md:max-w-lg bg-card border-t md:border-t-0 md:border-l border-border rounded-t-2xl md:rounded-none h-[90dvh] md:h-dvh max-h-dvh flex flex-col p-5 sm:p-6 overflow-hidden font-sans shadow-2xl">
      <!-- Mobile grab handle -->
      <div class="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto -mt-2 mb-1 md:hidden"></div>

      <div class="flex items-center justify-between pb-3 border-b border-border/50 shrink-0">
        <h2 class="text-base font-serif font-normal text-foreground">Revisions</h2>
        <button onclick={() => (showHistoryDrawer = false)} class="p-1 text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      {#if selectedVersion}
        <div class="flex-1 min-h-0 flex flex-col py-3 overflow-hidden text-xs">
          <div class="flex items-center justify-between pb-2 mb-2 border-b border-border/50 shrink-0">
            <button onclick={() => (selectedVersion = null)} class="text-muted-foreground hover:text-foreground font-medium">
              &larr; Revisions
            </button>
            <div class="flex items-center gap-2">
              <span class="text-emerald-500 font-mono">+{diffStats.additions}</span>
              <span class="text-rose-500 font-mono">-{diffStats.deletions}</span>
              <button onclick={() => restoreVersion(selectedVersion)} class="btn-base btn-primary text-xs px-2.5 py-1">
                Restore
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto font-mono text-xs p-3 bg-muted/20 border border-border/50 rounded-lg space-y-0.5">
            {#each diffResults as line}
              <div class="px-1.5 py-0.5 rounded {line.type === 'added' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : line.type === 'removed' ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 line-through' : 'text-muted-foreground'}">
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}{line.text}
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto py-3 divide-y divide-border/40 text-xs">
          {#each versions as v}
            <div class="py-2.5 flex items-center justify-between gap-3">
              <div>
                <div class="font-medium text-foreground">
                  {new Date(v.version_saved_at || v.updated_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
                <div class="text-[11px] text-muted-foreground mt-0.5">
                  {v.saved_by_display_name || v.saved_by_name || 'Admin'}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button onclick={() => compareWithVersion(v)} class="text-muted-foreground hover:text-foreground font-medium">
                  Diff
                </button>
                <button onclick={() => restoreVersion(v)} class="text-primary hover:underline font-medium">
                  Restore
                </button>
              </div>
            </div>
          {/each}

          {#if versions.length === 0}
            <div class="py-12 text-center text-muted-foreground">
              No revisions recorded yet.
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Outline Modal / Mobile Bottom Sheet -->
{#if showOutlineModal}
  <div class="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row sm:items-center sm:justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
    <!-- Clickable backdrop -->
    <button
      type="button"
      class="fixed inset-0 bg-transparent -z-10 cursor-default"
      onclick={() => (showOutlineModal = false)}
      aria-label="Close outline assistant"
    ></button>

    <div class="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-xl p-5 space-y-4 font-sans shadow-2xl max-h-[85vh] overflow-y-auto">
      <!-- Mobile grab handle -->
      <div class="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto -mt-2 mb-1 sm:hidden"></div>

      <div class="flex items-center justify-between border-b border-border/50 pb-2.5 shrink-0">
        <h3 class="text-sm font-serif font-normal text-foreground">Outline Helper</h3>
        <button onclick={() => (showOutlineModal = false)} class="p-1 text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={Cancel01Icon} size={15} />
        </button>
      </div>

      <div class="space-y-1">
        <label for="outline-topic-input" class="text-xs text-muted-foreground font-sans">Topic</label>
        <input
          id="outline-topic-input"
          type="text"
          bind:value={outlineTopic}
          placeholder="e.g. Distributed Consensus in Raft"
          class="w-full px-3 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-sans text-foreground focus:outline-none focus:border-foreground/40"
        />
      </div>

      <div class="flex justify-end">
        <button
          onclick={generateOutline}
          disabled={isGeneratingOutline || !outlineTopic.trim()}
          class="btn-base btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
        >
          {isGeneratingOutline ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {#if generatedOutline}
        <div class="p-3 rounded-lg bg-muted/20 border border-border/50 text-xs max-h-56 overflow-y-auto font-sans text-foreground leading-relaxed whitespace-pre-wrap">
          {generatedOutline}
        </div>

        <div class="flex justify-end pt-2">
          <button onclick={insertGeneratedOutline} class="btn-base btn-primary text-xs px-3 py-1.5">
            Insert
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
