<svelte:head>
  <title>Splash Preview — Materio ID</title>
</svelte:head>

<script lang="ts">
  import SplashScreen from "@materio/ui/components/SplashScreen.svelte";

  let runId = $state(0);
  let bud = $state<"does-things" | "day">("day");
  let shuffleMs = $state(5000);
  let finished = $state(false);

  function replay() {
    finished = false;
    runId++;
  }
</script>

{#key runId}
  <SplashScreen
    {bud}
    {shuffleMs}
    ondone={() => (finished = true)}
  />
{/key}

<!-- Preview controls (not part of the splash itself) -->
<div class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/85 px-3 py-2 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/60">
  <button
    type="button"
    onclick={replay}
    class="cursor-pointer rounded-full bg-[#a34914] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#c05a1e]"
  >
    Replay
  </button>
  <button
    type="button"
    onclick={() => { bud = bud === "day" ? "does-things" : "day"; replay(); }}
    class="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
  >
    Bud: {bud === "day" ? "DayWithBud" : "BudDoesThings"}
  </button>
  <label class="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
    Shuffle
    <input
      type="range"
      min="800"
      max="8000"
      step="100"
      bind:value={shuffleMs}
      onchange={replay}
      class="w-24 accent-[#c05a1e]"
    />
    {(shuffleMs / 1000).toFixed(1)}s
  </label>
  {#if finished}
    <span class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      settled
    </span>
  {/if}
</div>
