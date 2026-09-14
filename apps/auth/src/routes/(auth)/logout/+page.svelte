<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { userStore } from '$lib/stores/user.svelte';

  onMount(() => {
    // Clear tokens and state
    userStore.logout();
    
    const callback = $page.url.searchParams.get('callback');
    
    // Simulate a brief loading state for a smooth transition
    setTimeout(() => {
      if (callback) {
        goto(`/login?callback=${encodeURIComponent(callback)}`);
      } else {
        goto('/login');
      }
    }, 1000);
  });
</script>

<div class="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
  <div class="flex gap-2 justify-center">
    <div class="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style="animation-delay: 0ms"></div>
    <div class="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style="animation-delay: 150ms"></div>
    <div class="w-2 h-2 rounded-full bg-primary/80 animate-bounce" style="animation-delay: 300ms"></div>
  </div>
  <p class="text-muted-foreground text-sm font-medium tracking-wide">Logging out...</p>
</div>
