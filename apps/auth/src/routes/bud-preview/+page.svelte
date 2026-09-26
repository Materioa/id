<script lang="ts">
  import BudReader from '@materio/ui/components/BudReader.svelte';
  import BudDoesThings from '@materio/ui/components/BudDoesThings.svelte';
  import BudWorksOnLaptop from '@materio/ui/components/BudWorksOnLaptop.svelte';
  import DayWithBud from '@materio/ui/components/DayWithBud.svelte';
  import BudLogo from '@materio/ui/components/BudLogo.svelte';

  // Active view tab
  let activeTab = $state<"does-things" | "reader" | "works" | "day">("does-things");

  // BudReader State
  let budReaderRef = $state<any>();
  let autoFlip = $state(true);
  let interactive = $state(true);
  let readingSpeed = $state(1.0);
  let flipInterval = $state(4500);
  let lastFlipDirection = $state<string | null>(null);
  let flipCount = $state(0);

  // BudDoesThings State
  let budDoesThingsRef = $state<any>();
  let doesThingsActivity = $state<"auto" | "reading" | "drinking" | "sleeping">("auto");
  let doesThingsSpeed = $state(1.0);
  let doesThingsInteractive = $state(true);
  let doesThingsAutoCycle = $state(true);
  let doesThingsShowDesk = $state(true);
  let currentAction = $state<"reading" | "drinking" | "sleeping">("reading");

  // BudWorksOnLaptop State
  let budWorksRef = $state<any>();
  let worksActivity = $state<"auto" | "working" | "drinking" | "sleeping">("auto");
  let worksSpeed = $state(1.0);
  let worksInteractive = $state(true);
  let worksAutoCycle = $state(true);
  let worksShowDesk = $state(true);
  let worksAction = $state<"working" | "drinking" | "sleeping">("working");

  // DayWithBud State
  let dayPhaseDuration = $state(5200);
  let daySpeed = $state(1.0);
  let dayInteractive = $state(true);
  let dayAutoPlay = $state(true);
  let dayPhaseLabel = $state("—");

  function handleFlip(direction: "next" | "prev") {
    lastFlipDirection = direction;
    flipCount++;
  }
</script>

<svelte:head>
  <title>Bud Interactive Showcase</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center p-8">
  <header class="text-center max-w-lg mb-8">
    <h1 class="text-2xl font-semibold tracking-tight text-white mb-2">Bud Interactive Components</h1>
    <p class="text-neutral-400 text-xs leading-relaxed">
      Authentic hand-drawn vectors with responsive eye saccades, coffee aroma savoring, sleep cycles, and 3D leaf turns.
    </p>

    <!-- Component Tab Switcher (No emojis, clean icons) -->
    <div class="inline-flex p-1 bg-neutral-900 border border-neutral-800 rounded-xl mt-4 shadow-md">
      <button
        onclick={() => activeTab = "does-things"}
        class="px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 {activeTab === 'does-things' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
          <line x1="6" y1="1" x2="6" y2="4"></line>
          <line x1="10" y1="1" x2="10" y2="4"></line>
          <line x1="14" y1="1" x2="14" y2="4"></line>
        </svg>
        <span>BudDoesThings</span>
      </button>
      <button
        onclick={() => activeTab = "reader"}
        class="px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 {activeTab === 'reader' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        <span>BudReader</span>
      </button>
      <button
        onclick={() => activeTab = "works"}
        class="px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 {activeTab === 'works' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="21" x2="22" y2="21"></line>
        </svg>
        <span>BudWorks</span>
      </button>
      <button
        onclick={() => activeTab = "day"}
        class="px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 {activeTab === 'day' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
        </svg>
        <span>DayWithBud</span>
      </button>
    </div>
  </header>

  <!-- ================================================================= -->
  <!-- TAB 1: BudDoesThings                                              -->
  <!-- ================================================================= -->
  {#if activeTab === "does-things"}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
      <!-- Main Display Card -->
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col items-center relative shadow-xl">
        <!-- Status Indicator Badge (Icon only, no emoji) -->
        <div class="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-950 flex items-center gap-2 text-neutral-300">
          {#if currentAction === 'drinking'}
            <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span>Savoring Coffee Aroma</span>
          {:else if currentAction === 'sleeping'}
            <svg class="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Resting</span>
          {:else}
            <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>Reading</span>
          {/if}
        </div>

        <div class="my-6 flex items-center justify-center min-h-[300px] w-full max-w-[340px] bg-neutral-950/60 rounded-xl border border-neutral-800/60 p-6 overflow-visible">
          <BudDoesThings
            bind:this={budDoesThingsRef}
            class="w-64 h-64 text-white"
            activity={doesThingsActivity}
            speed={doesThingsSpeed}
            interactive={doesThingsInteractive}
            autoCycle={doesThingsAutoCycle}
            showDesk={doesThingsShowDesk}
            onactivitychange={(act) => currentAction = act}
            onflip={handleFlip}
          />
        </div>

        <!-- Quick Actions Row -->
        <div class="w-full grid grid-cols-3 gap-2 mb-3">
          <button
            onclick={() => {
              doesThingsActivity = "drinking";
              budDoesThingsRef?.takeCoffeeBreak();
            }}
            class="px-3 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center justify-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span>Drink Coffee</span>
          </button>
          <button
            onclick={() => {
              doesThingsActivity = "sleeping";
              budDoesThingsRef?.takeNap();
            }}
            class="px-3 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center justify-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Take Nap</span>
          </button>
          <button
            onclick={() => {
              doesThingsActivity = "reading";
              budDoesThingsRef?.readBook();
            }}
            class="px-3 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center justify-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>Read Book</span>
          </button>
        </div>

        <div class="text-[11px] text-neutral-400 text-center">
          Click the coffee mug to drink, or click the book pages to turn.
        </div>
      </div>

      <!-- Controls Card -->
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Mode</h2>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button
              onclick={() => doesThingsActivity = "auto"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {doesThingsActivity === 'auto' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium flex items-center gap-1.5">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>Autonomous</span>
              </div>
              <div class="text-[11px] text-neutral-500 mt-1">Cycles between reading, coffee, and rest</div>
            </button>
            <button
              onclick={() => doesThingsActivity = "drinking"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {doesThingsActivity === 'drinking' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium flex items-center gap-1.5">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                </svg>
                <span>Coffee Ritual</span>
              </div>
              <div class="text-[11px] text-neutral-500 mt-1">Savoring aroma from steaming cup</div>
            </button>
            <button
              onclick={() => doesThingsActivity = "sleeping"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {doesThingsActivity === 'sleeping' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium flex items-center gap-1.5">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span>Sleeping</span>
              </div>
              <div class="text-[11px] text-neutral-500 mt-1">Restful breathing with subtle Z's</div>
            </button>
            <button
              onclick={() => doesThingsActivity = "reading"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {doesThingsActivity === 'reading' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium flex items-center gap-1.5">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span>Focused Reader</span>
              </div>
              <div class="text-[11px] text-neutral-500 mt-1">Dedicated page scanning & flips</div>
            </button>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Behaviors</h2>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={doesThingsInteractive} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {doesThingsInteractive ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if doesThingsInteractive}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Interactive Cursor Tracking</div>
                <div class="text-[10px] text-neutral-400">Head and eyes curiously follow pointer; nudging wakes Bud</div>
              </div>
            </label>

            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={doesThingsAutoCycle} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {doesThingsAutoCycle ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if doesThingsAutoCycle}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Autonomous Activity Switching</div>
                <div class="text-[10px] text-neutral-400">Bud organically cycles between reading, coffee breaks, and naps</div>
              </div>
            </label>

            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={doesThingsShowDesk} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {doesThingsShowDesk ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if doesThingsShowDesk}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Show Desk & Saucer Surface</div>
                <div class="text-[10px] text-neutral-400">Grounds book and saucer on a shared table plane</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Speed</h2>
          <div class="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-neutral-300">Playback Rate</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700">{doesThingsSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              bind:value={doesThingsSpeed}
              class="w-full accent-neutral-200 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-neutral-500">
              <span>0.4x</span>
              <span>1.0x</span>
              <span>2.5x</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Family</h2>
          <div class="grid grid-cols-3 gap-2 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/60 text-center">
            <div class="flex flex-col items-center gap-1">
              <BudLogo class="w-14 h-14 text-white" />
              <span class="text-[11px] text-neutral-400">BudLogo</span>
              <span class="text-[9px] text-neutral-500">Logo</span>
            </div>
            <div class="flex flex-col items-center gap-1 border-x border-neutral-800/60 px-1">
              <BudReader class="w-14 h-14 text-white" />
              <span class="text-[11px] text-neutral-300 font-medium">BudReader</span>
              <span class="text-[9px] text-neutral-500">Reading</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <BudDoesThings class="w-14 h-14 text-white" activity="auto" />
              <span class="text-[11px] text-neutral-200 font-medium">BudDoesThings</span>
              <span class="text-[9px] text-neutral-500">Coffee + Nap</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- ================================================================= -->
  <!-- TAB 2: BudReader                                                  -->
  <!-- ================================================================= -->
  {:else if activeTab === "reader"}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
      <!-- Main Reader Card -->
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col items-center relative shadow-xl">
        <div class="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-950 flex items-center gap-2 text-neutral-300">
          <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <span>Active Reader</span>
        </div>

        <div class="my-6 flex items-center justify-center min-h-[300px] w-full max-w-[340px] bg-neutral-950/60 rounded-xl border border-neutral-800/60 p-6 overflow-visible">
          <BudReader
            bind:this={budReaderRef}
            class="w-56 h-60 text-white"
            {autoFlip}
            {interactive}
            {readingSpeed}
            {flipInterval}
            onflip={handleFlip}
          />
        </div>

        <div class="w-full flex items-center justify-center gap-3 mb-4">
          <button
            onclick={() => budReaderRef?.flipPage("prev")}
            class="px-3.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center gap-1.5"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Prev Page</span>
          </button>
          <button
            onclick={() => budReaderRef?.flipPage("next")}
            class="px-3.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-xs font-medium text-white transition cursor-pointer border border-neutral-700/60 flex items-center gap-1.5"
          >
            <span>Next Page</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div class="text-[11px] text-neutral-400 text-center">
          Click the left or right page to turn.
        </div>
        {#if lastFlipDirection}
          <div class="mt-2 text-[11px] text-neutral-400 font-mono">
            Last turn: {lastFlipDirection} ({flipCount})
          </div>
        {/if}
      </div>

      <!-- Settings Card -->
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Comparison</h2>
          <div class="grid grid-cols-3 gap-2 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/60 text-center">
            <div class="flex flex-col items-center gap-2">
              <BudLogo class="w-14 h-14 text-white" />
              <span class="text-[11px] text-neutral-400">BudLogo</span>
            </div>
            <div class="flex flex-col items-center gap-2 border-x border-neutral-800/60 px-1">
              <img src="/bud.svg" alt="Static bud.svg" class="w-14 h-14 object-contain filter invert" />
              <span class="text-[11px] text-neutral-400">bud.svg</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <BudReader class="w-14 h-14 text-white" {autoFlip} {interactive} {readingSpeed} />
              <span class="text-[11px] text-neutral-200 font-medium">BudReader</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Behaviors</h2>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={interactive} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {interactive ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if interactive}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Interactive Cursor Tracking</div>
                <div class="text-[10px] text-neutral-400">Head and eyes react curiously when pointer enters reading zone</div>
              </div>
            </label>

            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={autoFlip} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {autoFlip ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if autoFlip}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Auto Page Turn</div>
                <div class="text-[10px] text-neutral-400">Automatically executes 3D leaf flip after scanning 3 lines</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Speed Controller</h2>
          <div class="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-neutral-300">Reading Rate</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700">
                {readingSpeed.toFixed(1)}x ({(1300 / readingSpeed).toFixed(0)} ms/line)
              </span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              bind:value={readingSpeed}
              class="w-full accent-neutral-200 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-neutral-500">
              <span>0.4x</span>
              <span>1.0x</span>
              <span>2.5x</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Scales</h2>
          <div class="flex items-end justify-around p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/60">
            <div class="flex flex-col items-center gap-1">
              <BudReader class="w-10 h-10 text-white" {readingSpeed} />
              <span class="text-[10px] text-neutral-500">w-10</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <BudReader class="w-14 h-14 text-white" {readingSpeed} />
              <span class="text-[10px] text-neutral-500">w-14</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <BudReader class="w-20 h-20 text-white" {readingSpeed} />
              <span class="text-[10px] text-neutral-500">w-20</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- ================================================================= -->
  <!-- TAB 3: BudWorksOnLaptop                                           -->
  <!-- ================================================================= -->
  {:else if activeTab === "works"}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
      <!-- Main Display Card -->
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col items-center relative shadow-xl">
        <div class="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-950 flex items-center gap-2 text-neutral-300">
          {#if worksAction === 'drinking'}
            <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span>Sipping Coffee</span>
          {:else if worksAction === 'sleeping'}
            <svg class="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Resting</span>
          {:else}
            <svg class="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"></rect>
              <line x1="2" y1="21" x2="22" y2="21"></line>
            </svg>
            <span>Working</span>
          {/if}
        </div>

        <div class="my-6 flex items-center justify-center min-h-[300px] w-full max-w-[340px] bg-neutral-950/60 rounded-xl border border-neutral-800/60 p-6 overflow-visible">
          <BudWorksOnLaptop
            bind:this={budWorksRef}
            class="w-64 h-64 text-white"
            activity={worksActivity}
            speed={worksSpeed}
            interactive={worksInteractive}
            autoCycle={worksAutoCycle}
            showDesk={worksShowDesk}
            onactivitychange={(act) => worksAction = act}
          />
        </div>

        <div class="w-full grid grid-cols-3 gap-2 mb-3">
          <button
            onclick={() => {
              worksActivity = "working";
              budWorksRef?.startWorking();
            }}
            class="px-3 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center justify-center gap-1.5"
          >
            <span>Do Work</span>
          </button>
          <button
            onclick={() => {
              worksActivity = "drinking";
              budWorksRef?.takeCoffeeBreak();
            }}
            class="px-3 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center justify-center gap-1.5"
          >
            <span>Drink Coffee</span>
          </button>
          <button
            onclick={() => {
              worksActivity = "sleeping";
              budWorksRef?.takeNap();
            }}
            class="px-3 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60 flex items-center justify-center gap-1.5"
          >
            <span>Take Nap</span>
          </button>
        </div>

        <div class="text-[11px] text-neutral-400 text-center">
          Click the laptop to refocus on work, the mug to drink, Bud to wake.
        </div>
      </div>

      <!-- Controls Card -->
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Mode</h2>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <button
              onclick={() => worksActivity = "auto"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {worksActivity === 'auto' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium"><span>Autonomous</span></div>
              <div class="text-[11px] text-neutral-500 mt-1">Cycles between work, coffee, and rest</div>
            </button>
            <button
              onclick={() => worksActivity = "working"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {worksActivity === 'working' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium"><span>Deep Work</span></div>
              <div class="text-[11px] text-neutral-500 mt-1">Typing behind the lid, gaze down at screen</div>
            </button>
            <button
              onclick={() => worksActivity = "drinking"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {worksActivity === 'drinking' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium"><span>Coffee Ritual</span></div>
              <div class="text-[11px] text-neutral-500 mt-1">Lifts mug, sips, sets it back down</div>
            </button>
            <button
              onclick={() => worksActivity = "sleeping"}
              class="p-2.5 rounded-lg border text-left transition cursor-pointer {worksActivity === 'sleeping' ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-neutral-200'}"
            >
              <div class="font-medium"><span>Sleeping</span></div>
              <div class="text-[11px] text-neutral-500 mt-1">Head onto laptop with drifting Z's</div>
            </button>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Behaviors</h2>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={worksInteractive} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {worksInteractive ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if worksInteractive}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Interactive Cursor Tracking</div>
                <div class="text-[10px] text-neutral-400">Head and eyes follow pointer; nudging wakes Bud</div>
              </div>
            </label>

            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={worksAutoCycle} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {worksAutoCycle ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if worksAutoCycle}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Autonomous Activity Switching</div>
                <div class="text-[10px] text-neutral-400">Bud cycles between work, coffee breaks, and naps</div>
              </div>
            </label>

            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={worksShowDesk} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {worksShowDesk ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if worksShowDesk}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Show Desk & Saucer Surface</div>
                <div class="text-[10px] text-neutral-400">Grounds laptop and saucer on a shared table plane</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Speed</h2>
          <div class="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-neutral-300">Playback Rate</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700">{worksSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              bind:value={worksSpeed}
              class="w-full accent-neutral-200 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-neutral-500">
              <span>0.4x</span>
              <span>1.0x</span>
              <span>2.5x</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Family</h2>
          <div class="grid grid-cols-4 gap-2 p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/60 text-center">
            <div class="flex flex-col items-center gap-1">
              <BudLogo class="w-12 h-12 text-white" />
              <span class="text-[10px] text-neutral-400">BudLogo</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <BudReader class="w-12 h-12 text-white" />
              <span class="text-[10px] text-neutral-400">BudReader</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <BudDoesThings class="w-12 h-12 text-white" activity="auto" />
              <span class="text-[10px] text-neutral-400">DoesThings</span>
            </div>
            <div class="flex flex-col items-center gap-1">
              <BudWorksOnLaptop class="w-12 h-12 text-white" activity="auto" />
              <span class="text-[10px] text-neutral-200 font-medium">BudWorks</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- ================================================================= -->
  <!-- TAB 4: DayWithBud                                                 -->
  <!-- ================================================================= -->
  {:else if activeTab === "day"}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col items-center relative shadow-xl">
        <div class="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-950 flex items-center gap-2 text-neutral-300">
          <span>Day cycle: {dayPhaseLabel}</span>
        </div>

        <div class="my-6 flex items-center justify-center min-h-[300px] w-full max-w-[340px] bg-neutral-950/60 rounded-xl border border-neutral-800/60 p-6 overflow-visible">
          <DayWithBud
            class="w-full"
            autoPlay={dayAutoPlay}
            phaseDuration={dayPhaseDuration}
            speed={daySpeed}
            interactive={dayInteractive}
            showTimeline={true}
            showCaption={true}
            showControls={true}
            onphasechange={(phase) => dayPhaseLabel = phase.label}
          />
        </div>

        <div class="text-[11px] text-neutral-400 text-center">
          Coffee → Deep work → Reading → Nap → Idle, one continuous scene — props morph in and out.
        </div>
      </div>

      <div class="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Day Cycle</h2>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={dayAutoPlay} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {dayAutoPlay ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if dayAutoPlay}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Autoplay Day</div>
                <div class="text-[10px] text-neutral-400">Advance coffee → work → reading → nap → idle</div>
              </div>
            </label>

            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-800 cursor-pointer hover:bg-neutral-800/60 transition select-none">
              <input type="checkbox" bind:checked={dayInteractive} class="sr-only" />
              <div class="w-4 h-4 rounded border flex items-center justify-center transition {dayInteractive ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-neutral-700 bg-neutral-900'}">
                {#if dayInteractive}
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {/if}
              </div>
              <div class="text-xs">
                <div class="font-medium text-neutral-200">Interactive Cursor Tracking</div>
                <div class="text-[10px] text-neutral-400">Each moment follows the pointer like the standalone parts</div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Phase Length</h2>
          <div class="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-neutral-300">Seconds per moment</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700">{(dayPhaseDuration / 1000).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="2500"
              max="10000"
              step="100"
              bind:value={dayPhaseDuration}
              class="w-full accent-neutral-200 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-neutral-500">
              <span>2.5s</span>
              <span>5.2s</span>
              <span>10s</span>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Speed</h2>
          <div class="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-neutral-300">Playback Rate</span>
              <span class="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-700">{daySpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              bind:value={daySpeed}
              class="w-full accent-neutral-200 cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-neutral-500">
              <span>0.4x</span>
              <span>1.0x</span>
              <span>2.5x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
