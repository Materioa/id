<svelte:head>
  <title>Stats</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { UserGroupIcon, DocumentAttachmentIcon } from '@hugeicons/core-free-icons';
  import { fade } from 'svelte/transition';
  import Dropdown from '$lib/components/Dropdown.svelte';
  import { smoothCorners } from '@lisse/svelte';

  let topUsers = $state<any[]>([]);
  let topPdfs = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state('');

  let period = $state('all_time');
  let limit = $state('50');
  let pdfSearch = $state('');

  async function loadStats() {
    isLoading = true;
    error = '';
    try {
      const params = new URLSearchParams({
        period,
        limit: limit
      });
      if (pdfSearch) params.append('pdfSearch', pdfSearch);
      
      const data = await makeAdminRequest(`reading-insights?${params.toString()}`) as any;
      topUsers = data.top_users || [];
      topPdfs = data.top_pdfs || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadStats();
  });
</script>

<div class="space-y-6 max-w-6xl mx-auto" in:fade>
  <div class="flex flex-col sm:flex-row sm:sm:items-center items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">Reading Insights</h1>
      <p class="text-sm text-muted-foreground mt-1">View top readers and most popular materials.</p>
    </div>
    
    <div class="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
      <div class="w-full sm:w-40">
        <Dropdown 
          bind:value={period} 
          options={[
            { value: 'all_time', label: 'All Time' },
            { value: 'this_month', label: 'This Month' },
            { value: 'this_week', label: 'This Week' }
          ]}
        />
      </div>
      <div class="w-full sm:w-32">
        <Dropdown 
          bind:value={limit} 
          options={[
            { value: '10', label: 'Top 10' },
            { value: '20', label: 'Top 20' },
            { value: '50', label: 'Top 50' }
          ]}
        />
      </div>
    </div>
  </div>

  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-sm">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Top Readers -->
    <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px]">
      <div class="p-4 border-b border-border/50 bg-muted/20 flex items-center gap-3">
        <div class="p-2 bg-primary/10 text-primary rounded-lg">
          <HugeiconsIcon icon={UserGroupIcon} size={20} />
        </div>
        <h2 class="text-lg font-semibold">Top Readers</h2>
      </div>
      <div class="overflow-y-auto overflow-x-auto flex-1 w-full max-w-[100vw]">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted/50 text-muted-foreground sticky top-0 border-b border-border/50">
            <tr>
              <th class="px-4 py-3 font-medium">#</th>
              <th class="px-4 py-3 font-medium">User</th>
              <th class="px-4 py-3 font-medium text-right">PDFs Read</th>
              <th class="px-4 py-3 font-medium text-right">Time Spent</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/50">
            {#if isLoading}
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">Loading stats...</td>
              </tr>
            {:else if topUsers.length === 0}
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-muted-foreground">No reading data available.</td>
              </tr>
            {:else}
              {#each topUsers as user, i}
                <tr class="hover:bg-muted/30 transition-colors whitespace-nowrap">
                  <td class="px-4 py-3 font-medium text-muted-foreground tabular-nums">{i + 1}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col">
                      <span class="font-medium">{user.full_name || 'Anonymous User'}</span>
                      <span class="text-xs text-muted-foreground">{user.email || 'No email'}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right font-medium tabular-nums">{user.pdfs_read || 0}</td>
                  <td class="px-4 py-3 text-right text-muted-foreground tabular-nums">{Math.round((user.time_spent || 0) / 60)} min</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top PDFs -->
    <div class="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px]">
      <div class="p-4 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <HugeiconsIcon icon={DocumentAttachmentIcon} size={20} />
          </div>
          <h2 class="text-lg font-semibold">Top Materials</h2>
        </div>
        <div class="w-full sm:w-auto">
          <input 
            type="text" 
            placeholder="Search PDFs..." 
            bind:value={pdfSearch}
            onkeydown={(e) => e.key === 'Enter' && loadStats()}
            class="w-full sm:w-48 bg-background border border-input rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>
      <div class="overflow-y-auto overflow-x-auto flex-1 w-full max-w-[100vw]">
        <table class="w-full text-sm text-left">
          <thead class="bg-muted/50 text-muted-foreground sticky top-0 border-b border-border/50">
            <tr>
              <th class="px-4 py-3 font-medium">#</th>
              <th class="px-4 py-3 font-medium">Material Title</th>
              <th class="px-4 py-3 font-medium text-right">Reads</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/50">
            {#if isLoading}
              <tr>
                <td colspan="3" class="px-4 py-8 text-center text-muted-foreground">Loading stats...</td>
              </tr>
            {:else if topPdfs.length === 0}
              <tr>
                <td colspan="3" class="px-4 py-8 text-center text-muted-foreground">No material data available.</td>
              </tr>
            {:else}
              {#each topPdfs as pdf, i}
                <tr class="hover:bg-muted/30 transition-colors whitespace-nowrap">
                  <td class="px-4 py-3 font-medium text-muted-foreground tabular-nums">{i + 1}</td>
                  <td class="px-4 py-3">
                    <span class="font-medium break-all">{pdf.title || 'Unknown Material'}</span>
                  </td>
                  <td class="px-4 py-3 text-right font-medium tabular-nums">{pdf.read_count || 0}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
