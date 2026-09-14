<script lang="ts">
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    Download01Icon,
    Loading01Icon,
    AlertCircleIcon,
    CheckmarkCircle01Icon,
    Clock01Icon,
    Database02Icon,
  } from "@hugeicons/core-free-icons";
  import { onMount } from "svelte";
  import { addToast } from "$lib/stores/toast";
  import Modal from "$lib/components/Modal.svelte";
  import { fade } from "svelte/transition";

  let isExporting = $state(false);
  let showConfirmModal = $state(false);
  let exportSuccess = $state(false);
  let exportError = $state("");
  let cooldownUntil = $state<string | null>(null);
  let lastExportDate = $state<string | null>(null);
  let lastExportStatus = $state<string | null>(null);

  // Computed
  let isOnCooldown = $derived(() => {
    if (!cooldownUntil) return false;
    return new Date(cooldownUntil) > new Date();
  });

  let cooldownText = $derived(() => {
    if (!cooldownUntil) return "";
    const remaining = new Date(cooldownUntil).getTime() - Date.now();
    if (remaining <= 0) return "";
    const hours = Math.ceil(remaining / (1000 * 60 * 60));
    return `Available in ${hours}h`;
  });

  onMount(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Check saved cooldown from localStorage as immediate feedback
    const savedCooldown = localStorage.getItem("export_cooldown");
    if (savedCooldown && new Date(savedCooldown) > new Date()) {
      cooldownUntil = savedCooldown;
    }

    // Fetch the actual status from the server
    try {
      const res = await fetch("/api/v2/data-export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as any;

      if (data.lastExport) {
        lastExportDate = data.lastExport.createdAt;
        lastExportStatus = data.lastExport.status;
        if (data.lastExport.cooldownUntil) {
          cooldownUntil = data.lastExport.cooldownUntil;
          localStorage.setItem(
            "export_cooldown",
            data.lastExport.cooldownUntil,
          );
        } else {
          cooldownUntil = null;
          localStorage.removeItem("export_cooldown");
        }
      }
    } catch (e) {
      // Silently fail — we just won't show the status
    }
  });

  function openConfirmModal() {
    exportError = "";
    showConfirmModal = true;
  }

  async function startExport() {
    showConfirmModal = false;
    isExporting = true;
    exportError = "";
    exportSuccess = false;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/v2/data-export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        if (res.status === 429 && data.cooldownUntil) {
          cooldownUntil = data.cooldownUntil;
          localStorage.setItem("export_cooldown", data.cooldownUntil);
        }
        throw new Error(data.error || "Export request failed");
      }

      exportSuccess = true;
      lastExportStatus = "processing";
      lastExportDate = new Date().toISOString();

      // Set 24h cooldown
      const cooldown = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      cooldownUntil = cooldown;
      localStorage.setItem("export_cooldown", cooldown);

      addToast("Export started! Check your email.", "success", "Data Export");
    } catch (err: any) {
      exportError = err.message;
      addToast(err.message, "error", "Export Failed");
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:head>
  <title>Data Controls</title>
</svelte:head>

<div
  class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6"
>
  <div
    class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 border-b border-border/60 pb-6"
  >
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">
        Data Controls
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Manage your data preferences and privacy settings.
      </p>
    </div>
  </div>

  <!-- Export Your Data Card -->
  <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
      <HugeiconsIcon
        icon={Database02Icon}
        size={18}
        class="text-muted-foreground"
      />
      <h3 class="font-semibold text-foreground text-sm">Export Your Data</h3>
    </div>

    <div class="space-y-5">
      <p class="text-sm text-muted-foreground leading-relaxed max-w-2xl">
        Download a copy of your Materio data. This includes your personal
        details, activity, and saved content.
      </p>

      <!-- What's included -->
      <div class="mt-4">
        <h4
          class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4"
        >
          What's included
        </h4>
        <ul class="space-y-4">
          {#each [{ label: "Profile details", desc: "Your username, email, and display name" }, { label: "Activity & stats", desc: "How you use the app and your daily progress" }, { label: "Security history", desc: "Where and when you logged in" }, { label: "Conversations & content", desc: "Your chats and anything you saved" }] as item}
            <li class="flex flex-col">
              <span class="text-sm font-medium text-foreground"
                >{item.label}</span
              >
              <p class="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
            </li>
          {/each}
        </ul>
      </div>

      <!-- Success banner -->
      {#if exportSuccess}
        <div
          transition:fade={{ duration: 200 }}
          class="flex items-start gap-3 py-2"
        >
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            size={20}
            class="text-primary shrink-0 mt-0.5"
          />
          <div>
            <p class="text-sm font-medium text-foreground">
              Export started successfully
            </p>
            <p class="text-sm text-muted-foreground mt-1">
              We've sent a confirmation email. You'll receive another email with
              a download link when your data is ready.
            </p>
          </div>
        </div>
      {/if}

      <!-- Error banner -->
      {#if exportError}
        <div
          transition:fade={{ duration: 200 }}
          class="flex items-start gap-3 py-2"
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={20}
            class="text-destructive shrink-0 mt-0.5"
          />
          <p class="text-sm text-destructive">{exportError}</p>
        </div>
      {/if}

      <!-- Last export info -->
      {#if lastExportDate}
        <div class="flex items-center gap-2 text-sm text-muted-foreground pt-2">
          <HugeiconsIcon icon={Clock01Icon} size={16} />
          <span>
            Last export: {new Date(lastExportDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            <span class="mx-1.5 text-border">•</span>
            <span class="capitalize font-medium text-foreground"
              >{lastExportStatus}</span
            >
          </span>
        </div>
      {/if}

      <!-- Export button -->
      <div
        class="flex flex-col sm:flex-row sm:items-center items-start gap-3 sm:gap-4 pt-2"
      >
        <button
          onclick={openConfirmModal}
          disabled={isExporting || isOnCooldown()}
          class="btn-base btn-primary"
        >
          {#if isExporting}
            <HugeiconsIcon
              icon={Loading01Icon}
              size={16}
              class="animate-spin"
            />
            <span>Preparing...</span>
          {:else if isOnCooldown()}
            <HugeiconsIcon icon={Clock01Icon} size={16} />
            <span>{cooldownText()}</span>
          {:else}
            <HugeiconsIcon icon={Download01Icon} size={16} />
            <span>Export My Data</span>
          {/if}
        </button>

        {#if isOnCooldown() && !isExporting}
          <span class="text-xs text-muted-foreground"
            >You can request one export every 24 hours.</span
          >
        {/if}
      </div>
    </div>
  </div>

  <!-- Info card -->
  <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
      <HugeiconsIcon
        icon={AlertCircleIcon}
        size={18}
        class="text-muted-foreground"
      />
      <h3 class="font-semibold text-foreground text-sm">About Your Data</h3>
    </div>

    <div
      class="space-y-4 text-sm text-muted-foreground leading-relaxed max-w-2xl"
    >
      <p>
        We believe your data belongs to you. We only collect the information
        needed to keep your account secure and provide you with the best
        possible experience.
      </p>
      <p>
        Your personal details, activity, and saved content are stored securely.
        We never share your private information with third parties without your
        explicit consent.
      </p>
      <p>
        If you want to permanently erase your account and all associated data,
        you can do that from the
        <a href="/security" class="text-primary hover:underline font-medium"
          >Security</a
        > page.
      </p>
    </div>
  </div>
</div>

<!-- Confirmation Modal -->
<Modal bind:isOpen={showConfirmModal} title="Export Your Data">
  <div class="space-y-5">
    <p class="text-sm text-muted-foreground leading-relaxed">
      We'll gather your information and email you a secure link to download it.
    </p>

    <div class="space-y-4 pt-2">
      <div class="flex items-center gap-3">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          size={18}
          class="text-muted-foreground"
        />
        <span class="text-sm text-foreground"
          >You'll receive a confirmation email immediately</span
        >
      </div>
      <div class="flex items-center gap-3">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          size={18}
          class="text-muted-foreground"
        />
        <span class="text-sm text-foreground"
          >Another email with a download link when ready</span
        >
      </div>
      <div class="flex items-center gap-3">
        <HugeiconsIcon
          icon={Clock01Icon}
          size={18}
          class="text-muted-foreground"
        />
        <span class="text-sm text-foreground"
          >Download link expires after 24 hours</span
        >
      </div>
    </div>

    <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
      <button
        class="btn-base btn-secondary"
        onclick={() => (showConfirmModal = false)}>Cancel</button
      >
      <button
        class="btn-base btn-primary"
        onclick={startExport}
        disabled={isExporting}
      >
        {#if isExporting}
          <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
        {/if}
        Start Export
      </button>
    </div>
  </div>
</Modal>
