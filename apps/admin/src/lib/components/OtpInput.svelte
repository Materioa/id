<script lang="ts">
  let { value = $bindable(''), length = 6 }: { value: string, length?: number } = $props();
  
  let inputs: HTMLInputElement[] = $state([]);
  
  function handleInput(e: Event, i: number) {
    const input = e.target as HTMLInputElement;
    let val = input.value;
    
    // allow only numbers
    val = val.replace(/\D/g, '');
    input.value = val;
    
    if (val) {
      const newArr = value.padEnd(length, ' ').split('');
      newArr[i] = val.substring(val.length - 1);
      value = newArr.join('').trim();
      
      if (i < length - 1) {
        inputs[i + 1].focus();
      }
    } else {
      const newArr = value.padEnd(length, ' ').split('');
      newArr[i] = ' ';
      value = newArr.join('').trim();
    }
  }

  function handleKeydown(e: KeyboardEvent, i: number) {
    if (e.key === 'Backspace') {
      const input = e.target as HTMLInputElement;
      if (!input.value && i > 0) {
        inputs[i - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs[i - 1].focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      inputs[i + 1].focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') || '';
    const digits = pasted.replace(/\D/g, '').slice(0, length);
    if (digits) {
      value = digits;
      const focusIndex = Math.min(digits.length, length - 1);
      inputs[focusIndex]?.focus();
    }
  }
</script>

<div class="flex items-center gap-2 sm:gap-3">
  {#each Array(length) as _, i}
    <input
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="1"
      bind:this={inputs[i]}
      value={value[i] || ''}
      oninput={(e) => handleInput(e, i)}
      onkeydown={(e) => handleKeydown(e, i)}
      onpaste={handlePaste}
      class="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-medium bg-background border border-border rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground shadow-sm"
    />
  {/each}
</div>
