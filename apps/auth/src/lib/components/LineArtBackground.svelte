<script lang="ts">
  // High-fidelity vector line art with graceful bezier loops and continuous arcs
  // Inspired by the Granola reference UI, fully adapting between dark & light modes.
</script>

<style>
  .line-art-path {
    stroke: rgba(14, 15, 12, 0.055);
  }
  :global(.dark) .line-art-path {
    stroke: rgba(255, 255, 255, 0.075);
  }
</style>

<div class="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none" aria-hidden="true">
  <svg 
    class="w-full h-full transition-colors duration-500" 
    viewBox="0 0 1600 1000" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
  >
    <!-- 1. Sweeping upper-left loop that swoops down behind the left side of the card and exits cleanly -->
    <path 
      class="line-art-path"
      d="M -160 180 C 140 -20, 380 40, 460 260 C 530 460, 360 620, 180 560 C 20 500, -10 300, 160 170 C 340 30, 680 80, 860 320 C 980 490, 920 740, 740 840 C 560 930, 320 890, 100 760 C -40 680, -90 860, -180 1080" 
      stroke-width="1.15" 
      stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 2. Large right-side elliptical loop with double wrap -->
    <path 
      class="line-art-path"
      d="M 1780 100 C 1420 40, 1260 240, 1280 480 C 1300 720, 1520 760, 1620 580 C 1680 420, 1520 220, 1260 210 C 1020 200, 940 440, 1020 680 C 1100 900, 1360 960, 1780 900" 
      stroke-width="1.1" 
      stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 3. Elegant diagonal ribbon traversing from bottom-left through center to top-right -->
    <path 
      class="line-art-path"
      d="M -180 880 C 180 860, 440 720, 680 500 C 920 280, 1220 140, 1780 90" 
      stroke-width="1.2" 
      stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 4. Gentle sweeping curve across the top canvas -->
    <path 
      class="line-art-path"
      d="M 160 -120 C 480 180, 820 210, 1140 60 C 1320 -40, 1520 -10, 1780 50" 
      stroke-width="1.0" 
      stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 5. Lower canvas looping ribbon weaving behind card bottom -->
    <path 
      class="line-art-path"
      d="M -180 620 C 240 540, 480 640, 620 800 C 760 960, 1020 980, 1240 860 C 1420 750, 1580 820, 1780 930" 
      stroke-width="1.1" 
      stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />

    <!-- 6. Soft undulating wave connecting left and right horizons -->
    <path 
      class="line-art-path"
      d="M -180 420 C 180 260, 520 540, 800 380 C 1080 220, 1360 480, 1780 340" 
      stroke-width="1.0" 
      stroke-linecap="round"
      vector-effect="non-scaling-stroke" 
    />
  </svg>
</div>
