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
    isPulse?: boolean;
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
  let velocity = { x: 0, y: 0 };
  let animFrameId: number | null = null;
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
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    if (animFrameId) cancelAnimationFrame(animFrameId);
  });

  // Smooth inertial rotation momentum on drag release
  function startInertia() {
    if (animFrameId) cancelAnimationFrame(animFrameId);

    const step = () => {
      if (Math.abs(velocity.x) < 0.02 && Math.abs(velocity.y) < 0.02) {
        velocity = { x: 0, y: 0 };
        return;
      }
      const newLambda = rotation[0] + velocity.x;
      const newPhi = Math.max(-89, Math.min(89, rotation[1] - velocity.y));
      rotation = [newLambda, newPhi, rotation[2]];

      velocity.x *= 0.94;
      velocity.y *= 0.94;

      animFrameId = requestAnimationFrame(step);
    };
    animFrameId = requestAnimationFrame(step);
  }

  // Full unconstrained rotation handling (mouse & touch)
  function handleMouseDown(e: MouseEvent) {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    isDragging = true;
    lastPos = { x: e.clientX, y: e.clientY };
    velocity = { x: 0, y: 0 };
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      const sens = 0.35;
      velocity = { x: dx * sens * 0.45, y: dy * sens * 0.45 };

      // Full horizontal spin without clamp + full vertical tilt
      const newLambda = rotation[0] + dx * sens;
      const newPhi = Math.max(-89, Math.min(89, rotation[1] - dy * sens));
      rotation = [newLambda, newPhi, rotation[2]];
    }
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      startInertia();
    }
  }

  // Touch handlers for mobile / tablet gestures
  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      isDragging = true;
      lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity = { x: 0, y: 0 };
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastPos.x;
      const dy = e.touches[0].clientY - lastPos.y;
      lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const sens = 0.35;
      velocity = { x: dx * sens * 0.45, y: dy * sens * 0.45 };

      const newLambda = rotation[0] + dx * sens;
      const newPhi = Math.max(-89, Math.min(89, rotation[1] - dy * sens));
      rotation = [newLambda, newPhi, rotation[2]];
    }
  }

  function handleTouchEnd() {
    if (isDragging) {
      isDragging = false;
      startInertia();
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    zoomLevel = Math.max(0.75, Math.min(1.5, zoomLevel + delta));
  }

  function resetToIndia() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    rotation = [...DEFAULT_ROTATION];
    zoomLevel = 1.0;
  }

  let isModified = $derived(
    Math.abs(rotation[0] - DEFAULT_ROTATION[0]) > 2 ||
    Math.abs(rotation[1] - DEFAULT_ROTATION[1]) > 2 ||
    Math.abs(zoomLevel - 1.0) > 0.05
  );

  // Proportional semi-globe dome geometry matching user's reference image:
  // Shows a perfect hemisphere rising from the bottom with graceful curves
  let sphereRadius = $derived(Math.min(width * 0.45, Math.max(height * 0.74, 290)) * zoomLevel);
  let centerX = $derived(width / 2);
  let centerY = $derived(height * 0.80);

  let projection = $derived(
    d3
      .geoOrthographic()
      .scale(sphereRadius)
      .translate([centerX, centerY])
      .rotate(rotation)
      .clipAngle(90)
  );

  let pathGenerator = $derived(d3.geoPath().projection(projection));

  // Graticule: Dense section lines spaced every 10 degrees matching user's reference image
  let graticuleData = $derived(d3.geoGraticule().step([10, 10])());
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

        // Emerald Green & Azure Blue matching reference image
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
      .filter((loc) => loc.isVisible && loc.x > 0 && loc.y > 0 && loc.y < height + 40);
  });

  let leaveTimeout: any = null;

  function handleDotHover(loc: LocationPoint & { x?: number; y?: number }) {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      leaveTimeout = null;
    }
    if (activeHover?.id === loc.id || (activeHover?.city === loc.city && activeHover?.country === loc.country && !loc.id)) {
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
    }, 120);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={container}
  class="relative w-full rounded-2xl overflow-hidden select-none bg-[#f6f5f0] dark:bg-[#1c1c1b] border border-black/[0.06] dark:border-white/[0.06]"
  style="height: {height}px; font-family: var(--font-openrunde), 'OpenRunde', sans-serif;"
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  onwheel={handleWheel}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="region"
  aria-label="Geographic Semi-Globe Dome"
>
  <!-- Minimal Reset button -->
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
    shape-rendering="geometricPrecision"
  >
    <!-- Sphere Arc Circle (The globe base matching reference image) -->
    <circle
      cx={centerX}
      cy={centerY}
      r={sphereRadius}
      class="fill-[#eeede7] dark:fill-[#171716] stroke-[#b8b8b3] dark:stroke-[#3a3a37]"
      stroke-width="0.6"
    />

    <!-- Graticule Lat / Long Grid Lines: Dense section lines spaced every 10 degrees -->
    {#if graticulePath}
      <path
        d={graticulePath}
        fill="none"
        class="stroke-[#dcdbd5] dark:stroke-[#282826]"
        stroke-width="0.4"
      />
    {/if}

    <!-- Country Polygons: Exact same border thickness matching reference image -->
    {#each countryFeatures as feature, i (i)}
      {@const p = pathGenerator(feature)}
      {#if p}
        <path
          d={p}
          class="fill-[#f5f4ee] dark:fill-[#222221] stroke-[#b8b8b3] dark:stroke-[#3a3a37]"
          stroke-width="0.5"
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
          class="stroke-[#b8b8b3] dark:stroke-[#3a3a37]"
          stroke-width="0.5"
        />
      {/if}
    {/if}

    <!-- Geographic Session Dots (Blue & Green matching image, with pulsing radar animations) -->
    {#each visibleLocations as loc, idx (loc.id || `${loc.city}-${loc.country}-${idx}`)}
      {@const isBlue = loc.color === 'blue'}
      {@const dotFill = isBlue ? '#4688cf' : '#56ab46'}
      {@const isSelected = selectedCity === loc.city}
      {@const isHovered = activeHover?.city === loc.city && activeHover?.country === loc.country}

      <!-- Interactive Dot Group with invisible hit zone -->
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
        <!-- Transparent 16px hit target -->
        <circle
          cx={loc.x}
          cy={loc.y}
          r={8}
          fill="transparent"
        />

        <!-- Radar Pulse Ring for Active / Realtime Sessions -->
        {#if loc.isPulse || loc.isRealtime}
          <circle
            cx={loc.x}
            cy={loc.y}
            class="radar-ring pointer-events-none"
            stroke={dotFill}
            style="animation-delay: {((idx * 17) % 24) * 0.1}s;"
          />
        {/if}

        <!-- Selection Ring -->
        {#if isSelected}
          <circle
            cx={loc.x}
            cy={loc.y}
            r={5.5}
            fill="none"
            stroke={dotFill}
            stroke-width="1.2"
            opacity="0.8"
            class="pointer-events-none"
          />
        {/if}

        <!-- Solid Core Session Dot -->
        <circle
          cx={loc.x}
          cy={loc.y}
          r={isHovered ? 3.4 : (isSelected ? 3.0 : 2.2)}
          fill={dotFill}
          class="pointer-events-none stroke-white dark:stroke-[#171716] transition-[r] duration-100"
          stroke-width="0.35"
        />
      </g>
    {/each}
  </svg>

  <!-- Clean Floating Tooltip with OpenRunde & Quadrant -->
  {#if activeHover && tooltipPos}
    <div
      class="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 rounded-xl shadow-lg backdrop-blur-md text-xs min-w-36 transition-opacity duration-150"
      style="left: {tooltipPos.x}px; top: {tooltipPos.y}px; font-family: var(--font-openrunde), 'OpenRunde', sans-serif;"
    >
      <div class="flex items-center justify-between gap-2 mb-0.5">
        <span class="font-normal text-zinc-900 dark:text-zinc-50 text-[13px]" style="font-family: var(--font-quadrant), serif;">
          {activeHover.city}
        </span>
        <span class="w-1.5 h-1.5 rounded-full {activeHover.color === 'blue' ? 'bg-[#4688cf]' : 'bg-[#56ab46]'}"></span>
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

<style>
  @keyframes radar-pulse {
    0% {
      r: 2px;
      opacity: 0.9;
      stroke-width: 1px;
    }
    60% {
      opacity: 0.4;
      stroke-width: 0.6px;
    }
    100% {
      r: 9px;
      opacity: 0;
      stroke-width: 0.3px;
    }
  }

  .radar-ring {
    fill: none;
    animation: radar-pulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }
</style>
