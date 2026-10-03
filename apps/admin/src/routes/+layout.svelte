<script>
  import '@materio/ui/styles.css';
  import OpenInAppBanner from '@materio/ui/components/OpenInAppBanner.svelte';
  import FloatingWindowControls from '@materio/ui/components/FloatingWindowControls.svelte';
  let { children } = $props();
</script>

{@render children()}
<OpenInAppBanner />
<FloatingWindowControls />
