<script>
  import '@materio/ui/styles.css';
  import OpenInAppBanner from '@materio/ui/components/OpenInAppBanner.svelte';
  let { children } = $props();
</script>

{@render children()}
<OpenInAppBanner />
