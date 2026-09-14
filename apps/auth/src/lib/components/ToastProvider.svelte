<script lang="ts">
  import { toasts, removeToast } from '$lib/stores/toast';
  import Alert from '$lib/components/Alert.svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
</script>

<div class="fixed top-4 right-4 z-[10000] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
  {#each $toasts as toast (toast.id)}
    <div 
      animate:flip={{ duration: 200 }} 
      transition:fly={{ x: 50, duration: 200 }} 
      class="pointer-events-auto drop-shadow-xl"
    >
      <Alert 
        type={toast.type} 
        title={toast.title} 
        message={toast.message} 
        dismissible={true} 
        onDismiss={() => removeToast(toast.id)} 
      />
    </div>
  {/each}
</div>
