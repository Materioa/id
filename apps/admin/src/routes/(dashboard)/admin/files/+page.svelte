<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    FolderOpenIcon, Folder01Icon, File01Icon, Image01Icon, VideoReplayIcon,
    ArrowLeft01Icon, Add01Icon, Delete01Icon, FileEditIcon, Download01Icon, RefreshIcon,
    Home01Icon, ChevronRightIcon,
    ArchiveIcon, CodeIcon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';

  type FileItem = {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: string;
    download_url?: string;
  };

  let currentPath = $state('');
  let files = $state<FileItem[]>([]);
  let isLoading = $state(false);
  let errorMsg = $state('');

  let breadcrumbs = $derived(currentPath ? currentPath.split('/').filter(p => p) : []);

  async function loadFiles() {
    isLoading = true;
    errorMsg = '';
    try {
      const pathParam = currentPath ? `?path=${encodeURIComponent(currentPath)}` : '';
      const response: any = await makeAdminRequest(`cdn${pathParam}`, 'GET');
      
      if (response.type === 'directory' && response.items) {
        files = response.items;
      } else if (response.type === 'file') {
        files = [response];
      } else if (Array.isArray(response)) {
         files = response;
      } else {
        files = [];
      }
    } catch (e: any) {
      errorMsg = e.message || 'Failed to load files';
      files = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadFiles();
  });

  function navigateTo(folder: string) {
    currentPath = currentPath ? `${currentPath}/${folder}` : folder;
    loadFiles();
  }

  function navigateUp() {
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    currentPath = parts.join('/');
    loadFiles();
  }

  function navigateBreadcrumb(index: number) {
    const parts = currentPath.split('/').filter(p => p);
    currentPath = parts.slice(0, index + 1).join('/');
    loadFiles();
  }

  function navigateRoot() {
    currentPath = '';
    loadFiles();
  }

  async function createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;
    
    const folderPath = currentPath ? `${currentPath}/${name}` : name;
    try {
      await makeAdminRequest('cdn', 'POST', { path: folderPath, type: 'directory' });
      loadFiles();
    } catch (e: any) {
      addToast(`Failed to create folder: ${e.message}`, 'error');
    }
  }

  async function deleteFile(item: FileItem) {
    const isFolder = item.type === 'directory';
    const msg = isFolder 
      ? 'Are you sure you want to delete this folder and ALL its contents?' 
      : `Are you sure you want to delete ${item.name}?`;
      
    if (!confirm(msg)) return;
    
    try {
      const filePath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
      await makeAdminRequest(`cdn?path=${encodeURIComponent(filePath)}`, 'DELETE');
      loadFiles();
    } catch (e: any) {
      addToast(`Failed to delete: ${e.message}`, 'error');
    }
  }

  async function renameFile(item: FileItem) {
    const newName = prompt('Enter new name:', item.name);
    if (!newName || newName === item.name) return;
    
    try {
      const oldPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
      const newPath = currentPath ? `${currentPath}/${newName}` : newName;
      
      await makeAdminRequest('cdn', 'PUT', { oldPath, newPath });
      loadFiles();
    } catch (e: any) {
      addToast(`Failed to rename: ${e.message}`, 'error');
    }
  }

  function downloadFile(item: FileItem) {
    const url = item.download_url;
    if (!url) {
      const filePath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
      makeAdminRequest(`cdn?path=${encodeURIComponent(filePath)}`, 'GET')
        .then((res: any) => {
          if (res.download_url) {
            window.open(res.download_url, '_blank');
          } else {
            addToast('Download URL not available', 'warning');
          }
        })
        .catch(() => addToast('Failed to fetch download URL', 'error'));
      return;
    }
    window.open(url, '_blank');
  }

  function formatBytes(bytes: number) {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext!)) return Image01Icon;
    if (['mp4', 'webm', 'mov'].includes(ext!)) return VideoReplayIcon;
    if (['pdf', 'doc', 'docx', 'txt', 'csv', 'xlsx'].includes(ext!)) return File01Icon;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext!)) return ArchiveIcon;
    return File01Icon;
  }
  import Modal from '$lib/components/Modal.svelte';
  
  let viewerOpen = $state(false);
  let selectedFile = $state<FileItem | null>(null);
  let selectedFileContent = $state('');
  let isEditingText = $state(false);
  let isSavingFile = $state(false);
  let isUploadingFile = $state(false);
  let fileInputRef: HTMLInputElement | undefined = $state();

  function decodeBase64ToText(b64: string) {
    try {
      const cleanB64 = b64.replace(/\s+/g, '');
      const binString = atob(cleanB64);
      const bytes = new Uint8Array(binString.length);
      for (let i = 0; i < binString.length; i++) {
          bytes[i] = binString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch(e) {
      console.error(e);
      return "Error decoding file content.";
    }
  }

  async function openFileViewer(file: FileItem) {
    selectedFile = file;
    selectedFileContent = 'Loading...';
    isEditingText = false;
    viewerOpen = true;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['json', 'txt', 'md', 'csv', 'js', 'css', 'html'].includes(ext)) {
      isEditingText = true;
      try {
        const filePath = file.path || (currentPath ? `${currentPath}/${file.name}` : file.name);
        const res: any = await makeAdminRequest(`cdn?path=${encodeURIComponent(filePath)}`, 'GET');
        if (res.content) {
          selectedFileContent = decodeBase64ToText(res.content);
        } else {
          selectedFileContent = "Could not load content or file is empty.";
        }
      } catch(e: any) {
        selectedFileContent = "Error loading file: " + e.message;
      }
    }
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(selectedFileContent);
      selectedFileContent = JSON.stringify(parsed, null, 2);
      addToast('JSON formatted successfully', 'success');
    } catch(e) {
      addToast('Invalid JSON, cannot format', 'error');
    }
  }

  async function saveTextContent() {
    if (!selectedFile) return;
    isSavingFile = true;
    try {
      const formData = new FormData();
      const filePath = selectedFile.path || (currentPath ? `${currentPath}/${selectedFile.name}` : selectedFile.name);
      formData.append('path', filePath);
      
      const blob = new Blob([selectedFileContent], { type: 'text/plain' });
      formData.append('file', blob, selectedFile.name);
      
      await makeAdminRequest('cdn', 'POST', formData);
      addToast('File updated successfully', 'success');
      loadFiles();
    } catch (e: any) {
      addToast(`Failed to update file: ${e.message}`, 'error');
    } finally {
      isSavingFile = false;
    }
  }

  function triggerFileInput() {
    if (fileInputRef) fileInputRef.click();
  }

  async function handleFileReplace(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !selectedFile) return;
    const file = input.files[0];
    
    isUploadingFile = true;
    try {
      const formData = new FormData();
      const filePath = selectedFile.path || (currentPath ? `${currentPath}/${selectedFile.name}` : selectedFile.name);
      formData.append('path', filePath);
      formData.append('file', file);
      
      await makeAdminRequest('cdn', 'POST', formData);
      addToast('File replaced successfully', 'success');
      
      loadFiles();
      viewerOpen = false;
    } catch (err: any) {
      addToast(`Failed to replace file: ${err.message}`, 'error');
    } finally {
      isUploadingFile = false;
      input.value = '';
    }
  }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 shrink-0">
    <div>
      <h1 class="text-2xl font-bold text-foreground tracking-tight">File Management</h1>
      <p class="text-muted-foreground mt-1 text-sm">Manage files and folders in the CDN.</p>
    </div>
    <div class="flex items-center gap-2">
      <button onclick={createFolder} class="btn-base btn-secondary">
        <HugeiconsIcon icon={Add01Icon} size={16} />
        New Folder
      </button>
      <button onclick={loadFiles} class="btn-base btn-primary">
        <HugeiconsIcon icon={RefreshIcon} size={16} class={isLoading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  </div>

  <div class="flex-1 bg-transparent overflow-hidden flex flex-col mt-4 border-t border-border/50">
    <!-- Breadcrumbs -->
    <div class="bg-transparent border-b border-border/50 py-4 flex items-center gap-2 text-sm shrink-0">
      <button onclick={navigateRoot} class="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 font-medium">
        <HugeiconsIcon icon={Home01Icon} size={16} />
        Root
      </button>
      
      {#each breadcrumbs as crumb, i}
        <HugeiconsIcon icon={ChevronRightIcon} size={14} class="text-muted-foreground" />
        <button 
          onclick={() => navigateBreadcrumb(i)} 
          class="hover:text-foreground transition-colors font-medium {i === breadcrumbs.length - 1 ? 'text-foreground' : 'text-muted-foreground'}"
        >
          {crumb}
        </button>
      {/each}
    </div>

    <!-- File List -->
    <div class="flex-1 overflow-y-auto p-2">
      {#if isLoading}
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
          <HugeiconsIcon icon={RefreshIcon} size={24} class="animate-spin" />
          <p class="text-sm font-medium">Loading files...</p>
        </div>
      {:else if errorMsg}
        <div class="flex flex-col items-center justify-center h-48 text-destructive gap-2">
          <p class="text-sm font-medium">{errorMsg}</p>
          <button onclick={loadFiles} class="text-xs underline hover:text-destructive/80">Try again</button>
        </div>
      {:else if files.length === 0}
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
          <HugeiconsIcon icon={FolderOpenIcon} size={32} class="opacity-50" />
          <p class="text-sm font-medium">This folder is empty</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <!-- Back button if not at root -->
          {#if currentPath !== ''}
            <div 
              class="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent"
              onclick={navigateUp}
              onkeydown={(e) => e.key === 'Enter' && navigateUp()}
              role="button"
              tabindex="0"
            >
              <div class="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground shrink-0">
                <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
              </div>
              <span class="font-medium text-sm text-foreground">.. (Up a level)</span>
            </div>
          {/if}

          {#each files as file}
            <div class="group flex items-center justify-between py-3 px-2 hover:bg-muted/30 transition-colors border-b border-border/50">
              <div 
                class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" 
                onclick={() => file.type === 'directory' ? navigateTo(file.name) : openFileViewer(file)}
                onkeydown={(e) => e.key === 'Enter' ? (file.type === 'directory' ? navigateTo(file.name) : openFileViewer(file)) : null}
                role="button"
                tabindex="0"
              >
                <div class="h-10 w-10 rounded-lg {file.type === 'directory' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'} flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={file.type === 'directory' ? Folder01Icon : getFileIcon(file.name)} size={20} />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-foreground truncate" title={file.name}>{file.name}</p>
                  {#if file.type === 'file' && file.size}
                    <p class="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  {/if}
                </div>
              </div>
              
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {#if file.type === 'file'}
                  <button onclick={() => downloadFile(file)} class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background transition-colors" title="Download">
                    <HugeiconsIcon icon={Download01Icon} size={16} />
                  </button>
                {/if}
                <button onclick={() => renameFile(file)} class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background transition-colors" title="Rename">
                  <HugeiconsIcon icon={FileEditIcon} size={16} />
                </button>
                <button onclick={() => deleteFile(file)} class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                  <HugeiconsIcon icon={Delete01Icon} size={16} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- File Viewer Modal -->
<Modal bind:isOpen={viewerOpen} title={selectedFile?.name || 'File Viewer'} maxWidthClass={isEditingText ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}>
  <div class="flex flex-col gap-4">
    {#if selectedFile}
      <div class="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border/50">
        <div>
          <p class="text-sm font-medium text-foreground">{selectedFile.name}</p>
          <p class="text-xs text-muted-foreground">{formatBytes(selectedFile.size || 0)}</p>
        </div>
        <div class="flex items-center gap-2">
          {#if isEditingText}
            {#if selectedFile.name.endsWith('.json')}
              <button class="btn-base btn-secondary" onclick={formatJson}>
                <HugeiconsIcon icon={CodeIcon} size={16} />
                Format JSON
              </button>
            {/if}
            <button class="btn-base btn-primary" onclick={saveTextContent} disabled={isSavingFile}>
              {#if isSavingFile}
                <HugeiconsIcon icon={RefreshIcon} size={16} class="animate-spin" />
              {:else}
                <HugeiconsIcon icon={FileEditIcon} size={16} />
              {/if}
              Save Changes
            </button>
          {/if}
          <button class="btn-base btn-secondary" onclick={triggerFileInput} disabled={isUploadingFile}>
            {#if isUploadingFile}
              <HugeiconsIcon icon={RefreshIcon} size={16} class="animate-spin" />
            {:else}
              <HugeiconsIcon icon={Add01Icon} size={16} />
            {/if}
            Replace File
          </button>
          {#if selectedFile.download_url}
            <a href={selectedFile.download_url} target="_blank" class="btn-base btn-secondary" title="Download">
              <HugeiconsIcon icon={Download01Icon} size={16} />
            </a>
          {/if}
        </div>
      </div>

      <div class="min-h-[300px] border border-border/50 rounded-lg overflow-hidden bg-background">
        {#if isEditingText}
          <textarea 
            class="w-full h-[500px] p-4 bg-background text-foreground font-mono text-sm resize-y focus:outline-none" 
            bind:value={selectedFileContent}
          ></textarea>
        {:else if ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(selectedFile.name.split('.').pop()?.toLowerCase() || '')}
          <img src={selectedFile.download_url} alt={selectedFile.name} class="w-full h-auto object-contain max-h-[60vh]" />
        {:else if ['pdf'].includes(selectedFile.name.split('.').pop()?.toLowerCase() || '')}
          <iframe src={selectedFile.download_url} class="w-full h-[60vh]" title={selectedFile.name}></iframe>
        {:else}
          <div class="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3">
            <HugeiconsIcon icon={File01Icon} size={48} class="opacity-50" />
            <p class="text-sm font-medium">No preview available</p>
            <p class="text-xs">You can still replace or download this file.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Modal>

<input 
  type="file" 
  bind:this={fileInputRef} 
  onchange={handleFileReplace} 
  class="hidden" 
/>
