<svelte:head>
  <title>Analytics — Writer</title>
</svelte:head>

<script lang="ts">
  import D3AreaChart from '$lib/components/D3AreaChart.svelte';
  import PostAnalyticsModal from '$lib/components/PostAnalyticsModal.svelte';
  import Scritto from '@scritto/svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    ArrowLeft02Icon,
    Analytics01Icon,
    RefreshIcon
  } from '@hugeicons/core-free-icons';

  import { goto } from '$app/navigation';

  let { data }: { data: { days: number; analytics: any } } = $props();

  let selectedDays = $state(data.days || 30);
  let analyticsData = $state(data.analytics || {});
  let isLoading = $state(false);

  $effect(() => {
    selectedDays = data.days || 30;
    analyticsData = data.analytics || {};
  });

  let stats = $derived(analyticsData.stats || {});
  let timeline = $derived(analyticsData.timeline || []);
  let topPosts = $derived(analyticsData.topPosts || []);
  let locations = $derived(analyticsData.topLocations || analyticsData.locations || []);

  let mTotalViews = $derived((stats.totalViews || 0).toLocaleString());
  let mTotalDuration = $derived(formatDuration(stats.totalDuration || 0));
  let mRetentionRate = $derived(`${stats.retentionRate || 0}%`);
  let mAvgCompletion = $derived(`${Math.round(stats.avgScrollDepth || 0)}%`);
  let mTotalClaps = $derived((stats.totalClaps || 0).toLocaleString());

  let postForModal = $state<{ id: string; title: string } | null>(null);

  async function selectDays(d: number) {
    if (selectedDays === d && !isLoading) return;
    selectedDays = d;
    isLoading = true;
    try {
      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('materio_auth_token')) : '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/analytics/general?days=${d}`, { headers });
      if (res.ok) {
        analyticsData = await res.json();
        window.history.replaceState({}, '', `/admin/writer/analytics?days=${d}`);
      } else {
        await goto(`/admin/writer/analytics?days=${d}`, { keepFocus: true, noScroll: true, replaceState: true });
      }
    } catch (err) {
      console.error('Failed to load analytics range:', err);
      await goto(`/admin/writer/analytics?days=${d}`, { keepFocus: true, noScroll: true, replaceState: true });
    } finally {
      isLoading = false;
    }
  }

  function formatDuration(sec: number) {
    if (!sec) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }
</script>

<div class="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 font-sans animate-in fade-in duration-300">
  <!-- Header with Apple-style Range Switcher -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <a
        href="/admin/writer"
        class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors shrink-0"
        title="Back"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} size={18} />
      </a>
      <div>
        <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">
          Analytics
        </h1>
        <p class="text-muted-foreground mt-0.5 sm:mt-1 text-xs sm:text-sm font-sans">
          Readership and engagement metrics across articles.
        </p>
      </div>
    </div>

    <!-- Segmented Range Control -->
    <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
      {#if isLoading}
        <HugeiconsIcon icon={RefreshIcon} size={15} class="animate-spin text-muted-foreground mr-1 shrink-0" />
      {/if}
      <div class="flex items-center gap-1 p-1 bg-muted/40 rounded-xl text-xs w-full sm:w-auto justify-between sm:justify-start">
        {#each [7, 14, 30, 90] as d}
          <button
            onclick={() => selectDays(d)}
            class="flex-1 sm:flex-initial text-center px-3 sm:px-3.5 py-1.5 rounded-lg font-medium transition-all duration-150 {selectedDays === d ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
          >
            {d}d
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Key Metrics Row with instant reactivity -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 pt-2 border-t border-border/50 {isLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}">
    <div>
      <div class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground metric-scritto">
        <Scritto value={mTotalViews} />
      </div>
      <div class="text-xs text-muted-foreground font-sans mt-1">Total reads</div>
    </div>

    <div>
      <div class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground metric-scritto">
        <Scritto value={mTotalDuration} />
      </div>
      <div class="text-xs text-muted-foreground font-sans mt-1">Reading time</div>
    </div>

    <div>
      <div class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground metric-scritto">
        <Scritto value={mRetentionRate} />
      </div>
      <div class="text-xs text-muted-foreground font-sans mt-1">Retention (&gt;30s)</div>
    </div>

    <div>
      <div class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground metric-scritto">
        <Scritto value={mAvgCompletion} />
      </div>
      <div class="text-xs text-muted-foreground font-sans mt-1">Avg completion</div>
    </div>

    <div class="col-span-2 sm:col-span-1">
      <div class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground metric-scritto">
        <Scritto value={mTotalClaps} />
      </div>
      <div class="text-xs text-muted-foreground font-sans mt-1">Claps</div>
    </div>
  </div>

  <!-- Traffic Timeline -->
  <div class="pt-4 border-t border-border/50 space-y-3 {isLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-medium text-foreground">Traffic Velocity</h2>
      <span class="text-xs text-muted-foreground font-sans">Past {selectedDays} days</span>
    </div>

    <div class="pt-2">
      <D3AreaChart data={timeline} height={200} />
    </div>
  </div>

  <!-- Top Articles & Reader Locations Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6 border-t border-border/50 {isLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}">
    <!-- Top Articles (2 cols) -->
    <div class="lg:col-span-2 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-foreground">Top Articles</h2>
        <span class="text-xs text-muted-foreground font-sans">Ranked by reads</span>
      </div>

      <div class="border-t border-border/50 divide-y divide-border/40">
        {#each topPosts as p, idx}
          <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 group">
            <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <span class="text-xs text-muted-foreground font-sans w-4 shrink-0">{idx + 1}</span>
              <div class="min-w-0 flex-1">
                <button
                  onclick={() => (postForModal = { id: p.id, title: p.title || p.slug })}
                  class="font-serif text-[15px] sm:text-[16px] font-normal tracking-tight text-foreground hover:text-primary transition-colors truncate block text-left w-full"
                >
                  {p.title || p.slug}
                </button>
                <div class="text-xs text-muted-foreground font-sans mt-0.5 truncate">{p.slug}</div>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs font-sans shrink-0 pl-6 sm:pl-0">
              <div class="flex items-center gap-3 text-muted-foreground">
                <span>{p.views || 0} reads</span>
                <span>{formatDuration(p.totalDuration || p.duration || 0)}</span>
              </div>
              <button
                onclick={() => (postForModal = { id: p.id, title: p.title || p.slug })}
                class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-colors ml-auto sm:ml-0"
                title="Telemetry details"
              >
                <HugeiconsIcon icon={Analytics01Icon} size={15} />
              </button>
            </div>
          </div>
        {/each}

        {#if topPosts.length === 0}
          <div class="py-12 text-center text-xs text-muted-foreground font-sans">
            No readership data collected for this range.
          </div>
        {/if}
      </div>
    </div>

    <!-- Reader Locations (1 col) -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-foreground">Top Locations</h2>
        <span class="text-xs text-muted-foreground font-sans">By session count</span>
      </div>

      <div class="border-t border-border/50 divide-y divide-border/40">
        {#each locations.slice(0, 8) as loc}
          <div class="py-2.5 flex items-center justify-between text-xs font-sans">
            <span class="text-foreground truncate max-w-[180px]">{loc.location || loc.country || 'Unknown'}</span>
            <span class="text-muted-foreground shrink-0">{loc.views || loc.count || 0} reads</span>
          </div>
        {/each}

        {#if locations.length === 0}
          <div class="py-12 text-center text-xs text-muted-foreground font-sans">
            No geographic telemetry for this range.
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Modal for drill-down post telemetry -->
{#if postForModal}
  <PostAnalyticsModal
    postId={postForModal.id}
    postTitle={postForModal.title}
    onClose={() => (postForModal = null)}
  />
{/if}

<style>
  .metric-scritto :global(scritto-text) {
    font-family: inherit !important;
    font-weight: inherit !important;
    letter-spacing: inherit !important;
  }
</style>
