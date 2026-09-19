<script lang="ts">
  /**
   * GitHub-style contribution heatmap — Svelte 5, pure SVG.
   *
   * Props
   * ─────
   * data        – Array<{ date: number|string|Date, value: number }>
   * emptyColor  – CSS color for zero-activity cells
   * fontColor   – CSS color for month / day labels
   * colors      – 4-stop gradient from low → high activity
   * cellSize    – px width & height of each cell
   * cellGap     – px gap between cells
   */

  interface HeatmapDatum {
    date: number | string | Date;
    value: number;
  }

  interface Props {
    data?: HeatmapDatum[];
    emptyColor?: string;
    fontColor?: string;
    colors?: string[];
    cellSize?: number;
    cellGap?: number;
  }

  let {
    data = [],
    emptyColor = 'hsl(var(--muted))',
    fontColor = 'hsl(var(--muted-foreground))',
    colors = ['#f3d9ca', '#e18b5b', '#c05a1e', '#a34914'],
    cellSize = 11,
    cellGap = 3,
  }: Props = $props();

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_LABELS = ['Mon', 'Wed', 'Fri'];
  const DAY_LABEL_WIDTH = 28;
  const MONTH_LABEL_HEIGHT = 16;

  /* ── build a { "YYYY-MM-DD" → value } lookup ── */
  function dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  let lookup = $derived.by(() => {
    const map = new Map<string, number>();
    for (const d of data) {
      const dt = d.date instanceof Date ? d.date : new Date(d.date);
      if (!isNaN(dt.getTime())) map.set(dateKey(dt), d.value);
    }
    return map;
  });

  let maxValue = $derived(Math.max(...data.map(d => d.value), 0) || 1);

  /* ── generate weeks grid (last 52 weeks + current partial week) ── */
  interface CellInfo {
    date: Date;
    key: string;
    value: number;
    col: number;
    row: number;
  }

  let cells = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Go back ~52 weeks to the nearest Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - 363 - start.getDay());

    const result: CellInfo[] = [];
    const cursor = new Date(start);
    let col = 0;

    while (cursor <= today) {
      const row = cursor.getDay(); // 0=Sun … 6=Sat
      const k = dateKey(cursor);
      result.push({
        date: new Date(cursor),
        key: k,
        value: lookup.get(k) ?? 0,
        col,
        row,
      });
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === 0) col++;
    }
    return result;
  });

  let totalCols = $derived(cells.length > 0 ? cells[cells.length - 1].col + 1 : 0);

  /* ── month labels positioned on the first Sunday of each month ── */
  let monthLabels = $derived.by(() => {
    const labels: { text: string; x: number }[] = [];
    let lastMonth = -1;
    let lastX = -Infinity;
    const minGap = 50; // minimum px between labels
    for (const c of cells) {
      const m = c.date.getMonth();
      if (m !== lastMonth && c.row === 0) {
        const x = DAY_LABEL_WIDTH + c.col * (cellSize + cellGap);
        if (x - lastX >= minGap) {
          labels.push({ text: MONTH_LABELS[m], x });
          lastX = x;
        }
        lastMonth = m;
      }
    }
    return labels;
  });

  /* ── colour a cell ── */
  function cellColor(value: number): string {
    if (value < 0.05) return emptyColor;
    const ratio = Math.min(value / maxValue, 1);
    const idx = Math.min(Math.floor(ratio * colors.length), colors.length - 1);
    return colors[idx];
  }

  /* ── format value for tooltip ── */
  function formatValue(value: number): string {
    if (value < 0.05) return '0m';
    if (value < 1) return Math.round(value * 60) + 'm';
    return value.toFixed(1) + 'h';
  }

  /* ── format date for tooltip ── */
  function formatDate(d: Date): string {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  }

  /* ── SVG dimensions ── */
  let svgWidth = $derived(DAY_LABEL_WIDTH + totalCols * (cellSize + cellGap));
  let svgHeight = $derived(MONTH_LABEL_HEIGHT + 7 * (cellSize + cellGap));

  /* ── tooltip state ── */
  let tooltip = $state<{ cell: CellInfo; x: number; y: number } | null>(null);
  let wrapperEl: HTMLDivElement | undefined = $state();

  function handleMouseEnter(e: MouseEvent, cell: CellInfo) {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const wrapperRect = wrapperEl?.getBoundingClientRect();
    if (!wrapperRect) return;
    tooltip = {
      cell,
      x: rect.left - wrapperRect.left + rect.width / 2,
      y: rect.top - wrapperRect.top,
    };
  }

  function handleMouseLeave() {
    tooltip = null;
  }
</script>

<div class="heatmap-wrapper" bind:this={wrapperEl}>
  <svg
    viewBox="0 0 {svgWidth} {svgHeight}"
    width="100%"
    height={svgHeight}
    role="img"
    aria-label="Activity heatmap"
  >
    <!-- Month labels -->
    {#each monthLabels as ml}
      <text
        x={ml.x}
        y={10}
        fill={fontColor}
        font-size="10"
        font-family="inherit"
      >{ml.text}</text>
    {/each}

    <!-- Day labels (Mon / Wed / Fri) -->
    {#each DAY_LABELS as label, i}
      <text
        x={0}
        y={MONTH_LABEL_HEIGHT + [1, 3, 5][i] * (cellSize + cellGap) + cellSize * 0.75}
        fill={fontColor}
        font-size="9"
        font-family="inherit"
      >{label}</text>
    {/each}

    <!-- Cells -->
    {#each cells as c (c.key)}
      <rect
        x={DAY_LABEL_WIDTH + c.col * (cellSize + cellGap)}
        y={MONTH_LABEL_HEIGHT + c.row * (cellSize + cellGap)}
        width={cellSize}
        height={cellSize}
        rx="2"
        ry="2"
        fill={cellColor(c.value)}
        onmouseenter={(e) => handleMouseEnter(e, c)}
        onmouseleave={handleMouseLeave}
        style="cursor: pointer;"
      />
    {/each}
  </svg>

  <!-- Custom tooltip -->
  {#if tooltip}
    <div
      class="heatmap-tooltip"
      style="left: {tooltip.x}px; top: {tooltip.y}px;"
    >
      <span class="heatmap-tooltip-date">{formatDate(tooltip.cell.date)}</span>:
      <span class="heatmap-tooltip-value">{formatValue(tooltip.cell.value)}</span>
      <div class="heatmap-tooltip-arrow"></div>
    </div>
  {/if}
</div>

<style>
  .heatmap-wrapper {
    position: relative;
  }

  .heatmap-tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    margin-top: -8px;
    background: hsl(var(--foreground));
    color: hsl(var(--background));
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .heatmap-tooltip-arrow {
    position: absolute;
    left: 50%;
    bottom: -4px;
    transform: translateX(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: hsl(var(--foreground));
  }

  .heatmap-tooltip-value {
    font-weight: 700;
  }
</style>
