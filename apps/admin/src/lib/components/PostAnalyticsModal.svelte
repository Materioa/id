<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import D3AreaChart from './D3AreaChart.svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Cancel01Icon,
    Alert02Icon,
    RefreshIcon
  } from '@hugeicons/core-free-icons';

  let { postId, postTitle, onClose }: { postId: string; postTitle: string; onClose: () => void } = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let analyticsData = $state<any>(null);

  async function fetchAnalytics() {
    try {
      loading = true;
      error = null;
      const res = await fetch(`/api/analytics/post?postId=${postId}&days=14`);
      if (!res.ok) {
        throw new Error(`Failed to load analytics: ${res.statusText}`);
      }
      analyticsData = await res.json();
    } catch (err: any) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function formatDuration(seconds: number) {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  onMount(() => {
    fetchAnalytics();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  });

  function portal(node: HTMLElement) {
    if (typeof document !== 'undefined') {
      document.body.appendChild(node);
      return {
        destroy() {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }
      };
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row sm:items-center sm:justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm"
  onclick={onClose}
  use:portal
  transition:fade={{ duration: 150 }}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="bg-background text-foreground border-t sm:border border-border rounded-t-2xl sm:rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Grab handle for mobile bottom sheet -->
    <div class="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2.5 -mb-1 shrink-0 sm:hidden"></div>

    <!-- Modal Header -->
    <div class="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-border/50 flex items-center justify-between shrink-0">
      <div class="min-w-0 pr-4">
        <h2 class="text-xl font-serif font-normal tracking-tight truncate">{postTitle}</h2>
        <p class="text-xs text-muted-foreground mt-0.5">Readership telemetry for the past 14 days</p>
      </div>
      <button
        class="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
        onclick={onClose}
        title="Close"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={18} />
      </button>
    </div>

    <!-- Modal Body -->
    <div class="p-5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-16 space-y-3">
          <HugeiconsIcon icon={RefreshIcon} size={20} class="animate-spin text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Loading telemetry...</p>
        </div>
      {:else if error}
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <HugeiconsIcon icon={Alert02Icon} size={22} class="text-destructive mb-2" />
          <p class="text-xs text-destructive mb-3">{error}</p>
          <button
            class="btn-base btn-secondary text-xs px-3 py-1.5"
            onclick={fetchAnalytics}
          >
            Retry
          </button>
        </div>
      {:else if analyticsData}
        <!-- Key Metrics -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div>
            <div class="text-2xl font-serif font-normal tracking-tight text-foreground">
              {analyticsData.stats.totalViews}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">Total views</div>
          </div>

          <div>
            <div class="text-2xl font-serif font-normal tracking-tight text-foreground">
              {formatDuration(analyticsData.stats.totalDuration)}
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">Time reading</div>
          </div>

          <div>
            <div class="text-2xl font-serif font-normal tracking-tight text-foreground">
              {Math.round(analyticsData.stats.avgScrollDepth || 0)}%
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">Avg completion</div>
          </div>

          <div>
            <div class="text-2xl font-serif font-normal tracking-tight text-foreground">
              {analyticsData.stats.retentionRate}%
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">Retention rate</div>
          </div>
        </div>

        <!-- 14-day Timeline Chart -->
        <div class="pt-4 border-t border-border/50 space-y-2">
          <div class="text-xs font-medium text-foreground">Daily Activity</div>
          <D3AreaChart data={analyticsData.timeline} height={180} />
        </div>

        <!-- Geographic & Interaction Breakdown -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/50">
          <!-- Readers Geography -->
          <div class="space-y-2">
            <div class="text-xs font-medium text-foreground">Top Locations</div>
            {#if analyticsData.locations?.length}
              <div class="border-t border-border/50 divide-y divide-border/40 max-h-48 overflow-y-auto">
                {#each analyticsData.locations as loc}
                  <div class="py-2 flex items-center justify-between text-xs">
                    <span class="text-foreground truncate max-w-[200px]">
                      {loc.city && loc.city !== 'Unknown' ? `${loc.city}, ` : ''}{loc.country || 'Global Reader'}
                    </span>
                    <span class="font-mono text-muted-foreground">{loc.views} views</span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-muted-foreground py-4">No location telemetry available.</p>
            {/if}
          </div>

          <!-- Click / Engagement Points -->
          <div class="space-y-2">
            <div class="text-xs font-medium text-foreground">Top Clicked Elements</div>
            {#if analyticsData.clicks?.length}
              <div class="border-t border-border/50 divide-y divide-border/40 max-h-48 overflow-y-auto">
                {#each analyticsData.clicks as click}
                  <div class="py-2 flex items-center justify-between text-xs">
                    <span class="text-foreground truncate max-w-[200px]" title={click.label || click.elementId}>
                      {click.label || click.elementId || 'Action'}
                    </span>
                    <span class="font-mono text-muted-foreground">{click.count} clicks</span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-muted-foreground py-4">No interaction events logged.</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Modal Footer -->
    <div class="px-6 py-3 border-t border-border/50 flex items-center justify-end shrink-0">
      <button
        class="btn-base btn-secondary text-xs px-3 py-1.5"
        onclick={onClose}
      >
        Close
      </button>
    </div>
  </div>
</div>
