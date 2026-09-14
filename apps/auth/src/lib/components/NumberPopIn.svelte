<script lang="ts">
  let { value } = $props();
  let strValue = $derived(String(value));
  let chars = $derived(strValue.split(''));
  
  let isAnimating = $state(true);
  
  $effect(() => {
    // Whenever value changes, re-trigger the animation
    const v = value;
    isAnimating = false;
    setTimeout(() => {
      isAnimating = true;
    }, 10);
  });
</script>

<span class="t-digit-group" class:is-animating={isAnimating}>
  {#each chars as char, i}
    <span 
      class="t-digit" 
      data-stagger={i === chars.length - 2 ? '1' : i === chars.length - 1 ? '2' : undefined}
    >
      {char}
    </span>
  {/each}
</span>
