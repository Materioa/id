<script lang="ts">
  import { smoothCorners } from "@lisse/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    Key01Icon,
    PlusIcon,
    TrashIcon,
    GlobeIcon,
    ShieldAlertIcon,
    CheckmarkCircle01Icon,
    ClipboardIcon,
    EyeIcon,
    EyeOffIcon,
  } from "@hugeicons/core-free-icons";
  import { onMount } from "svelte";
  import { addToast } from "$lib/stores/toast";
  import { goto } from "$app/navigation";
  import { pageCache } from "$lib/stores/cache";

  let apps = $state<any[]>([]);
  let isLoading = $state(true);

  // Registration form
  let name = $state("");
  let redirectUri = $state("");
  let isRegistering = $state(false);
  let errorMsg = $state("");
  let successMsg = $state("");

  // Newly registered app details for credentials disclosure modal
  let disclosedApp = $state<any | null>(null);
  let visibleSecret = $state(false);

  async function loadApps(force = false) {
    isLoading = true;
    if (!force) {
      const cached = pageCache.get<any[]>("api_keys");
      if (cached) {
        apps = cached;
        isLoading = false;
        return;
      }
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/v2/auth?action=oauth_list_apps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load developer apps");
      const data = (await res.json()) as any;
      apps = data.apps || [];
      pageCache.set("api_keys", apps);
    } catch (err: any) {
      errorMsg = err.message;
    } finally {
      isLoading = false;
    }
  }

  async function registerApp(e: Event) {
    e.preventDefault();
    isRegistering = true;
    errorMsg = "";
    successMsg = "";
    disclosedApp = null;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/v2/auth", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "oauth_register_app",
          name,
          redirectUri,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok)
        throw new Error(data.error || "Failed to register application");

      successMsg = "Developer application registered successfully!";
      disclosedApp = data.app;
      name = "";
      redirectUri = "";
      loadApps(true);
    } catch (err: any) {
      errorMsg = err.message;
    } finally {
      isRegistering = false;
    }
  }

  async function deleteApp(clientId: string, appName: string) {
    if (
      !confirm(
        `Are you sure you want to delete "${appName}"? Clients using this Client ID will no longer be able to authenticate.`,
      )
    )
      return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/v2/auth", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "oauth_delete_app",
          clientId,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok)
        throw new Error(data.error || "Failed to delete application");

      successMsg = `Application "${appName}" deleted.`;
      loadApps(true);
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard!", "success");
  }

  onMount(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      goto("/login");
      return;
    }
    loadApps();
  });
</script>

<svelte:head>
  <title>Developer Apps</title>
</svelte:head>

<div
  class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-4 sm:p-6"
>
  <!-- Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 border-b border-border/60 pb-6"
  >
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">
        Developer Apps
      </h1>
      <p class="text-sm text-muted-foreground mt-1">
        Manage OAuth developer applications, Client IDs and secrets.
      </p>
    </div>
  </div>

  <!-- Messages -->
  {#if errorMsg}
    <div
      class="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl"
    >
      {errorMsg}
    </div>
  {/if}
  {#if successMsg}
    <div
      class="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl"
    >
      {successMsg}
    </div>
  {/if}

  <!-- Newly Registered App Credentials Modal/Panel (increased roundness: rounded-2xl) -->
  {#if disclosedApp}
    <div
      class="p-4 sm:p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-4 animate-in slide-in-from-top-4 duration-300"
    >
      <div class="flex items-center gap-2 text-indigo-600">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          size={18}
          class="text-indigo-600"
        />
        <h4 class="font-semibold text-sm">Save Client Credentials Now</h4>
      </div>
      <p class="text-xs text-muted-foreground leading-relaxed">
        This is the only time the Client Secret will be shown. Make sure to copy
        it now.
      </p>

      <div class="space-y-3 max-w-xl">
        <div class="space-y-1">
          <span
            class="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
            >App Name</span
          >
          <span class="text-sm text-foreground font-semibold block"
            >{disclosedApp.name}</span
          >
        </div>
        <div class="space-y-1">
          <span
            class="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
            >Client ID</span
          >
          <div class="flex items-center gap-2">
            <code
              class="text-xs font-mono bg-background border px-3 py-2 rounded-lg select-all flex-1"
              >{disclosedApp.client_id}</code
            >
            <button
              onclick={() => copyToClipboard(disclosedApp.client_id)}
              class="p-2.5 border text-muted-foreground hover:text-foreground rounded-xl transition-all bg-background cursor-pointer hover:bg-zinc-50 flex items-center justify-center"
              title="Copy Client ID"
            >
              <HugeiconsIcon icon={ClipboardIcon} size={16} />
            </button>
          </div>
        </div>
        <div class="space-y-1">
          <span
            class="text-xs font-semibold text-muted-foreground uppercase tracking-wider block"
            >Client Secret</span
          >
          <div class="flex items-center gap-2">
            <code
              class="text-xs font-mono bg-background border px-3 py-2 rounded-lg select-all flex-1"
            >
              {visibleSecret
                ? disclosedApp.client_secret
                : "••••••••••••••••••••••••••••••••"}
            </code>
            <button
              onclick={() => (visibleSecret = !visibleSecret)}
              class="p-2.5 border text-muted-foreground hover:text-foreground rounded-xl transition-all bg-background cursor-pointer hover:bg-zinc-50 flex items-center justify-center"
              title="Toggle Secret Visibility"
            >
              {#if visibleSecret}
                <HugeiconsIcon icon={EyeOffIcon} size={16} />
              {:else}
                <HugeiconsIcon icon={EyeIcon} size={16} />
              {/if}
            </button>
            <button
              onclick={() => copyToClipboard(disclosedApp.client_secret)}
              class="p-2.5 border text-muted-foreground hover:text-foreground rounded-xl transition-all bg-background cursor-pointer hover:bg-zinc-50 flex items-center justify-center"
              title="Copy Client Secret"
            >
              <HugeiconsIcon icon={ClipboardIcon} size={16} />
            </button>
          </div>
        </div>
      </div>
      <button
        onclick={() => (disclosedApp = null)}
        class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline block pt-2"
        >I have saved these credentials</button
      >
    </div>
  {/if}

  <!-- Register Application (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-border/60 p-4 sm:p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
      <HugeiconsIcon icon={PlusIcon} size={18} class="text-muted-foreground" />
      <h3 class="font-semibold text-foreground text-sm">
        Register Developer Application
      </h3>
    </div>

    <form onsubmit={registerApp} class="space-y-4 max-w-xl">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <label for="appName" class="text-[13px] font-medium text-foreground"
            >Application Name</label
          >
          <input
            id="appName"
            type="text"
            bind:value={name}
            required
            placeholder="e.g. My Dashboard Client"
            class="w-full bg-background border border-zinc-200 text-foreground text-sm px-3 py-2.5 outline-none focus:border-zinc-300 rounded-xl"
          />
        </div>
        <div class="space-y-1.5">
          <label
            for="redirectUri"
            class="text-[13px] font-medium text-foreground">Redirect URI</label
          >
          <input
            id="redirectUri"
            type="url"
            bind:value={redirectUri}
            required
            placeholder="https://example.com/callback"
            class="w-full bg-background border border-zinc-200 text-foreground text-sm px-3 py-2.5 outline-none focus:border-zinc-300 rounded-xl"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isRegistering}
        class="btn-base btn-primary mt-2"
      >
        {isRegistering ? "Registering..." : "Register Application"}
      </button>
    </form>
  </div>

  <!-- Applications List (increased roundness: rounded-2xl) -->
  <div class="bg-card border border-border/60 p-4 sm:p-6 shadow-sm rounded-2xl">
    <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-4">
      <HugeiconsIcon icon={Key01Icon} size={18} class="text-muted-foreground" />
      <h3 class="font-semibold text-foreground text-sm">
        Your Developer Applications
      </h3>
    </div>

    {#if isLoading}
      <div class="py-12 text-center text-sm text-zinc-500">
        Loading applications...
      </div>
    {:else if apps.length === 0}
      <div class="py-12 text-center text-sm text-zinc-500">
        <HugeiconsIcon
          icon={GlobeIcon}
          size={36}
          class="mx-auto text-zinc-300 mb-3"
        />
        <h4 class="font-medium text-foreground">No applications registered</h4>
        <p class="text-xs text-muted-foreground mt-1">
          Register an application above to obtain client credentials.
        </p>
      </div>
    {:else}
      <div class="divide-y divide-border/50">
        {#each apps as app}
          <div
            class="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4 group"
          >
            <div class="space-y-2 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-foreground">{app.name}</span
                >
              </div>
              <div class="space-y-2 mt-1">
                <div
                  class="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <HugeiconsIcon
                    icon={GlobeIcon}
                    size={14}
                    class="text-zinc-400 shrink-0 mt-0.5"
                  />
                  <span class="break-all leading-relaxed"
                    >Redirect: <code
                      >{app.redirect_uri || app.redirect_uris}</code
                    ></span
                  >
                </div>
                <div
                  class="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <HugeiconsIcon
                    icon={ClipboardIcon}
                    size={14}
                    class="text-zinc-400 shrink-0 mt-0.5"
                  />
                  <span class="break-all leading-relaxed"
                    >Client ID: <code
                      class="bg-muted px-2 py-0.5 rounded font-mono select-all"
                      >{app.client_id}</code
                    ></span
                  >
                </div>
              </div>
            </div>
            <button
              onclick={() => deleteApp(app.client_id, app.name)}
              class="btn-base btn-destructive !px-3 !py-1.5 !text-xs self-start md:self-center"
            >
              Delete
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
