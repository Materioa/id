<svelte:head>
  <title>Personal Info</title>
</svelte:head>

<script lang="ts">
  import { smoothCorners } from "@lisse/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    Camera01Icon,
    Loading01Icon,
    KeyRoundIcon,
    ClipboardIcon,
    Edit01Icon,
    CheckmarkCircle01Icon,
    UserCircleIcon,
    Image01Icon,
    Home01Icon, 
    ChevronRightIcon, 
    KeyIcon,
  } from "@hugeicons/core-free-icons";
  import { Eye, EyeOff } from 'lucide-svelte';
  import { onMount } from "svelte";
  import { addToast } from "$lib/stores/toast";
  import Modal from "$lib/components/Modal.svelte";
  import { goto } from "$app/navigation";
  import { createAvatar } from "@dicebear/core";
  import { lorelei } from "@dicebear/collection";
  import { userStore } from "$lib/stores/user.svelte";
  import { pageCache } from "$lib/stores/cache";

  let user = $state({
    id: "",
    username: "",
    displayName: "",
    email: "",
    profilePicture: "",
    recoveryKey: "",
    plan: "Basic",
    branch: "",
    specialization: "",
  });

  let isLoading = $state(true);
  let isSaving = $state(false);
  let isRegeneratingKey = $state(false);
  let errorMsg = $state("");
  let successMsg = $state("");
  let currentPassword = $state("");

  // Personal details values
  let displayName = $state("");
  let username = $state("");
  let newProfilePicture = $state("");
  let branch = $state("");
  let specialization = $state("");

  // Edit Mode state
  let isEditing = $state(false);

  let randomSeed = $state("");

  function shuffleAvatar() {
    randomSeed = Math.random().toString(36).substring(7);
    newProfilePicture = createAvatar(lorelei, {
      seed: randomSeed,
      size: 128,
      radius: 0,
      backgroundColor: ["FDFBF7", "F5F0E6"],
    }).toDataUri();
  }

  let dicebearAvatar = $derived(
    createAvatar(lorelei, {
      seed: displayName || username || "User",
      size: 128,
      radius: 0,
      backgroundColor: ["FDFBF7", "F5F0E6"],
    }).toDataUri(),
  );

  onMount(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      goto("/login");
      return;
    }

    // Load profile from API

    await loadProfile();
  });

  async function loadProfile() {
    const cachedProfile = pageCache.get<any>('profile');
    
    try {
      let u: any;
      if (cachedProfile) {
        u = cachedProfile;
      } else {
        u = await userStore.fetchProfile();
        if (!u) {
          localStorage.removeItem("token");
          goto("/login");
          return;
        }
        pageCache.set('profile', u);
      }

      user.id = u.id;
      user.username = u.username;
      user.displayName = u.displayName || "";
      user.email = u.email;
      user.profilePicture = u.profilePicture || "";
      user.recoveryKey = u.recoveryKey || "";
      user.plan = u.isPlusUser ? "Super" : u.isLiteUser ? "Pro" : "Basic";
      user.branch = u.branch || "";
      user.specialization = u.specialization || "";

      displayName = user.displayName;
      username = user.username;
      newProfilePicture = user.profilePicture;
      branch = user.branch;
      specialization = user.specialization;
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function saveChanges(e: Event) {
    e.preventDefault();
    isSaving = true;
    errorMsg = "";
    successMsg = "";

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/v2/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          username,
          profilePicture: newProfilePicture,
          branch,
          specialization,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      successMsg = "Personal details updated successfully!";
      user.displayName = data.user.displayName;
      user.username = data.user.username;
      user.profilePicture = data.user.profilePicture || "";
      user.branch = data.user.branch || "";
      user.specialization = data.user.specialization || "";
      isEditing = false;
      pageCache.set('profile', $state.snapshot(user));
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isSaving = false;
    }
  }

  let isRegenerateModalOpen = $state(false);
  let regeneratePasswordInput = $state("");
  let showRegeneratePassword = $state(false);

  async function executeRegenerateRecoveryKey() {
    if (!regeneratePasswordInput) {
      addToast("Password is required.", "warning");
      return;
    }

    isRegeneratingKey = true;
    errorMsg = "";
    successMsg = "";
    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/v2/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: regeneratePasswordInput,
          generateNewRecoveryKey: true,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok)
        throw new Error(data.error || "Failed to generate recovery key");

      addToast("Recovery key regenerated successfully.", "success");
      isRegenerateModalOpen = false;
      regeneratePasswordInput = "";
      user.recoveryKey = data.recoveryKey;
    } catch (e: any) {
      addToast(e.message || "Failed to regenerate recovery key.", "error");
    } finally {
      isRegeneratingKey = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard!", "success");
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          newProfilePicture = e.target.result;
        }
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  let fileInput: HTMLInputElement | undefined = $state();
</script>

<div
  class="max-w-5xl mx-auto px-6 space-y-8 animate-in fade-in duration-500 pb-16"
>
  {#if isLoading}
    <div
      class="py-32 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"
    >
      <HugeiconsIcon
        icon={Loading01Icon}
        size={16}
        class="animate-spin text-muted-foreground"
      />
      <span>Loading profile...</span>
    </div>
  {:else}
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Personal Info</h1>
    </div>

    <div class="flex flex-col md:flex-row gap-8 items-start">
      <!-- Left Column: Avatar Display -->
      <div
        class="bg-card border border-border/60 p-4 shadow-sm rounded-2xl w-full md:w-72 shrink-0 flex flex-col gap-4"
      >
        <div
          class="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center border border-border/50 bg-background/50"
        >
          {#if isEditing}
            {#if newProfilePicture}
              <img
                src={newProfilePicture}
                alt="Avatar"
                class="w-full h-full object-cover"
              />
            {:else}
              <img
                src={dicebearAvatar}
                alt="Dicebear Avatar"
                class="w-full h-full object-cover pixelated"
              />
            {/if}
          {:else if user.profilePicture}
            <img
              src={user.profilePicture}
              alt="Avatar"
              class="w-full h-full object-cover"
            />
          {:else}
            <img
              src={dicebearAvatar}
              alt="Dicebear Avatar"
              class="w-full h-full object-cover pixelated"
            />
          {/if}
        </div>

        {#if isEditing}
          <div class="flex items-center gap-2 justify-between">
            <button
              type="button"
              onclick={shuffleAvatar}
              class="flex items-center gap-2 px-3 py-1.5 border border-border/60 rounded-lg text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
              Shuffle
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => fileInput?.click()}
                class="p-1.5 border border-border/60 rounded-lg hover:bg-muted/40 transition-colors text-foreground"
                title="Upload"
              >
                <HugeiconsIcon icon={Image01Icon} size={16} />
              </button>
              {#if newProfilePicture}
                <button
                  type="button"
                  onclick={() => (newProfilePicture = "")}
                  class="p-1.5 border border-border/60 rounded-lg hover:bg-muted/40 transition-colors text-red-500 hover:text-red-600"
                  title="Remove"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                </button>
              {/if}
            </div>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              bind:this={fileInput}
              onchange={handleFileSelect}
            />
          </div>
        {:else}
          <div class="flex justify-center">
            <button
              onclick={() => {
                isEditing = true;
                errorMsg = "";
                successMsg = "";
              }}
              class="w-full btn-base btn-secondary"
            >
              <HugeiconsIcon icon={Edit01Icon} size={16} />
              <span>Edit Details</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- Right Column: Form details -->
      <div class="flex-1 w-full space-y-6">
        {#if errorMsg}
          <div
            class="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl"
          >
            {errorMsg}
          </div>
        {/if}
        {#if successMsg}
          <div
            class="p-3 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm rounded-xl flex items-center gap-2"
          >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
            <span>{successMsg}</span>
          </div>
        {/if}

        {#if isEditing}
          <form onsubmit={saveChanges} class="space-y-6">
            <div class="flex flex-col sm:flex-row gap-6">
              <!-- Name -->
              <div class="flex-1 space-y-1.5">
                <label
                  for="displayName"
                  class="text-sm font-medium text-muted-foreground"
                  >What would you like to be called?</label
                >
                <input
                  id="displayName"
                  type="text"
                  bind:value={displayName}
                  required
                  class="w-full bg-transparent border border-border/60 text-sm px-3.5 py-2.5 outline-none focus:border-foreground/30 rounded-xl transition-colors"
                />
              </div>

              <!-- Username -->
              <div class="flex-1 space-y-1.5">
                <label
                  for="username"
                  class="text-sm font-medium text-muted-foreground"
                  >Set your @ tag</label
                >
                <input
                  id="username"
                  type="text"
                  bind:value={username}
                  required
                  class="w-full bg-transparent border border-border/60 text-sm px-3.5 py-2.5 outline-none focus:border-foreground/30 rounded-xl transition-colors"
                />
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-6">
              <!-- Branch -->
              <div class="flex-1 space-y-1.5">
                <label
                  for="branch"
                  class="text-sm font-medium text-muted-foreground"
                  >Branch</label
                >
                <input
                  id="branch"
                  type="text"
                  bind:value={branch}
                  placeholder="e.g. CSE"
                  class="w-full bg-transparent border border-border/60 text-sm px-3.5 py-2.5 outline-none focus:border-foreground/30 rounded-xl transition-colors"
                />
              </div>

              <!-- Specialization -->
              <div class="flex-1 space-y-1.5">
                <label
                  for="specialization"
                  class="text-sm font-medium text-muted-foreground"
                  >Specialization</label
                >
                <input
                  id="specialization"
                  type="text"
                  bind:value={specialization}
                  placeholder="e.g. AI & ML"
                  class="w-full bg-transparent border border-border/60 text-sm px-3.5 py-2.5 outline-none focus:border-foreground/30 rounded-xl transition-colors"
                />
              </div>
            </div>

            <!-- Email Preference -->
            <div class="space-y-1.5">
              <label
                for="email_pref"
                class="text-sm font-medium text-muted-foreground flex items-center gap-1"
              >
                Your email address
              </label>
              <textarea
                id="email_pref"
                value={user.email}
                disabled
                class="w-full bg-muted/20 border border-border/60 text-sm px-3.5 py-2.5 min-h-[100px] resize-y outline-none rounded-xl text-muted-foreground cursor-not-allowed"
              ></textarea>
            </div>

            <div class="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onclick={() => {
                  isEditing = false;
                  // Reset changes on cancel
                  displayName = user.displayName;
                  username = user.username;
                  newProfilePicture = user.profilePicture;
                  branch = user.branch;
                  specialization = user.specialization;
                  errorMsg = "";
                  successMsg = "";
                }}
                class="btn-base btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                class="btn-base btn-primary"
              >
                {isSaving ? "Saving..." : "Save Details"}
              </button>
            </div>
          </form>
        {:else}
          <div class="space-y-6">
            <div class="flex flex-col sm:flex-row gap-6">
              <div class="flex-1 space-y-1.5">
                <span class="block text-sm font-medium text-muted-foreground"
                  >What would you like to be called?</span
                >
                <div
                  class="w-full bg-transparent border border-border/40 text-sm px-3.5 py-2.5 rounded-xl cursor-default text-foreground/80"
                >
                  {displayName || user.displayName || "—"}
                </div>
              </div>
              <div class="flex-1 space-y-1.5">
                <span class="block text-sm font-medium text-muted-foreground"
                  >Set your @ tag</span
                >
                <div
                  class="w-full bg-transparent border border-border/40 text-sm px-3.5 py-2.5 rounded-xl cursor-default text-foreground/80"
                >
                  {username || user.username || "—"}
                </div>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-6">
              <div class="flex-1 space-y-1.5">
                <span class="block text-sm font-medium text-muted-foreground"
                  >Branch</span
                >
                <div
                  class="w-full bg-transparent border border-border/40 text-sm px-3.5 py-2.5 rounded-xl cursor-default text-foreground/80"
                >
                  {branch || user.branch || "—"}
                </div>
              </div>
              <div class="flex-1 space-y-1.5">
                <span class="block text-sm font-medium text-muted-foreground"
                  >Specialization</span
                >
                <div
                  class="w-full bg-transparent border border-border/40 text-sm px-3.5 py-2.5 rounded-xl cursor-default text-foreground/80"
                >
                  {specialization || user.specialization || "—"}
                </div>
              </div>
            </div>
            <div class="space-y-1.5">
              <span
                class="block text-sm font-medium text-muted-foreground flex items-center gap-1"
              >
                Your email address
              </span>
              <div
                class="w-full bg-transparent border border-border/40 text-sm px-3.5 py-2.5 min-h-[100px] rounded-xl cursor-default text-foreground/80"
              >
                {user.email}
              </div>
            </div>
          </div>
        {/if}

        <!-- Recovery Key Section -->
        <div class="pt-8">
          <div class="border-t border-border/50 pt-6">
            <h3 class="font-bold text-[15px] text-foreground mb-2">
              Account Recovery Key
            </h3>
            <p class="text-xs text-muted-foreground mb-4">
              Your recovery key is used to regain access to your account if you
              forget your password. Keep it secure and private.
            </p>

            <div
              class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div class="relative flex-1 flex items-center">
                <code
                  class="w-full bg-muted/30 border border-border/60 text-foreground text-xs font-mono px-3.5 py-2.5 rounded-xl tracking-wide select-all block"
                >
                  {user.recoveryKey || "No recovery key generated"}
                </code>
              </div>

              <div class="flex gap-2 shrink-0">
                {#if user.recoveryKey}
                  <button
                    onclick={() => copyToClipboard(user.recoveryKey)}
                    class="p-2.5 border border-border/60 text-muted-foreground hover:text-foreground rounded-xl bg-background transition-colors hover:bg-muted/40 flex items-center justify-center"
                    title="Copy to clipboard"
                  >
                    <HugeiconsIcon icon={ClipboardIcon} size={16} />
                  </button>
                {/if}
                <button
                  onclick={() => { isRegenerateModalOpen = true; regeneratePasswordInput = ''; }}
                  disabled={isRegeneratingKey}
                  class="btn-base btn-secondary"
                >
                  <HugeiconsIcon icon={KeyRoundIcon} size={16} />
                  <span
                    >{isRegeneratingKey
                      ? "Regenerating..."
                      : "Regenerate"}</span
                  >
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/if}
</div>

<!-- Regenerate Recovery Key Modal -->
<Modal bind:isOpen={isRegenerateModalOpen} title="Regenerate Recovery Key">
  <div class="space-y-4">
    <p class="text-[15px] text-muted-foreground">
      Are you sure you want to regenerate your recovery key? <strong>Any previous recovery key will be invalidated.</strong>
    </p>
    <div class="space-y-2">
      <label for="regen-password" class="text-sm font-medium text-foreground">Current Password</label>
      <div class="relative">
        <input 
          id="regen-password"
          type={showRegeneratePassword ? "text" : "password"} 
          bind:value={regeneratePasswordInput}
          placeholder="Enter your current password"
          class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px] pr-10"
        />
        <button 
          type="button" 
          onclick={() => showRegeneratePassword = !showRegeneratePassword}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {#if showRegeneratePassword}
            <EyeOff class="w-4 h-4" />
          {:else}
            <Eye class="w-4 h-4" />
          {/if}
        </button>
      </div>
    </div>
    <div class="flex justify-end gap-3 mt-6">
      <button 
        type="button" 
        class="btn-base btn-secondary"
        onclick={() => isRegenerateModalOpen = false}
        disabled={isRegeneratingKey}
      >
        Cancel
      </button>
      <button 
        type="button" 
        class="btn-base btn-primary bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onclick={executeRegenerateRecoveryKey}
        disabled={isRegeneratingKey || !regeneratePasswordInput}
      >
        {isRegeneratingKey ? "Regenerating..." : "Regenerate Key"}
      </button>
    </div>
  </div>
</Modal>
