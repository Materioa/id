<script lang="ts">
  import { smoothCorners } from '@lisse/svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    File01Icon, 
    Folder01Icon, 
    Download01Icon, 
    TrashIcon, 
    Search01Icon, 
    PlusIcon, 
    CloudUploadIcon, 
    Loading01Icon, 
    CheckmarkCircle01Icon 
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let files = $state<any[]>([]);
  let searchQuery = $state('');
  let isDragOver = $state(false);
  let isUploading = $state(false);
  let successMsg = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  const filteredFiles = $derived(
    files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function loadFiles() {
    const saved = localStorage.getItem('user_files');
    if (saved) {
      files = JSON.parse(saved);
    } else {
      // Default files if none saved
      files = [
        { id: '1', name: 'Project_Alpha_Specs.pdf', type: 'pdf', size: '2.4 MB', date: 'Oct 24, 2026' },
        { id: '2', name: 'Q3_Financial_Report.xlsx', type: 'excel', size: '1.1 MB', date: 'Oct 22, 2026' },
        { id: '3', name: 'Design_Assets.zip', type: 'archive', size: '156 MB', date: 'Oct 20, 2026' },
        { id: '4', name: 'Meeting_Notes.docx', type: 'doc', size: '124 KB', date: 'Oct 19, 2026' }
      ];
      saveToStorage();
    }
  }

  function saveToStorage() {
    localStorage.setItem('user_files', JSON.stringify(files));
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function handleFilesAdded(fileList: FileList) {
    isUploading = true;
    successMsg = '';
    
    // Simulate upload delay
    setTimeout(() => {
      const newFiles = Array.from(fileList).map((f, index) => ({
        id: Date.now().toString() + index,
        name: f.name,
        type: f.name.split('.').pop() || 'file',
        size: formatBytes(f.size),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }));
      
      files = [...newFiles, ...files];
      saveToStorage();
      isUploading = false;
      successMsg = `Uploaded ${newFiles.length} file(s) successfully!`;
    }, 1000);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    if (e.dataTransfer?.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      handleFilesAdded(input.files);
    }
  }

  function deleteFile(id: string, name: string) {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      files = files.filter(f => f.id !== id);
      saveToStorage();
    }
  }

  onMount(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      goto('/login');
      return;
    }
    loadFiles();
  });
</script>

<div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Your Files</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage and access all your documents and synced files.</p>
    </div>
    
    <button 
      onclick={() => fileInput?.click()}
      class="btn-base btn-primary"
    >
      <HugeiconsIcon icon={PlusIcon} size={16} />
      <span>Upload File</span>
    </button>
    <input type="file" bind:this={fileInput} onchange={handleFileSelect} multiple class="hidden" />
  </div>

  {#if successMsg}
    <div class="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl flex items-center gap-2 max-w-xl">
      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} class="text-green-500" />
      <span>{successMsg}</span>
    </div>
  {/if}

  <!-- Drag and Drop Upload Area (increased roundness: rounded-2xl/24px) -->
  <div 
    role="button"
    tabindex="0"
    ondragover={(e) => { e.preventDefault(); isDragOver = true; }}
    ondragleave={() => isDragOver = false}
    ondrop={handleDrop}
    onclick={() => fileInput?.click()}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); }}
    class="border-2 border-dashed rounded-[24px] p-8 text-center cursor-pointer transition-all duration-200 select-none {isDragOver ? 'border-primary bg-primary/5' : 'border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300'}"
  >
    {#if isUploading}
      <div class="flex flex-col items-center space-y-3">
        <HugeiconsIcon icon={Loading01Icon} size={36} class="animate-spin text-primary" />
        <h3 class="font-bold text-sm text-foreground">Uploading files...</h3>
        <p class="text-xs text-muted-foreground">Syncing to cloud storage, please wait</p>
      </div>
    {:else}
      <div class="flex flex-col items-center space-y-3">
        <HugeiconsIcon icon={CloudUploadIcon} size={36} class="text-zinc-400" />
        <h3 class="font-bold text-sm text-foreground">Drag & drop files here</h3>
        <p class="text-xs text-muted-foreground">or click to browse your local device (PDF, DOCX, XLSX, ZIP)</p>
      </div>
    {/if}
  </div>

  <!-- Files Explorer Panel (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-zinc-200/80 overflow-hidden shadow-sm rounded-2xl">
    <!-- Toolbar -->
    <div class="p-4 border-b border-zinc-150 flex items-center justify-between gap-4 bg-zinc-50/50">
      <div class="relative max-w-sm w-full group/search">
        <HugeiconsIcon icon={Search01Icon} size={16} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within/search:text-zinc-700 transition-colors" />
        <input 
          type="text" 
          placeholder="Search files..." 
          bind:value={searchQuery}
          class="w-full bg-background border border-border text-zinc-800 placeholder:text-zinc-400 text-sm pl-10 pr-4 py-2 outline-none focus:border-zinc-300 transition-all rounded-xl"
        />
      </div>
      <button onclick={loadFiles} class="p-2.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-xl transition-colors cursor-pointer flex items-center justify-center" title="Refresh files list">
        <HugeiconsIcon icon={Loading01Icon} size={16} />
      </button>
    </div>

    <!-- File List -->
    <div class="divide-y divide-zinc-150">
      {#each filteredFiles as file}
        <div class="flex items-center justify-between p-4 hover:bg-zinc-50/50 transition-colors group">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
              <HugeiconsIcon icon={File01Icon} size={18} />
            </div>
            <div class="overflow-hidden">
              <p class="font-medium text-sm text-zinc-800 truncate group-hover:text-primary transition-colors">{file.name}</p>
              <div class="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                <span>{file.size}</span>
                <span class="w-1 h-1 rounded-full bg-zinc-300"></span>
                <span>{file.date}</span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="p-2 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/50 rounded-xl transition-colors cursor-pointer flex items-center justify-center" title="Download file">
              <HugeiconsIcon icon={Download01Icon} size={16} />
            </button>
            <button onclick={() => deleteFile(file.id, file.name)} class="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer flex items-center justify-center" title="Delete file">
              <HugeiconsIcon icon={TrashIcon} size={16} />
            </button>
          </div>
        </div>
      {/each}
      
      {#if filteredFiles.length === 0}
        <div class="p-12 text-center select-none">
          <div class="w-16 h-16 mx-auto bg-zinc-50 border border-zinc-150 rounded-full flex items-center justify-center mb-4">
            <HugeiconsIcon icon={Folder01Icon} size={28} class="text-zinc-300" />
          </div>
          <h3 class="text-base font-semibold text-zinc-800 mb-1">No files found</h3>
          <p class="text-zinc-400 text-sm">Upload a file or connect Google Drive to get started.</p>
        </div>
      {/if}
    </div>
  </div>
</div>
