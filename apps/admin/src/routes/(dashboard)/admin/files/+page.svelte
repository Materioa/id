<svelte:head>
  <title>Files</title>
</svelte:head>

<script lang="ts">
  import { makeAdminRequest } from "$lib/api/admin";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    FolderOpenIcon,
    Folder01Icon,
    File01Icon,
    Image01Icon,
    VideoReplayIcon,
    ArrowLeft01Icon,
    Add01Icon,
    Delete01Icon,
    Delete02Icon,
    FileEditIcon,
    Download01Icon,
    RefreshIcon,
    Home01Icon,
    ChevronRightIcon,
    ArchiveIcon,
    CodeIcon,
    AiSwapIcon,
    WandSparklesIcon,
    Tick02Icon,
    Cancel01Icon,
  } from "@hugeicons/core-free-icons";
  import { onMount } from "svelte";
  import { addToast } from "$lib/stores/toast";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import Modal from "$lib/components/Modal.svelte";

  type FileItem = {
    name: string;
    path: string;
    type: "file" | "directory";
    size?: number;
    modified?: string;
    download_url?: string;
  };

  let currentPath = $state("");
  let files = $state<FileItem[]>([]);
  let isLoading = $state(false);
  let errorMsg = $state("");

  let breadcrumbs = $derived(
    currentPath ? currentPath.split("/").filter((p) => p) : [],
  );

  async function loadFiles() {
    isLoading = true;
    errorMsg = "";
    try {
      const pathParam = currentPath
        ? `?path=${encodeURIComponent(currentPath)}`
        : "";
      const response: any = await makeAdminRequest(`cdn${pathParam}`, "GET");

      if (response.type === "directory" && response.items) {
        files = response.items;
      } else if (response.type === "file") {
        files = [response];
      } else if (Array.isArray(response)) {
        files = response;
      } else {
        files = [];
      }
    } catch (e: any) {
      errorMsg = e.message || "Failed to load files";
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
    const parts = currentPath.split("/").filter((p) => p);
    parts.pop();
    currentPath = parts.join("/");
    loadFiles();
  }

  function navigateBreadcrumb(index: number) {
    const parts = currentPath.split("/").filter((p) => p);
    currentPath = parts.slice(0, index + 1).join("/");
    loadFiles();
  }

  function navigateRoot() {
    currentPath = "";
    loadFiles();
  }

  // Create folder modal state
  let isCreateFolderOpen = $state(false);
  let newFolderName = $state("");
  let isCreatingFolder = $state(false);

  function openCreateFolder() {
    newFolderName = "";
    isCreateFolderOpen = true;
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;

    isCreatingFolder = true;
    const folderPath = currentPath ? `${currentPath}/${name}` : name;
    try {
      await makeAdminRequest("cdn", "POST", {
        path: folderPath,
        type: "directory",
      });
      isCreateFolderOpen = false;
      newFolderName = "";
      loadFiles();
      addToast("Folder created successfully", "success");
    } catch (e: any) {
      addToast(`Failed to create folder: ${e.message}`, "error");
    } finally {
      isCreatingFolder = false;
    }
  }

  async function deleteFile(item: FileItem) {
    const isFolder = item.type === "directory";
    const msg = isFolder
      ? `Are you sure you want to delete "${item.name}" and ALL its contents? Any references of these files will also be removed.`
      : `Are you sure you want to delete ${item.name}?`;

    confirmTitle = isFolder ? "Delete Folder" : "Delete File";
    confirmMessage = msg;
    onConfirmAction = async () => {
      try {
        const filePath =
          item.path ||
          (currentPath ? `${currentPath}/${item.name}` : item.name);
        await makeAdminRequest(
          `cdn?path=${encodeURIComponent(filePath)}`,
          "DELETE",
        );
        loadFiles();
        addToast(
          `${isFolder ? "Folder" : "File"} deleted successfully`,
          "success",
        );
      } catch (e: any) {
        addToast(`Failed to delete: ${e.message}`, "error");
      }
    };
    isConfirmOpen = true;
  }

  // Rename modal state
  let isRenameOpen = $state(false);
  let renamingItem = $state<FileItem | null>(null);
  let renameValue = $state("");
  let isRenaming = $state(false);

  function openRenameModal(item: FileItem) {
    renamingItem = item;
    renameValue = item.name;
    isRenameOpen = true;
  }

  async function handleRenameSubmit() {
    if (!renamingItem) return;
    const newName = renameValue.trim();
    if (!newName || newName === renamingItem.name) {
      isRenameOpen = false;
      return;
    }

    isRenaming = true;
    try {
      const oldPath =
        renamingItem.path ||
        (currentPath
          ? `${currentPath}/${renamingItem.name}`
          : renamingItem.name);
      const newPath = currentPath ? `${currentPath}/${newName}` : newName;

      await makeAdminRequest("cdn", "PUT", { oldPath, newPath });
      isRenameOpen = false;
      renamingItem = null;
      loadFiles();
      addToast("Renamed successfully", "success");
    } catch (e: any) {
      addToast(`Failed to rename: ${e.message}`, "error");
    } finally {
      isRenaming = false;
    }
  }

  function downloadFile(item: FileItem) {
    const url = item.download_url;
    if (!url) {
      const filePath =
        item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
      makeAdminRequest(`cdn?path=${encodeURIComponent(filePath)}`, "GET")
        .then((res: any) => {
          if (res.download_url) {
            window.open(res.download_url, "_blank");
          } else {
            addToast("Download URL not available", "warning");
          }
        })
        .catch(() => addToast("Failed to fetch download URL", "error"));
      return;
    }
    window.open(url, "_blank");
  }

  function formatBytes(bytes: number) {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function getFileIcon(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext!))
      return Image01Icon;
    if (["mp4", "webm", "mov"].includes(ext!)) return VideoReplayIcon;
    if (["pdf", "doc", "docx", "txt", "csv", "xlsx"].includes(ext!))
      return File01Icon;
    if (["zip", "rar", "tar", "gz"].includes(ext!)) return ArchiveIcon;
    return File01Icon;
  }

  let viewerOpen = $state(false);
  let selectedFile = $state<FileItem | null>(null);
  let selectedFileContent = $state("");

  // Modal inline rename state
  let isRenamingInModal = $state(false);
  let modalRenameValue = $state("");
  let isSavingRenameInModal = $state(false);

  function startRenameInModal() {
    if (!selectedFile) return;
    modalRenameValue = selectedFile.name;
    isRenamingInModal = true;
  }

  function cancelRenameInModal() {
    isRenamingInModal = false;
    modalRenameValue = "";
  }

  async function saveModalRename() {
    if (!selectedFile) return;
    const newName = modalRenameValue.trim();
    if (!newName || newName === selectedFile.name) {
      isRenamingInModal = false;
      return;
    }

    isSavingRenameInModal = true;
    try {
      const oldPath =
        selectedFile.path ||
        (currentPath
          ? `${currentPath}/${selectedFile.name}`
          : selectedFile.name);
      const newPath = currentPath ? `${currentPath}/${newName}` : newName;

      await makeAdminRequest("cdn", "PUT", { oldPath, newPath });
      selectedFile.name = newName;
      selectedFile.path = newPath;
      isRenamingInModal = false;
      loadFiles();
      addToast("Renamed successfully", "success");
    } catch (e: any) {
      addToast(`Failed to rename: ${e.message}`, "error");
    } finally {
      isSavingRenameInModal = false;
    }
  }

  function handleModalRenameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveModalRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRenameInModal();
    }
  }

  function deleteFileFromModal(item: FileItem) {
    confirmTitle = "Delete File";
    confirmMessage = `Are you sure you want to delete ${item.name}?`;
    onConfirmAction = async () => {
      try {
        const filePath =
          item.path ||
          (currentPath ? `${currentPath}/${item.name}` : item.name);
        await makeAdminRequest(
          `cdn?path=${encodeURIComponent(filePath)}`,
          "DELETE",
        );
        viewerOpen = false;
        loadFiles();
        addToast("File deleted successfully", "success");
      } catch (e: any) {
        addToast(`Failed to delete: ${e.message}`, "error");
      }
    };
    isConfirmOpen = true;
  }

  // Confirm Modal state
  let isConfirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmMessage = $state("");
  let onConfirmAction = $state<() => void>(() => {});

  let isEditingText = $state(false);
  let isSavingFile = $state(false);
  let isUploadingFile = $state(false);
  let fileInputRef: HTMLInputElement | undefined = $state();

  function decodeBase64ToText(b64: string) {
    try {
      const cleanB64 = b64.replace(/\s+/g, "");
      const binString = atob(cleanB64);
      const bytes = new Uint8Array(binString.length);
      for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (e) {
      console.error(e);
      return "Error decoding file content.";
    }
  }

  async function openFileViewer(file: FileItem) {
    selectedFile = file;
    isRenamingInModal = false;
    modalRenameValue = "";
    selectedFileContent = "Loading...";
    isEditingText = false;
    viewerOpen = true;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (["json", "txt", "md", "csv", "js", "css", "html"].includes(ext)) {
      isEditingText = true;
      try {
        const filePath =
          file.path ||
          (currentPath ? `${currentPath}/${file.name}` : file.name);
        const res: any = await makeAdminRequest(
          `cdn?path=${encodeURIComponent(filePath)}`,
          "GET",
        );
        if (res.content) {
          selectedFileContent = decodeBase64ToText(res.content);
        } else {
          selectedFileContent = "Could not load content or file is empty.";
        }
      } catch (e: any) {
        selectedFileContent = "Error loading file: " + e.message;
      }
    }
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(selectedFileContent);
      selectedFileContent = JSON.stringify(parsed, null, 2);
      addToast("JSON formatted successfully", "success");
    } catch (e) {
      addToast("Invalid JSON, cannot format", "error");
    }
  }

  async function saveTextContent() {
    if (!selectedFile) return;
    isSavingFile = true;
    try {
      const formData = new FormData();
      const filePath =
        selectedFile.path ||
        (currentPath
          ? `${currentPath}/${selectedFile.name}`
          : selectedFile.name);
      formData.append("path", filePath);

      const blob = new Blob([selectedFileContent], { type: "text/plain" });
      formData.append("file", blob, selectedFile.name);

      await makeAdminRequest("cdn", "POST", formData);
      addToast("File updated successfully", "success");
      loadFiles();
    } catch (e: any) {
      addToast(`Failed to update file: ${e.message}`, "error");
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
      const filePath =
        selectedFile.path ||
        (currentPath
          ? `${currentPath}/${selectedFile.name}`
          : selectedFile.name);
      formData.append("path", filePath);
      formData.append("file", file);

      await makeAdminRequest("cdn", "POST", formData);
      addToast("File replaced successfully", "success");

      loadFiles();
      viewerOpen = false;
    } catch (err: any) {
      addToast(`Failed to replace file: ${err.message}`, "error");
    } finally {
      isUploadingFile = false;
      input.value = "";
    }
  }
</script>

<div
  class="p-6 h-full flex flex-col min-w-0 max-w-[1600px] mx-auto animate-in fade-in duration-300"
>
  <ConfirmModal
    bind:isOpen={isConfirmOpen}
    title={confirmTitle}
    message={confirmMessage}
    onConfirm={onConfirmAction}
    confirmText="Delete"
  />

  <!-- Rename Modal -->
  <Modal
    bind:isOpen={isRenameOpen}
    title={renamingItem?.type === "directory" ? "Rename folder" : "Rename file"}
    maxWidthClass="sm:max-w-md"
  >
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleRenameSubmit();
      }}
      class="flex flex-col gap-4"
    >
      <div class="flex flex-col gap-1.5">
        <label
          for="rename-input"
          class="text-xs font-medium text-muted-foreground">New name</label
        >
        <input
          id="rename-input"
          type="text"
          bind:value={renameValue}
          placeholder="Enter new name"
          class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          required
        />
      </div>

      <div
        class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40"
      >
        <button
          type="button"
          onclick={() => {
            isRenameOpen = false;
          }}
          class="btn-base btn-secondary"
          disabled={isRenaming}
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn-base btn-primary"
          disabled={isRenaming ||
            !renameValue.trim() ||
            renameValue.trim() === renamingItem?.name}
        >
          {#if isRenaming}
            <HugeiconsIcon icon={RefreshIcon} size={16} class="animate-spin" />
          {/if}
          Rename
        </button>
      </div>
    </form>
  </Modal>

  <!-- Create Folder Modal -->
  <Modal
    bind:isOpen={isCreateFolderOpen}
    title="New folder"
    maxWidthClass="sm:max-w-md"
  >
    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleCreateFolder();
      }}
      class="flex flex-col gap-4"
    >
      <div class="flex flex-col gap-1.5">
        <label
          for="folder-name-input"
          class="text-xs font-medium text-muted-foreground">Folder name</label
        >
        <input
          id="folder-name-input"
          type="text"
          bind:value={newFolderName}
          placeholder="e.g. icons, banners, documents"
          class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          required
        />
      </div>

      <div
        class="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40"
      >
        <button
          type="button"
          onclick={() => {
            isCreateFolderOpen = false;
          }}
          class="btn-base btn-secondary"
          disabled={isCreatingFolder}
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn-base btn-primary"
          disabled={isCreatingFolder || !newFolderName.trim()}
        >
          {#if isCreatingFolder}
            <HugeiconsIcon icon={RefreshIcon} size={16} class="animate-spin" />
          {/if}
          Create folder
        </button>
      </div>
    </form>
  </Modal>

  <div
    class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 shrink-0"
  >
    <div>
      <h1
        class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground"
      >
        File Management
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Manage files and folders in the CDN.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button onclick={openCreateFolder} class="btn-base btn-secondary">
        <HugeiconsIcon icon={Add01Icon} size={16} />
        New Folder
      </button>
      <button onclick={loadFiles} class="btn-base btn-primary">
        <HugeiconsIcon
          icon={RefreshIcon}
          size={16}
          class={isLoading ? "animate-spin" : ""}
        />
        Refresh
      </button>
    </div>
  </div>

  <div
    class="flex-1 bg-transparent overflow-hidden flex flex-col mt-4 border-t border-border/50"
  >
    <!-- Breadcrumbs -->
    <div
      class="bg-transparent border-b border-border/50 py-4 flex items-center gap-2 text-sm shrink-0"
    >
      <button
        onclick={navigateRoot}
        class="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 font-medium"
      >
        <HugeiconsIcon icon={Home01Icon} size={16} />
        Root
      </button>

      {#each breadcrumbs as crumb, i}
        <HugeiconsIcon
          icon={ChevronRightIcon}
          size={14}
          class="text-muted-foreground"
        />
        <button
          onclick={() => navigateBreadcrumb(i)}
          class="hover:text-foreground transition-colors font-medium {i ===
          breadcrumbs.length - 1
            ? 'text-foreground'
            : 'text-muted-foreground'}"
        >
          {crumb}
        </button>
      {/each}
    </div>

    <!-- File List -->
    <div class="flex-1 overflow-y-auto p-2">
      {#if isLoading}
        <div
          class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3"
        >
          <HugeiconsIcon icon={RefreshIcon} size={24} class="animate-spin" />
          <p class="text-sm font-medium">Loading files...</p>
        </div>
      {:else if errorMsg}
        <div
          class="flex flex-col items-center justify-center h-48 text-destructive gap-2"
        >
          <p class="text-sm font-medium">{errorMsg}</p>
          <button
            onclick={loadFiles}
            class="text-xs underline hover:text-destructive/80"
            >Try again</button
          >
        </div>
      {:else if files.length === 0}
        <div
          class="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3"
        >
          <HugeiconsIcon icon={FolderOpenIcon} size={32} class="opacity-50" />
          <p class="text-sm font-medium">This folder is empty</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <!-- Back button if not at root -->
          {#if currentPath !== ""}
            <div
              class="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent"
              onclick={navigateUp}
              onkeydown={(e) => e.key === "Enter" && navigateUp()}
              role="button"
              tabindex="0"
            >
              <div
                class="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground shrink-0"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
              </div>
              <span class="font-medium text-sm text-foreground"
                >.. (Up a level)</span
              >
            </div>
          {/if}

          {#each files as file}
            <div
              class="group flex items-center justify-between py-3 px-2 hover:bg-muted/30 transition-colors border-b border-border/50"
            >
              <div
                class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onclick={() =>
                  file.type === "directory"
                    ? navigateTo(file.name)
                    : openFileViewer(file)}
                onkeydown={(e) =>
                  e.key === "Enter"
                    ? file.type === "directory"
                      ? navigateTo(file.name)
                      : openFileViewer(file)
                    : null}
                role="button"
                tabindex="0"
              >
                <div
                  class="h-10 w-10 rounded-lg {file.type === 'directory'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-secondary-foreground'} flex items-center justify-center shrink-0"
                >
                  <HugeiconsIcon
                    icon={file.type === "directory"
                      ? Folder01Icon
                      : getFileIcon(file.name)}
                    size={20}
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium text-foreground truncate"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  {#if file.type === "file" && file.size}
                    <p class="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  {/if}
                </div>
              </div>

              <div
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                {#if file.type === "directory"}
                  <button
                    onclick={() => openRenameModal(file)}
                    class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background transition-colors"
                    title="Rename"
                  >
                    <HugeiconsIcon icon={FileEditIcon} size={16} />
                  </button>
                {/if}
                <button
                  onclick={() => deleteFile(file)}
                  class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
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
<Modal
  bind:isOpen={viewerOpen}
  maxWidthClass={isEditingText ? "sm:max-w-4xl" : "sm:max-w-2xl"}
>
  {#snippet header()}
    {#if selectedFile}
      <div class="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {#if isRenamingInModal}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              saveModalRename();
            }}
            class="flex items-center gap-2 min-w-0"
          >
            <input
              type="text"
              bind:value={modalRenameValue}
              onkeydown={handleModalRenameKeydown}
              disabled={isSavingRenameInModal}
              class="px-2 py-0.5 bg-transparent border-b-2 border-primary text-xl sm:text-2xl font-serif font-normal text-foreground outline-none transition-all w-56 sm:w-80"
            />
            <button
              type="submit"
              class="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors shrink-0"
              title="Save name"
              disabled={isSavingRenameInModal || !modalRenameValue.trim()}
            >
              {#if isSavingRenameInModal}
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={18}
                  class="animate-spin"
                />
              {:else}
                <HugeiconsIcon icon={Tick02Icon} size={18} />
              {/if}
            </button>
            <button
              type="button"
              onclick={cancelRenameInModal}
              class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Discard"
              disabled={isSavingRenameInModal}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </button>
          </form>
        {:else}
          <button
            type="button"
            onclick={startRenameInModal}
            class="group flex items-center gap-2 text-left font-serif font-normal text-xl sm:text-2xl text-foreground hover:text-primary transition-colors py-0.5 px-1 -ml-1 rounded-md hover:bg-muted/40 max-w-full truncate"
            title="Click to rename"
          >
            <span class="truncate font-serif font-normal"
              >{selectedFile.name}</span
            >
            <HugeiconsIcon
              icon={FileEditIcon}
              size={16}
              class="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity shrink-0"
            />
          </button>
        {/if}
      </div>
    {/if}
  {/snippet}

  <div class="flex flex-col gap-3">
    {#if selectedFile}
      <!-- Action Bar (Clean toolbar, no card-inside-card) -->
      <div
        class="flex items-center justify-between gap-3 pb-3 border-b border-border/40"
      >
        <!-- File Size and Action Buttons -->
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-xs font-mono text-muted-foreground tracking-wide">
            {formatBytes(selectedFile.size || 0)}
          </span>

          <div class="h-4 w-px bg-border/60"></div>

          <!-- Compact expanding action buttons -->
          <div class="flex items-center gap-1">
            {#if isEditingText && selectedFile.name.endsWith(".json")}
              <button
                type="button"
                onclick={formatJson}
                class="group flex items-center gap-0 hover:gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all duration-200 shrink-0"
                title="Format JSON"
              >
                <HugeiconsIcon
                  icon={WandSparklesIcon}
                  size={16}
                  class="shrink-0 text-primary"
                />
                <span
                  class="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-20 group-hover:opacity-100 transition-all duration-200 ease-out"
                >
                  Format
                </span>
              </button>
            {/if}

            <button
              type="button"
              onclick={triggerFileInput}
              disabled={isUploadingFile}
              class="group flex items-center gap-0 hover:gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all duration-200 shrink-0"
              title="Replace file"
            >
              {#if isUploadingFile}
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  class="animate-spin shrink-0"
                />
              {:else}
                <HugeiconsIcon icon={AiSwapIcon} size={16} class="shrink-0" />
              {/if}
              <span
                class="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-24 group-hover:opacity-100 transition-all duration-200 ease-out"
              >
                Replace
              </span>
            </button>

            <button
              type="button"
              onclick={() => downloadFile(selectedFile!)}
              class="group flex items-center gap-0 hover:gap-1.5 px-2 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all duration-200 shrink-0"
              title="Download file"
            >
              <HugeiconsIcon icon={Download01Icon} size={16} class="shrink-0" />
              <span
                class="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-24 group-hover:opacity-100 transition-all duration-200 ease-out"
              >
                Download
              </span>
            </button>

            <button
              type="button"
              onclick={() => deleteFileFromModal(selectedFile!)}
              class="group flex items-center gap-0 hover:gap-1.5 px-2 py-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-medium transition-all duration-200 shrink-0"
              title="Delete file"
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} class="shrink-0" />
              <span
                class="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-20 group-hover:opacity-100 transition-all duration-200 ease-out"
              >
                Delete
              </span>
            </button>
          </div>
        </div>

        <!-- Save changes button: shifted to extreme right -->
        {#if isEditingText}
          <div class="flex items-center ml-auto shrink-0">
            <button
              type="button"
              onclick={saveTextContent}
              disabled={isSavingFile}
              class="btn-base btn-primary text-xs py-1.5 px-3.5"
            >
              {#if isSavingFile}
                <HugeiconsIcon
                  icon={RefreshIcon}
                  size={16}
                  class="animate-spin"
                />
              {:else}
                <HugeiconsIcon icon={FileEditIcon} size={16} />
              {/if}
              Save changes
            </button>
          </div>
        {/if}
      </div>

      <!-- Editor / Preview (Seamless, no card-inside-card) -->
      {#if isEditingText}
        <textarea
          class="w-full h-[520px] p-2 bg-transparent text-foreground font-mono text-sm leading-relaxed resize-y focus:outline-none border-0"
          bind:value={selectedFileContent}
          spellcheck="false"
        ></textarea>
      {:else if ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(selectedFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "")}
        <div class="flex items-center justify-center p-2">
          <img
            src={selectedFile.download_url}
            alt={selectedFile.name}
            class="w-full h-auto object-contain max-h-[65vh] rounded-xl"
          />
        </div>
      {:else if ["pdf"].includes(selectedFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "")}
        <iframe
          src={selectedFile.download_url}
          class="w-full h-[65vh] rounded-xl"
          title={selectedFile.name}
        ></iframe>
      {:else}
        <div
          class="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3"
        >
          <HugeiconsIcon icon={File01Icon} size={48} class="opacity-40" />
          <p class="text-sm font-medium">No preview available</p>
          <p class="text-xs">You can still replace or download this file.</p>
        </div>
      {/if}
    {/if}
  </div>
</Modal>

<input
  type="file"
  bind:this={fileInputRef}
  onchange={handleFileReplace}
  class="hidden"
/>
