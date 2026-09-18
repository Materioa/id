<script lang="ts">
  import type { Snippet } from 'svelte';

  let { 
    children, 
    maxWidth = 'max-w-[440px]',
    bgImage = '/onboarding.png',
    class: className = '' 
  }: { 
    children?: Snippet; 
    maxWidth?: string;
    bgImage?: string;
    class?: string;
  } = $props();
</script>

<style>
  .auth-card-surface {
    background-color: #ffffff;
    color: #0e0f0c;
    border-color: rgba(0, 0, 0, 0.07);
  }
  :global(.dark) .auth-card-surface {
    background-color: #21221e;
    color: #f4f4ee;
    border-color: rgba(255, 255, 255, 0.08);
  }
</style>

<!-- Outer artwork framed wrapper -->
<div 
  class="relative w-full {maxWidth} mx-auto rounded-[30px] sm:rounded-[34px] p-[8px] sm:p-[10px] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.25)] dark:shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300"
  style="background-image: url('{bgImage}'); background-size: cover; background-position: center;"
>
  <!-- Inner Solid Card Surface -->
  <div 
    class="auth-card-surface relative z-10 w-full rounded-[22px] sm:rounded-[26px] border px-6 py-8 sm:px-8 sm:py-9 transition-colors duration-300 {className}"
  >
    {@render children?.()}
  </div>
</div>
