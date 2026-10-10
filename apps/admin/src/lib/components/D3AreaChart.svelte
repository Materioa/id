<script lang="ts">
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  let { 
    data = [], 
    height = 220,
    onselect = undefined 
  }: { 
    data?: Array<{ date: string; views: number; duration: number }>; 
    height?: number;
    onselect?: (point: { date: Date; views: number; duration: number } | null) => void;
  } = $props();

  let container = $state<HTMLDivElement>();
  let width = $state(500);
  let hoverIndex = $state(-1);
  let hoverX = $state(0);
  let hoverY = $state(0);
  let isPinned = $state(false);

  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  let parsedData = $derived(
    (data || [])
      .map((d) => {
        if (!d || !d.date) {
          return { date: new Date(), views: 0, duration: 0 };
        }
        const strDate = typeof d.date === 'string' ? d.date : String(d.date);
        const parts = strDate.split('T')[0].split('-');
        const dateObj = parts.length === 3 
          ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0)
          : new Date(strDate);
        return {
          date: isNaN(dateObj.getTime()) ? new Date() : dateObj,
          views: Number(d.views || 0),
          duration: Number(d.duration || 0)
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  );

  let xScale = $derived.by(() => {
    const ext = d3.extent(parsedData, (d) => d.date);
    let start = ext[0];
    let end = ext[1];
    if (!start || !end || start.getTime() === end.getTime()) {
      start = start ? new Date(start.getTime() - 86400000) : new Date(Date.now() - 30 * 86400000);
      end = end ? new Date(end.getTime() + 86400000) : new Date();
    }
    return d3.scaleTime().domain([start, end]).range([margin.left, Math.max(margin.left + 50, width - margin.right)]);
  });

  let yScale = $derived(
    d3
      .scaleLinear()
      .domain([0, (d3.max(parsedData, (d) => d.views) ?? 10) * 1.15 || 10])
      .nice()
      .range([height - margin.bottom, margin.top])
  );

  let linePath = $derived(
    ((d3.line() as any)
      .x((d: any) => xScale(d.date))
      .y((d: any) => yScale(d.views))
      .curve(d3.curveMonotoneX)(parsedData) as string) || ''
  );

  let areaPath = $derived(
    ((d3.area() as any)
      .x((d: any) => xScale(d.date))
      .y0(height - margin.bottom)
      .y1((d: any) => yScale(d.views))
      .curve(d3.curveMonotoneX)(parsedData) as string) || ''
  );

  let yTicks = $derived(yScale.ticks(5));
  let xTicks = $derived(
    parsedData.length > 7
      ? xScale.ticks(d3.timeDay.every(Math.ceil(parsedData.length / 5)) || d3.timeDay)
      : xScale.ticks(parsedData.length || 5)
  );

  onMount(() => {
    if (typeof window !== 'undefined') {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          width = entry.contentRect.width || 500;
        }
      });
      if (container) {
        resizeObserver.observe(container);
      }
      return () => {
        resizeObserver.disconnect();
      };
    }
  });

  function getIndexFromEvent(event: MouseEvent): number {
    if (!parsedData.length || !container) return -1;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    // Direct domain clamping
    const clampedX = Math.max(margin.left, Math.min(width - margin.right, mouseX));
    const dateAtMouse = xScale.invert(clampedX);

    // Find nearest point accurately
    const bisect = d3.bisector((d: any) => d.date).center;
    let index = bisect(parsedData, dateAtMouse);
    if (index >= parsedData.length) index = parsedData.length - 1;
    if (index < 0) index = 0;
    return index;
  }

  function handleMouseMove(event: MouseEvent) {
    if (isPinned) return;
    const index = getIndexFromEvent(event);
    if (index !== -1) {
      hoverIndex = index;
      hoverX = xScale(parsedData[index].date);
      hoverY = yScale(parsedData[index].views);
    }
  }

  function handleClick(event: MouseEvent) {
    const index = getIndexFromEvent(event);
    if (index !== -1) {
      if (hoverIndex === index && isPinned) {
        isPinned = false;
        onselect?.(null);
      } else {
        hoverIndex = index;
        hoverX = xScale(parsedData[index].date);
        hoverY = yScale(parsedData[index].views);
        isPinned = true;
        onselect?.(parsedData[index]);
      }
    }
  }

  function handleMouseLeave() {
    if (!isPinned) {
      hoverIndex = -1;
    }
  }
</script>

<div class="chart-wrapper" bind:this={container}>
  {#if !data || data.length === 0}
    <div class="empty-chart" style="height: {height}px;">No traffic data recorded yet</div>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg 
      {width} 
      {height} 
      onmouseleave={handleMouseLeave} 
      onclick={handleClick}
      role="application" 
      aria-label="Views Timeline"
      class="cursor-crosshair select-none"
    >
      <defs>
        <linearGradient id="chart-area-grad-admin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-accent, #c05a1e)" stop-opacity="0.32" />
          <stop offset="60%" stop-color="var(--chart-accent, #c05a1e)" stop-opacity="0.08" />
          <stop offset="100%" stop-color="var(--chart-accent, #c05a1e)" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Grid lines -->
      <g class="grid-lines">
        {#each yTicks as tick}
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="var(--chart-grid, #e5e5e0)"
            stroke-width="1"
            stroke-dasharray="2 4"
          />
        {/each}
      </g>

      <!-- Area Path -->
      <path d={areaPath} fill="url(#chart-area-grad-admin)" />

      <!-- Line Path -->
      <path
        d={linePath}
        fill="none"
        stroke="var(--chart-accent, #c05a1e)"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- X Axis Ticks -->
      <g class="axis x-axis">
        {#each xTicks as tick}
          <text
            x={xScale(tick)}
            y={height - margin.bottom + 18}
            text-anchor="middle"
            fill="var(--chart-text, #72726e)"
            font-size="11px"
            font-family="var(--font-sans)"
          >
            {d3.timeFormat('%b %d')(tick)}
          </text>
        {/each}
      </g>

      <!-- Y Axis Ticks -->
      <g class="axis y-axis">
        {#each yTicks as tick}
          <text
            x={margin.left - 10}
            y={yScale(tick) + 3}
            text-anchor="end"
            fill="var(--chart-text, #72726e)"
            font-size="11px"
            font-family="var(--font-sans)"
          >
            {tick}
          </text>
        {/each}
      </g>

      <!-- Hover Interactive Rect covering entire chart width up to right margin -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <rect
        x={margin.left}
        y={margin.top}
        width={Math.max(0, width - margin.left - margin.right)}
        height={Math.max(0, height - margin.top - margin.bottom)}
        fill="transparent"
        onmousemove={handleMouseMove}
        onclick={handleClick}
      />

      <!-- Hover / Selected Info Line & Circle -->
      {#if hoverIndex !== -1 && parsedData[hoverIndex]}
        <line
          x1={hoverX}
          x2={hoverX}
          y1={margin.top}
          y2={height - margin.bottom}
          stroke="var(--chart-accent, #c05a1e)"
          stroke-dasharray="3 3"
          stroke-width="1.4"
        />

        <circle
          cx={hoverX}
          cy={hoverY}
          r={isPinned ? 6 : 5}
          fill="var(--chart-accent, #c05a1e)"
          stroke="var(--chart-dot-border, #ffffff)"
          stroke-width={isPinned ? 2.5 : 2}
        />
      {/if}
    </svg>

    <!-- Tooltip Overlay -->
    {#if hoverIndex !== -1 && parsedData[hoverIndex]}
      <div
        class="chart-tooltip"
        style="
          left: {Math.min(width - 165, Math.max(margin.left, hoverX - 75))}px;
          bottom: {height - hoverY + 14}px;
        "
      >
        <div class="tooltip-date flex items-center justify-between gap-2">
          <span>{d3.timeFormat('%a, %b %d')(parsedData[hoverIndex].date)}</span>
          {#if isPinned}
            <span class="text-[9px] uppercase tracking-wider text-primary font-bold">Pinned</span>
          {/if}
        </div>
        <div class="tooltip-row">
          <span class="dot"></span>
          <span class="label">Reads:</span>
          <span class="value">{parsedData[hoverIndex].views}</span>
        </div>
        {#if parsedData[hoverIndex].duration > 0}
          <div class="tooltip-row">
            <span class="dot sec"></span>
            <span class="label">Read Time:</span>
            <span class="value">
              {parsedData[hoverIndex].duration >= 60
                ? `${Math.round(parsedData[hoverIndex].duration / 60)}m`
                : `${parsedData[hoverIndex].duration}s`}
            </span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart-wrapper {
    position: relative;
    width: 100%;
    margin: 0.5rem 0;
    --chart-accent: #c05a1e;
    --chart-grid: #e5e5e0;
    --chart-text: #72726e;
    --chart-dot-border: #ffffff;
    --tooltip-bg: #0e0f0c;
    --tooltip-color: #f7f7f2;
  }

  :global(.dark) .chart-wrapper {
    --chart-accent: #e18b5b;
    --chart-grid: #2e302c;
    --chart-text: #8e9087;
    --chart-dot-border: #1a1b18;
    --tooltip-bg: #292a27;
    --tooltip-color: #f7f7f2;
  }

  .empty-chart {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--chart-text);
    font-size: 13px;
    border: 1px dashed var(--chart-grid);
    border-radius: 12px;
    width: 100%;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .chart-tooltip {
    position: absolute;
    background: var(--tooltip-bg);
    color: var(--tooltip-color);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    z-index: 100;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tooltip-date {
    font-weight: 600;
    margin-bottom: 2px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    padding-bottom: 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.85;
  }

  .tooltip-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tooltip-row .dot {
    width: 6px;
    height: 6px;
    background-color: var(--chart-accent);
    border-radius: 50%;
  }

  .tooltip-row .dot.sec {
    background-color: #788c5d;
  }

  .tooltip-row .label {
    opacity: 0.7;
    flex-grow: 1;
  }

  .tooltip-row .value {
    font-weight: 600;
  }
</style>
