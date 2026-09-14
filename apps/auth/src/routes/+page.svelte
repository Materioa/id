<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => goto('/login'));
</script>

<div class="min-h-screen bg-background" aria-busy="true"></div>
