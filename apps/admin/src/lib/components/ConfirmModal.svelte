<script lang="ts">
  import Modal from './Modal.svelte';

  export let isOpen = false;
  export let title = 'Confirm Action';
  export let message = 'Are you sure you want to proceed?';
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let onConfirm: () => void = () => {};
  export let onCancel: () => void = () => {};

  function handleConfirm() {
    onConfirm();
    isOpen = false;
  }

  function handleCancel() {
    onCancel();
    isOpen = false;
  }
</script>

<Modal bind:isOpen {title} onClose={handleCancel} maxWidthClass="sm:max-w-sm">
  <div class="space-y-6">
    <p class="text-sm text-muted-foreground">{message}</p>
    
    <div class="flex items-center justify-end gap-3 mt-6">
      <button onclick={handleCancel} class="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
        {cancelText}
      </button>
      <button onclick={handleConfirm} class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
        {confirmText}
      </button>
    </div>
  </div>
</Modal>
