<svelte:head>
  <title>Materio Account</title>
</svelte:head>

<script lang="ts">
  import { smoothCorners } from '@lisse/svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    HistoryIcon, 
    SparklesIcon, 
    File01Icon, 
    ArrowRight01Icon,
    Edit01Icon,
    CheckmarkBadge01Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createAvatar } from '@dicebear/core';
  import { lorelei } from '@dicebear/collection';
  import NumberPopIn from '$lib/components/NumberPopIn.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';
  import { pageCache } from '$lib/stores/cache';

  let streak = $state(0);
  let pdfsRead = $state(0);
  let readingTime = $state(0);
  let heatmapData = $state<Array<{date: Date, value: number}>>([]);
  let heatmapScrollContainer: HTMLElement | undefined = $state();

  $effect(() => {
    if (heatmapData.length > 0 && heatmapScrollContainer) {
      setTimeout(() => {
        if (heatmapScrollContainer) heatmapScrollContainer.scrollLeft = heatmapScrollContainer.scrollWidth;
      }, 50);
    }
  });

  let user = $state({
    id: '',
    username: '',
    displayName: '',
    email: '',
    profilePicture: '',
    plan: 'Basic'
  });
  let isLoadingUser = $state(true);

  let recentReads = $state<Array<{ name: string, time: string, meta: string }>>([]);

  let suggestions = $state([
    { name: 'Understanding Quantum Computing.pdf', meta: 'Popular in your org', pages: '45 pages' },
    { name: 'Modern CSS Layouts Cookbook.pdf', meta: 'Trending this week', pages: '120 pages' }
  ]);

  let dicebearAvatar = $derived(
    createAvatar(lorelei, {
      seed: user.displayName || user.username || 'User',
      size: 128,
      radius: 50,
      backgroundColor: ["FDFBF7", "F5F0E6"]
    }).toDataUri()
  );

  onMount(async () => {
    // Fetch User
    const token = localStorage.getItem('token');
    if (token) {
      const cached = pageCache.get<any>('overview');
      if (cached) {
        user = cached.user;
        streak = cached.streak;
        pdfsRead = cached.pdfsRead;
        readingTime = cached.readingTime;
        heatmapData = cached.heatmapData;
        recentReads = cached.recentReads;
        isLoadingUser = false;
        return;
      }

      try {
        const res = await fetch('/api/v2/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json() as any;
          user.id = data.user.id;
          user.username = data.user.username;
          user.displayName = data.user.displayName || '';
          user.email = data.user.email;
          user.profilePicture = data.user.profilePicture;
          user.plan = data.user.hasAdminPrivileges ? 'Super' : (data.user.isPlusUser ? 'Pro' : (data.user.isLiteUser ? 'Lite' : 'Basic'));

          // Fetch real stats
            try {
              const statsRes = await fetch(`https://materiosync.vercel.app/stats/${data.user.id}?period=all_time`);
              if (statsRes.ok) {
                const statsData = await statsRes.json() as any;
                pdfsRead = statsData.metrics?.pdfs_read_count || 0;
                let time = (statsData.metrics?.reading_time_seconds || 0) + (statsData.metrics?.engagement_time_seconds || 0);
                readingTime = time ? parseFloat((time / 3600).toFixed(1)) : 0;
                
                recentReads = (statsData.history || []).slice(0, 5).map((item: any) => {
                let name = item.title;
                if (!name || name === 'Unknown PDF' || name === 'PDF Document') {
                    try {
                        const urlParts = item.url.split('/');
                        const filename = urlParts[urlParts.length - 1];
                        name = decodeURIComponent(filename.replace('.pdf', '')).split('?')[0];
                        if (name.length > 30) name = name.substring(0, 27) + '...';
                    } catch (e) {
                        name = 'PDF Document';
                    }
                }
                let duration = item.duration || 0;
                let durationStr = '0m';
                if (duration < 60) durationStr = duration + 's';
                else if (duration < 3600) durationStr = Math.round(duration / 60) + 'm';
                else durationStr = (duration / 3600).toFixed(1) + 'h';

                return {
                  name,
                  time: new Date(item.date).toLocaleDateString(),
                  meta: `${durationStr} read`
                };
              });
            }
          } catch (e) {
            console.error("Failed to load stats", e);
          }

          // Fetch heatmap data
          try {
            const heatmapRes = await fetch('/api/v2/heatmap', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (heatmapRes.ok) {
              const heatmapJson = await heatmapRes.json() as any;
              if (heatmapJson.data) {
                heatmapData = heatmapJson.data.map((item: any) => ({
                  date: new Date(item.date),
                  value: item.value
                }));
                
                // Calculate streak based on continuous days logged
                let currentStreak = 0;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const activeDates = new Set(
                  heatmapData.filter(d => d.value > 0).map(d => {
                    const dObj = new Date(d.date);
                    return `${dObj.getFullYear()}-${dObj.getMonth()}-${dObj.getDate()}`;
                  })
                );

                let d = new Date(today);
                let dateString = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                if (!activeDates.has(dateString)) {
                  d.setDate(d.getDate() - 1);
                  dateString = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                }

                while (activeDates.has(dateString)) {
                  currentStreak++;
                  d.setDate(d.getDate() - 1);
                  dateString = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                }
                
                // Compulsorily require at least 2 consecutive days for a streak
                streak = currentStreak >= 2 ? currentStreak : 0;
                console.log("Calculated Streak:", streak, "from currentStreak:", currentStreak);
                console.log("Active Dates:", Array.from(activeDates));
              }
            } else {
              console.error("Heatmap API error:", await heatmapRes.text());
            }
          } catch (e) {
            console.error("Failed to load heatmap data", e);
          }

        } else if (res.status === 401) {
          localStorage.removeItem('token');
          goto('/login');
        }
      } catch (e) {
        console.error("Failed to load profile", e);
      } finally {
        isLoadingUser = false;
        if (user.id) {
          pageCache.set('overview', { 
            user: $state.snapshot(user), 
            streak, 
            pdfsRead, 
            readingTime, 
            heatmapData: $state.snapshot(heatmapData), 
            recentReads: $state.snapshot(recentReads) 
          });
        }
      }
    } else {
      goto('/login');
    }
  });
</script>

<!-- Open background grid for the top section (scaled down height) -->
<div class="absolute inset-x-0 top-0 h-48 z-0 bg-[linear-gradient(to_right,hsl(var(--muted-foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--muted-foreground))_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.12] pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent)]"></div>
<div class="absolute inset-x-0 top-0 h-48 z-0 pointer-events-none opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]">
  <div class="absolute top-[48px] left-[96px] w-[48px] h-[48px] bg-muted-foreground/30"></div>
  <div class="absolute top-[96px] left-[240px] w-[48px] h-[48px] bg-muted-foreground/30"></div>
  <div class="absolute top-[0px] right-[144px] w-[48px] h-[48px] bg-muted-foreground/30"></div>
</div>

<div class="relative z-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6 pt-8 pb-16">
  
  {#if !isLoadingUser}
    <!-- Open Profile Header (scaled down) -->
    <div class="flex flex-col items-start gap-3">
      <!-- Avatar -->
      <div class="relative w-20 h-20 rounded-full overflow-hidden shadow-sm flex items-center justify-center bg-background ring-4 ring-background">
        {#if user.profilePicture}
          <img src={user.profilePicture} alt="Avatar" class="w-full h-full object-cover" />
        {:else}
          <img src={dicebearAvatar} alt="Dicebear Avatar" class="w-full h-full object-cover" />
        {/if}
      </div>

      <!-- User Info -->
      <div class="space-y-0.5 mt-1">
        <div class="flex items-center gap-1.5">
          <h1 class="text-2xl font-bold text-foreground tracking-tight">
            {user.displayName || user.username || 'User'}
          </h1>
          <!-- Verification Badge -->
          {#if user.plan === 'Super'}
            <span title="Verified Super User"><HugeiconsIcon icon={CheckmarkBadge01Icon} size={20} class="text-[#800020]" /></span>
          {:else if user.plan === 'Pro'}
            <span title="Verified Pro User"><HugeiconsIcon icon={CheckmarkBadge01Icon} size={20} class="text-[#D4AF37]" /></span>
          {/if}
        </div>
        <!-- Align email/username below name -->
        <p class="text-muted-foreground font-medium text-[15px]">{user.email || '@' + user.username}</p>
      </div>

      <!-- Edit Icon / Action -->
      <div class="mt-1">
        <a href="/profile" class="inline-flex items-center gap-2 text-xs font-semibold text-foreground bg-card hover:bg-muted/50 border border-border/60 transition-colors rounded-xl px-3 py-1.5 shadow-sm">
          <HugeiconsIcon icon={Edit01Icon} size={14} />
          Edit Profile
        </a>
      </div>
    </div>
  {:else}
    <div class="h-[180px] rounded-2xl bg-muted/20 animate-pulse border border-border/40"></div>
  {/if}

  <!-- Stats Grid -->
  <div class="flex items-center justify-start gap-6 sm:gap-10 pt-2">
    <div class="flex flex-col items-center text-center min-w-[72px]">
      <div class="text-3xl font-bold tracking-tight text-foreground">
        <NumberPopIn value={pdfsRead} />
      </div>
      <div class="text-xs font-medium text-muted-foreground mt-1 text-center">PDFs Read</div>
    </div>
    
    <div class="w-px h-8 bg-border/80"></div>
    
    <div class="flex flex-col items-center text-center min-w-[72px]">
      <div class="text-3xl font-bold tracking-tight text-foreground">
        <NumberPopIn value={streak} />
      </div>
      <div class="text-xs font-medium text-muted-foreground mt-1 text-center">Day Streak</div>
    </div>
    
    <div class="w-px h-8 bg-border/80"></div>
    
    <div class="flex flex-col items-center text-center min-w-[72px]">
      <div class="text-3xl font-bold tracking-tight text-foreground flex items-baseline justify-center">
        <NumberPopIn value={readingTime} /><span class="text-xl ml-0.5 text-foreground">h</span>
      </div>
      <div class="text-xs font-medium text-muted-foreground mt-1 text-center">Reading Time</div>
    </div>
  </div>

  <!-- Heatmap -->
  {#if heatmapData.length > 0}
    <div class="pt-6 pb-2">
      <h3 class="font-semibold text-foreground text-sm mb-4">Activity</h3>
      <div class="w-full overflow-x-auto pb-2" bind:this={heatmapScrollContainer}>
        <div class="min-w-[600px]">
          <Heatmap 
            data={heatmapData} 
            emptyColor="hsl(var(--muted))" 
            fontColor="hsl(var(--muted-foreground))"
          />
        </div>
      </div>
    </div>
  {/if}

  <!-- Sections Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
    <!-- Recent Reads -->
    <div class="bg-card border border-border/60 p-5 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-3 mb-3">
        <HugeiconsIcon icon={HistoryIcon} size={16} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">Recent Reads</h3>
      </div>

      {#if recentReads.length === 0}
        <div class="py-10 text-center text-sm text-muted-foreground">No recent reading history.</div>
      {:else}
        <div class="space-y-3">
          {#each recentReads as read}
            <div class="flex items-center justify-between p-3 bg-muted/40 border border-border/50 rounded-xl hover:bg-muted/60 transition-colors group cursor-pointer">
              <div class="flex items-center gap-3 overflow-hidden">
                <HugeiconsIcon icon={File01Icon} size={16} class="text-primary shrink-0" />
                <div class="overflow-hidden">
                  <p class="font-medium text-[13px] text-foreground truncate group-hover:text-primary transition-colors">{read.name}</p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">{read.meta}</p>
                </div>
              </div>
              <span class="text-[10px] font-medium text-muted-foreground/80 shrink-0 bg-border/40 px-2 py-0.5 rounded-full">{read.time}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Suggested -->
    <div class="bg-card border border-border/60 p-5 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-3 mb-3">
        <HugeiconsIcon icon={SparklesIcon} size={16} class="text-primary" />
        <h3 class="font-semibold text-foreground text-sm">Suggested for You</h3>
      </div>

      <div class="space-y-3">
        {#each suggestions as suggest}
          <div class="flex items-center justify-between p-3 bg-muted/40 border border-border/50 rounded-xl hover:bg-muted/60 transition-colors group cursor-pointer">
            <div class="flex items-center gap-3 overflow-hidden">
              <HugeiconsIcon icon={File01Icon} size={16} class="text-primary shrink-0 animate-pulse" />
              <div class="overflow-hidden">
                <p class="font-medium text-[13px] text-foreground truncate group-hover:text-primary transition-colors">{suggest.name}</p>
                <p class="text-[11px] text-muted-foreground mt-0.5">{suggest.meta} • {suggest.pages}</p>
              </div>
            </div>
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} class="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
