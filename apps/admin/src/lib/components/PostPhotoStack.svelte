<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Image01Icon } from '@hugeicons/core-free-icons';

  let { images = [], alt = '' }: { images: string[]; alt?: string } = $props();

  // Take up to 3 images for the visual fan stack
  const stackImages = $derived((images || []).filter(Boolean).slice(0, 3));
</script>

<div class="relative w-14 h-9.5 shrink-0 flex items-center justify-center select-none pointer-events-none overflow-visible">
  {#if stackImages.length >= 3}
    <!-- Card 3 (furthest back - fans top-left on hover) -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] -rotate-4 -translate-x-1 -translate-y-1 group-hover:-rotate-10 group-hover:-translate-x-4.5 group-hover:-translate-y-2.5 group-hover:shadow-md"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={stackImages[2]}
          alt=""
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>

    <!-- Card 2 (middle - fans top-right on hover) -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-4 translate-x-1 -translate-y-0.5 group-hover:rotate-10 group-hover:translate-x-3.5 group-hover:-translate-y-2 group-hover:shadow-md"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={stackImages[1]}
          alt=""
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>

    <!-- Card 1 (front - drops down and tilts right, revealing back cards) -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-sm border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-0 translate-y-0.5 group-hover:translate-x-1.5 group-hover:translate-y-2.5 group-hover:rotate-5 group-hover:scale-105 group-hover:shadow-lg"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={stackImages[0]}
          {alt}
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
  {:else if stackImages.length === 2}
    <!-- Card 2 (back - fans top-left on hover) -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] -rotate-3 -translate-x-0.5 -translate-y-0.5 group-hover:-rotate-8 group-hover:-translate-x-4.5 group-hover:-translate-y-2.5 group-hover:shadow-md"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={stackImages[1]}
          alt=""
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>

    <!-- Card 1 (front - drops down-right on hover) -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-sm border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-2 translate-x-0.5 translate-y-0.5 group-hover:rotate-6 group-hover:translate-x-1.5 group-hover:translate-y-2.5 group-hover:scale-105 group-hover:shadow-lg"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={stackImages[0]}
          {alt}
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
  {:else if stackImages.length === 1}
    <!-- Single card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-sm border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-0 group-hover:scale-105 group-hover:-rotate-2 group-hover:shadow-md"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={stackImages[0]}
          {alt}
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
  {:else}
    <!-- Empty placeholder card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/20 dark:border-white/20 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
    >
      <div class="w-full h-full rounded-[1.5px] bg-muted/40 flex items-center justify-center text-muted-foreground/40">
        <HugeiconsIcon icon={Image01Icon} size={14} />
      </div>
    </div>
  {/if}
</div>
