<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Image01Icon } from '@hugeicons/core-free-icons';

  let { images = [], alt = '' }: { images: string[]; alt?: string } = $props();

  // Deduplicate, filter empties, cap at 3 unique images
  const validImages = $derived(
    Array.from(
      new Set(
        (images || [])
          .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
          .map((img) => img.trim())
      )
    ).slice(0, 3)
  );

  const count = $derived(validImages.length);
</script>

<div class="relative w-14 h-9.5 shrink-0 flex items-center justify-center select-none pointer-events-none overflow-visible">
  {#if count === 0}
    <!-- No images: flat placeholder -->
    <div class="w-full h-full rounded-[3px] bg-white dark:bg-zinc-900 p-[2px] shadow-xs border border-black/15 dark:border-white/20 flex items-center justify-center">
      <div class="w-full h-full rounded-[1.5px] bg-muted/30 flex items-center justify-center text-muted-foreground/40">
        <HugeiconsIcon icon={Image01Icon} size={14} />
      </div>
    </div>

  {:else if count === 1}
    <!-- 1 image: single card, slight lift on hover -->
    <div
      class="w-full h-full rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] group-hover:-translate-y-0.5 group-hover:shadow-md"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={validImages[0]}
          {alt}
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>

  {:else if count === 2}
    <!-- 2 images: 2-card fan -->
    <!-- Back card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-5 translate-x-1.5 -translate-y-1 group-hover:rotate-[14deg] group-hover:translate-x-5 group-hover:-translate-y-2.5 group-hover:scale-105 group-hover:shadow-md z-[1]"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={validImages[1]}
          alt=""
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
    <!-- Front card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-sm border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] -rotate-1 translate-y-0.5 group-hover:-rotate-[6deg] group-hover:-translate-x-3.5 group-hover:translate-y-2.5 group-hover:scale-110 group-hover:shadow-xl z-[2]"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={validImages[0]}
          {alt}
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>

  {:else}
    <!-- 3 images: 3-card spread fan -->
    <!-- Far back-left card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] -rotate-5 -translate-x-1.5 -translate-y-1.5 group-hover:-rotate-[16deg] group-hover:-translate-x-6 group-hover:-translate-y-3 group-hover:scale-105 group-hover:shadow-md z-[1]"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={validImages[2]}
          alt=""
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
    <!-- Back-right card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-xs border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-5 translate-x-1.5 -translate-y-1 group-hover:rotate-[16deg] group-hover:translate-x-6 group-hover:-translate-y-2.5 group-hover:scale-105 group-hover:shadow-md z-[2]"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={validImages[1]}
          alt=""
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
    <!-- Front card -->
    <div
      class="absolute inset-0 rounded-[3px] bg-white p-[2px] shadow-sm border border-black/25 dark:border-white/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rotate-0 translate-y-0.5 group-hover:rotate-[2deg] group-hover:translate-y-3 group-hover:scale-110 group-hover:shadow-xl z-[3]"
      style="transform-origin: center center;"
    >
      <div class="w-full h-full rounded-[1.5px] overflow-hidden bg-zinc-800">
        <img
          src={validImages[0]}
          {alt}
          loading="lazy"
          onerror={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          class="w-full h-full object-cover"
        />
      </div>
    </div>
  {/if}
</div>
