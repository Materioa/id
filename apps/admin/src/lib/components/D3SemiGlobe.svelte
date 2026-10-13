<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';

  export type LocationPoint = {
    id?: string;
    city: string;
    region?: string;
    country: string;
    coordinates: [number, number]; // [lon, lat]
    users: number;
    views: number;
    readingHours?: number;
    isRealtime?: boolean;
    color?: 'green' | 'blue';
  };

  let {
    locations = [],
    height = 460,
    selectedCity = $bindable(null),
    onselect = undefined
  }: {
    locations?: LocationPoint[];
    height?: number;
    selectedCity?: string | null;
    onselect?: (loc: LocationPoint | null) => void;
  } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let svgEl = $state<SVGSVGElement | null>(null);
  let width = $state(700);

  // Rotation angles: [lambda (yaw/longitude), phi (pitch/latitude), gamma (roll)]
  // Centered on India: longitude 78°E, latitude 20°N
  const DEFAULT_ROTATION: [number, number, number] = [-78, -20, 0];
  let rotation = $state<[number, number, number]>([-78, -20, 0]);
  let zoomLevel = $state(1.0);

  let activeHover = $state<LocationPoint | null>(null);
  let tooltipPos = $state<{ x: number; y: number } | null>(null);

  let countryFeatures = $state<any[]>([]);
  let bordersFeature = $state<any | null>(null);
  let isDragging = false;
  let lastPos = { x: 0, y: 0 };
  let resizeObserver: ResizeObserver | null = null;

  // Load world countries & borders GeoJSON
  onMount(() => {
    fetch('/assets/world-countries-110m.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: any) => {
        if (data?.countries?.features) {
          countryFeatures = data.countries.features;
        }
        if (data?.borders) {
          bordersFeature = data.borders;
        }
      })
      .catch((e) => {
        console.warn('Failed to load world countries GeoJSON:', e);
      });

    if (container) {
      const updateSize = () => {
        if (container) width = container.clientWidth || 700;
      };
      updateSize();
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
    };
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  // Dragging to rotate with smooth damping
  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    lastPos = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      const sens = 0.32;
      const newLambda = rotation[0] + dx * sens;
      // Clamp pitch to keep semi-globe dome upright and stable
      const newPhi = Math.max(-42, Math.min(-10, rotation[1] - dy * sens));
      rotation = [newLambda, newPhi, rotation[2]];
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    zoomLevel = Math.max(0.75, Math.min(1.4, zoomLevel + delta));
  }

  function resetToIndia() {
    rotation = [...DEFAULT_ROTATION];
    zoomLevel = 1.0;
  }

  let isModified = $derived(
    Math.abs(rotation[0] - DEFAULT_ROTATION[0]) > 2 ||
    Math.abs(rotation[1] - DEFAULT_ROTATION[1]) > 2 ||
    Math.abs(zoomLevel - 1.0) > 0.05
  );

  // Proportional semi-globe dome geometry matching user's reference image:
  // Sphere curves gracefully within width & height, not over-zoomed!
  let sphereRadius = $derived(Math.min(width * 0.44, Math.max(height * 0.72, 300)) * zoomLevel);
  let centerX = $derived(width / 2);
  let centerY = $derived(height * 0.78);

  let projection = $derived(
    d3
      .geoOrthographic()
      .scale(sphereRadius)
      .translate([centerX, centerY])
      .rotate(rotation)
      .clipAngle(90)
  );

  let pathGenerator = $derived(d3.geoPath().projection(projection));

  // Graticule (15 deg lat/long mesh)
  let graticuleData = $derived(d3.geoGraticule().step([15, 15])());
  let graticulePath = $derived(pathGenerator(graticuleData as any) || '');

  // Calculate visible dots on the front-facing hemisphere
  let visibleLocations = $derived.by(() => {
    if (!locations || locations.length === 0) return [];
    const centerLng = -rotation[0];
    const centerLat = -rotation[1];

    return locations
      .map((loc, idx) => {
        const [lng, lat] = loc.coordinates;
        const dist = d3.geoDistance([lng, lat], [centerLng, centerLat]);
        const isVisible = dist < Math.PI / 2;
        const coords = projection([lng, lat]);

        // Green & Blue dots matching reference image
        const color = loc.color || (idx % 2 === 0 ? 'green' : 'blue');

        return {
          ...loc,
          color,
          isVisible,
          x: coords ? coords[0] : 0,
          y: coords ? coords[1] : 0,
          dist
        };
      })
      .filter((loc) => loc.isVisible && loc.x > 0 && loc.y > 0 && loc.y < height + 30);
  });

  let leaveTimeout: any = null;

  function handleDotHover(loc: LocationPoint & { x?: number; y?: number }) {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      leaveTimeout = null;
    }
    if (activeHover?.city === loc.city && activeHover?.country === loc.country) {
      return;
    }
    activeHover = loc;
    tooltipPos = {
      x: loc.x ?? 0,
      y: (loc.y ?? 10) - 12
    };
  }

  function handleDotLeave() {
    if (leaveTimeout) clearTimeout(leaveTimeout);
    leaveTimeout = setTimeout(() => {
      activeHover = null;
      tooltipPos = null;
    }, 100);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={container}
  class="relative w-full rounded-2xl overflow-hidden select-none bg-[#f7f7f5] dark:bg-[#141416] border border-black/[0.06] dark:border-white/[0.08]"
  style="height: {height}px; font-family: var(--font-openrunde), 'OpenRunde', sans-serif;"
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  onwheel={handleWheel}
  role="region"
  aria-label="Geographic Semi-Globe Dome"
>
  <!-- Apple-minimal Reset button -->
  {#if isModified}
    <div class="absolute top-3.5 right-3.5 z-20">
      <button
        type="button"
        onclick={resetToIndia}
        class="px-2.5 py-1 text-[11px] font-medium tracking-tight rounded-md bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 border border-black/[0.08] dark:border-white/[0.1] shadow-2xs hover:bg-white dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 backdrop-blur-xs"
        style="font-family: var(--font-openrunde), 'OpenRunde', sans-serif;"
      >
        <svg class="w-3 h-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Reset
      </button>
    </div>
  {/if}

  <!-- SVG Semi-Globe Dome -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    bind:this={svgEl}
    {width}
    {height}
    class="cursor-grab active:cursor-grabbing w-full h-full block"
    onmousedown={handleMouseDown}
  >
    <!-- Sphere Arc Circle (The globe base matching image) -->
    <circle
      cx={centerX}
      cy={centerY}
      r={sphereRadius}
      class="fill-[#efefec] dark:fill-[#18181c] stroke-[#d0d2d7] dark:stroke-[#2e2e34]"
      stroke-width="1.2"
    />

    <!-- Graticule Lat / Long Grid Lines matching image -->
    {#if graticulePath}
      <path
        d={graticulePath}
        fill="none"
        class="stroke-[#dedfe3] dark:stroke-[#26262c]"
        stroke-width="0.55"
      />
    {/if}

    <!-- Country Polygons -->
    {#each countryFeatures as feature, i (i)}
      {@const p = pathGenerator(feature)}
      {#if p}
        <path
          d={p}
          class="fill-[#f5f5f3] dark:fill-[#1e1e24] stroke-[#c5c8ce] dark:stroke-[#3f3f46]"
          stroke-width="0.45"
        />
      {/if}
    {/each}

    <!-- Crisp Internal Country Borders matching reference image -->
    {#if bordersFeature}
      {@const bp = pathGenerator(bordersFeature)}
      {#if bp}
        <path
          d={bp}
          fill="none"
          class="stroke-[#9ca3af] dark:stroke-[#6b7280]"
          stroke-width="0.75"
        />
      {/if}
    {/if}

    <!-- Geographic Dots (Blue & Green matching image) -->
    {#each visibleLocations as loc (loc.id || `${loc.city}-${loc.country}-${loc.color}`)}
      {@const isBlue = loc.color === 'blue'}
      {@const dotFill = isBlue ? '#4889c8' : '#5ea250'}
      {@const isSelected = selectedCity === loc.city}
      {@const isHovered = activeHover?.city === loc.city && activeHover?.country === loc.country}

      <!-- Interactive Dot Group with invisible hit zone to completely prevent hover flicker -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="cursor-pointer"
        onmouseenter={() => handleDotHover(loc)}
        onmouseleave={handleDotLeave}
        onclick={() => {
          selectedCity = loc.city;
          if (onselect) onselect(loc);
        }}
      >
        <!-- Transparent 18px hit target -->
        <circle
          cx={loc.x}
          cy={loc.y}
          r={9}
          fill="transparent"
        />

        <!-- Selection Ring -->
        {#if isSelected}
          <circle
            cx={loc.x}
            cy={loc.y}
            r={5.5}
            fill="none"
            stroke={dotFill}
            stroke-width="1.5"
            opacity="0.8"
            class="pointer-events-none"
          />
        {/if}

        <!-- Solid Core Dot -->
        <circle
          cx={loc.x}
          cy={loc.y}
          r={isHovered ? 3.8 : (isSelected ? 3.4 : 2.6)}
          fill={dotFill}
          stroke="#ffffff"
          stroke-width="0.4"
          class="pointer-events-none transition-[r] duration-100"
        />
      </g>
    {/each}
  </svg>

  <!-- Clean Floating Tooltip with Quadrant and OpenRunde (Static position, NO transition-all jitter) -->
  {#if activeHover && tooltipPos}
    <div
      class="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 rounded-xl shadow-lg backdrop-blur-md text-xs min-w-36 transition-opacity duration-150"
      style="left: {tooltipPos.x}px; top: {tooltipPos.y}px; font-family: var(--font-openrunde), 'OpenRunde', sans-serif;"
    >
      <div class="flex items-center justify-between gap-2 mb-0.5">
        <span class="font-normal text-zinc-900 dark:text-zinc-50 text-[13px]" style="font-family: var(--font-quadrant), serif;">
          {activeHover.city}
        </span>
        <span class="w-1.5 h-1.5 rounded-full {activeHover.color === 'blue' ? 'bg-[#4889c8]' : 'bg-[#5ea250]'}"></span>
      </div>
      <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
        {activeHover.region ? `${activeHover.region}, ` : ''}{activeHover.country}
      </div>
      <div class="flex items-center justify-between gap-3 text-[11px] pt-1 border-t border-black/[0.06] dark:border-white/[0.06] font-mono">
        <span class="text-zinc-500">Views: <strong class="text-zinc-800 dark:text-zinc-200">{activeHover.views.toLocaleString()}</strong></span>
        {#if activeHover.readingHours}
          <span class="text-zinc-500">Time: <strong class="text-zinc-800 dark:text-zinc-200">{activeHover.readingHours}h</strong></span>
        {/if}
      </div>
    </div>
  {/if}
</div>
