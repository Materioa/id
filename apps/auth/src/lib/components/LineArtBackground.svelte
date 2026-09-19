<script lang="ts">
  // Subtle geometric line art — every line spans fully edge-to-edge
  // Mix of straight lines and gentle arcs with gradient fading
</script>

<div class="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none" aria-hidden="true">
  <svg 
    class="w-full h-full transition-colors duration-500" 
    viewBox="0 0 1600 1000" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <linearGradient id="f1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="1000">
        <stop offset="0%" stop-color="var(--line-color)" stop-opacity="0" />
        <stop offset="15%" stop-color="var(--line-color)" stop-opacity="0.09" />
        <stop offset="38%" stop-color="var(--line-color)" stop-opacity="0.02" />
        <stop offset="58%" stop-color="var(--line-color)" stop-opacity="0.1" />
        <stop offset="80%" stop-color="var(--line-color)" stop-opacity="0.03" />
        <stop offset="100%" stop-color="var(--line-color)" stop-opacity="0" />
      </linearGradient>

      <linearGradient id="f2" gradientUnits="userSpaceOnUse" x1="1600" y1="0" x2="0" y2="1000">
        <stop offset="0%" stop-color="var(--line-color)" stop-opacity="0" />
        <stop offset="18%" stop-color="var(--line-color)" stop-opacity="0.08" />
        <stop offset="42%" stop-color="var(--line-color)" stop-opacity="0.02" />
        <stop offset="62%" stop-color="var(--line-color)" stop-opacity="0.09" />
        <stop offset="82%" stop-color="var(--line-color)" stop-opacity="0.03" />
        <stop offset="100%" stop-color="var(--line-color)" stop-opacity="0" />
      </linearGradient>

      <linearGradient id="f3" gradientUnits="userSpaceOnUse" x1="0" y1="500" x2="1600" y2="500">
        <stop offset="0%" stop-color="var(--line-color)" stop-opacity="0" />
        <stop offset="12%" stop-color="var(--line-color)" stop-opacity="0.07" />
        <stop offset="35%" stop-color="var(--line-color)" stop-opacity="0.02" />
        <stop offset="55%" stop-color="var(--line-color)" stop-opacity="0.1" />
        <stop offset="78%" stop-color="var(--line-color)" stop-opacity="0.03" />
        <stop offset="100%" stop-color="var(--line-color)" stop-opacity="0" />
      </linearGradient>

      <linearGradient id="f4" gradientUnits="userSpaceOnUse" x1="800" y1="-200" x2="800" y2="1200">
        <stop offset="0%" stop-color="var(--line-color)" stop-opacity="0" />
        <stop offset="20%" stop-color="var(--line-color)" stop-opacity="0.08" />
        <stop offset="45%" stop-color="var(--line-color)" stop-opacity="0.02" />
        <stop offset="68%" stop-color="var(--line-color)" stop-opacity="0.09" />
        <stop offset="90%" stop-color="var(--line-color)" stop-opacity="0.03" />
        <stop offset="100%" stop-color="var(--line-color)" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- 1. Diagonal: top-left to bottom-right (steep) -->
    <line x1="-100" y1="-80" x2="640" y2="1120" stroke="url(#f1)" stroke-width="1" vector-effect="non-scaling-stroke" />

    <!-- 2. Diagonal: bottom-left to upper-right (wide) -->
    <line x1="-100" y1="880" x2="1700" y2="120" stroke="url(#f2)" stroke-width="1" vector-effect="non-scaling-stroke" />

    <!-- 3. Steep line from upper-right to lower-left -->
    <line x1="1300" y1="-80" x2="280" y2="1120" stroke="url(#f4)" stroke-width="1" vector-effect="non-scaling-stroke" />

    <!-- 4. Near-horizontal gentle slope left to right -->
    <line x1="-100" y1="340" x2="1700" y2="680" stroke="url(#f3)" stroke-width="1" vector-effect="non-scaling-stroke" />

    <!-- 5. Steep right-side diagonal -->
    <line x1="1060" y1="1120" x2="1700" y2="-80" stroke="url(#f2)" stroke-width="1" vector-effect="non-scaling-stroke" />

    <!-- 6. Wide gentle arc: left edge sweeping down to bottom -->
    <path 
      d="M -100 -60 C 220 320, 180 660, -100 1060"
      stroke="url(#f4)" stroke-width="1" stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 7. Wide gentle arc: top to right edge -->
    <path 
      d="M 400 -80 C 700 240, 1200 280, 1700 60"
      stroke="url(#f3)" stroke-width="1" stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 8. Wide gentle arc: bottom-left to bottom-right -->
    <path 
      d="M -100 760 C 400 600, 1100 640, 1700 860"
      stroke="url(#f1)" stroke-width="1" stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />
  </svg>
</div>

<style>
  div {
    --line-color: rgba(14, 15, 12, 0.9);
  }
  :global(.dark) div {
    --line-color: rgba(255, 255, 255, 0.9);
  }
</style>
