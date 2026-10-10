<svelte:head>
  <title>Assets — Writer</title>
</svelte:head>

<script lang="ts">
  import { addToast } from '$lib/stores/toast';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Upload01Icon,
    ArrowLeft02Icon,
    Copy01Icon,
    FloppyDiskIcon,
    Image01Icon
  } from '@hugeicons/core-free-icons';

  let { data }: { data: { post: any | null; recentPosts: any[] } } = $props();

  let post = $state(data.post);
  let content = $state(post?.content || '');
  let coverImage = $state(post?.metadata?.image || '');
  let isSaving = $state(false);

  let uploadedImages = $state<{ url: string; name: string; size?: number }[]>([]);
  let isDragging = $state(false);
  let isUploading = $state(false);

  // Markdown headings for quick insertion
  let headings = $derived.by(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const result: { level: number; text: string; raw: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        result.push({ level: 1, text: trimmed.substring(2).trim(), raw: line });
      } else if (trimmed.startsWith('## ')) {
        result.push({ level: 2, text: trimmed.substring(3).trim(), raw: line });
      } else if (trimmed.startsWith('### ')) {
        result.push({ level: 3, text: trimmed.substring(4).trim(), raw: line });
      }
    }
    return result;
  });

  async function handleFileUpload(files: FileList | null) {
    if (!files || !files.length) return;
    isUploading = true;

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });
        const result = (await res.json()) as any;
        if (!res.ok || !result.url) throw new Error(result.error || 'Upload failed');

        uploadedImages = [{ url: result.url, name: file.name, size: file.size }, ...uploadedImages];
        addToast(`Uploaded ${file.name}`, 'success');
      }
    } catch (err: any) {
      addToast(err.message || 'Error uploading file', 'error');
    } finally {
      isUploading = false;
    }
  }

  function insertUnderHeading(imgUrl: string, heading: { raw: string; text: string }) {
    if (!post) {
      navigator.clipboard.writeText(`![Image](${imgUrl})`);
      addToast('Copied to clipboard', 'info');
      return;
    }

    const lines = content.split('\n');
    const idx = lines.findIndex((l) => l.trim() === heading.raw.trim());
    if (idx !== -1) {
      lines.splice(idx + 1, 0, '', `![${heading.text}](${imgUrl})`, '');
      content = lines.join('\n');
      saveChanges();
    }
  }

  function setAsCover(imgUrl: string) {
    coverImage = imgUrl;
    if (post) {
      saveChanges();
    } else {
      navigator.clipboard.writeText(imgUrl);
      addToast('Cover image URL copied', 'info');
    }
  }

  async function saveChanges() {
    if (!post) return;
    isSaving = true;
    try {
      const payload = {
        id: post.id,
        scope: post.scope || (post.id.startsWith('exodus:') ? 'exodus' : 'room'),
        title: post.title,
        content,
        metadata: {
          ...(post.metadata || {}),
          image: coverImage
        }
      };

      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as any;
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');

      addToast('Post updated', 'success');
    } catch (err: any) {
      addToast(err.message || 'Error updating post', 'error');
    } finally {
      isSaving = false;
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    addToast('URL copied', 'success');
  }
</script>

<div class="p-6 max-w-5xl mx-auto space-y-6 font-sans animate-in fade-in duration-300">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <a
        href="/admin/writer"
        class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        title="Back"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={18} />
      </a>
      <div>
        <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">
          Assets
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">
          {post ? `Placing assets in: ${post.title || post.slug}` : 'Upload and manage media for articles.'}
        </p>
      </div>
    </div>

    {#if post}
      <button
        onclick={saveChanges}
        disabled={isSaving}
        class="btn-base btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-1.5"
      >
        <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
        <span>{isSaving ? 'Saving...' : 'Save changes'}</span>
      </button>
    {/if}
  </div>

  <!-- Post Selector if No Post Bound -->
  {#if !post && data.recentPosts?.length}
    <div class="pt-4 border-t border-border/50 space-y-2">
      <div class="text-xs text-muted-foreground">Select an active article to place assets into:</div>
      <div class="flex flex-wrap gap-2">
        {#each data.recentPosts.slice(0, 8) as p}
          <a
            href={`/admin/writer/mcp-upload?id=${encodeURIComponent(p.id)}`}
            class="px-2.5 py-1 rounded-md border border-border/60 hover:border-foreground/30 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-xs"
          >
            {p.title || p.slug}
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Drop Zone Area -->
  <div class="pt-4 border-t border-border/50">
    <label
      ondragover={(e) => { e.preventDefault(); isDragging = true; }}
      ondragleave={() => (isDragging = false)}
      ondrop={(e) => {
        e.preventDefault();
        isDragging = false;
        handleFileUpload(e.dataTransfer?.files || null);
      }}
      class="border border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors {isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 bg-muted/20'}"
    >
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        class="hidden"
        onchange={(e) => handleFileUpload((e.target as HTMLInputElement).files)}
      />
      <HugeiconsIcon icon={Upload01Icon} size={22} class="text-muted-foreground mb-2" />
      <div class="text-sm font-medium text-foreground">
        {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
      </div>
      <p class="text-xs text-muted-foreground mt-1">
        PNG, WebP, JPG, or MP4
      </p>
    </label>
  </div>

  <!-- Uploaded Images List -->
  {#if uploadedImages.length > 0}
    <div class="pt-6 border-t border-border/50 space-y-3">
      <div class="text-xs font-medium text-foreground">Uploaded files</div>
      <div class="border-t border-border/50 divide-y divide-border/40">
        {#each uploadedImages as img}
          <div class="py-3 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-md bg-muted overflow-hidden shrink-0 border border-border/60">
                <img src={img.url} alt="" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0">
                <div class="text-xs font-medium text-foreground truncate">{img.name}</div>
                <div class="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{img.url}</div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                onclick={() => copyUrl(img.url)}
                class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="Copy URL"
              >
                <HugeiconsIcon icon={Copy01Icon} size={15} />
              </button>

              <button
                onclick={() => setAsCover(img.url)}
                class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                title="Set as cover image"
              >
                Cover
              </button>

              {#if headings.length > 0}
                <div class="flex items-center gap-1 text-xs">
                  <span class="text-muted-foreground text-[11px]">Insert under:</span>
                  {#each headings.slice(0, 3) as h}
                    <button
                      onclick={() => insertUnderHeading(img.url, h)}
                      class="px-2 py-0.5 rounded text-xs bg-muted hover:bg-foreground hover:text-background transition-colors truncate max-w-[120px]"
                      title={h.text}
                    >
                      {h.text}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
