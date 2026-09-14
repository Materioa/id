<script lang="ts">
  import { smoothCorners } from '@lisse/svelte';
  import { Mail, ArrowRight, ArrowLeft } from 'lucide-svelte';
  
  let email = $state('');
  
  function handleReset(e: Event) {
    e.preventDefault();
    // Implementation for reset password
  }
</script>

<div class="min-h-screen w-full bg-zinc-950 flex items-center justify-center relative overflow-hidden">
  <div class="absolute inset-0 z-0">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-amber-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
  </div>

  <div class="w-full max-w-md z-10 p-6">
    <div use:smoothCorners={{ corners: { radius: 8 } }} class="bg-zinc-900/60 backdrop-blur-xl border border-white/10 p-8 shadow-2xl relative overflow-hidden group">
      
      <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div class="mb-10 text-center">
        <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Reset Password</h1>
        <p class="text-zinc-400">We'll send you a link to reset your password</p>
      </div>

      <form onsubmit={handleReset} class="space-y-6">
        <div class="space-y-2">
          <label for="email" class="text-sm font-medium text-zinc-300">Email Address</label>
          <div class="relative group/input">
            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within/input:text-amber-400 transition-colors" />
            <input 
              id="email"
              type="email" 
              bind:value={email}
              placeholder="you@example.com"
              class="w-full bg-zinc-950/50 border border-white/10 text-white placeholder:text-zinc-600 pl-10 pr-4 py-3 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
              use:smoothCorners={{ corners: { radius: 8 } }}
            />
          </div>
        </div>

        <button 
          type="submit" 
          class="w-full bg-background text-foreground border border-border/80 font-semibold py-3 flex items-center justify-center gap-2 hover:bg-secondary active:scale-[0.98] transition-all relative overflow-hidden group/btn"
          use:smoothCorners={{ corners: { radius: 8 } }}
        >
          <span>Send Reset Link</span>
          <ArrowRight class="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </form>
      
      <p class="mt-8 text-center text-sm text-zinc-400 flex items-center justify-center gap-2">
        <ArrowLeft class="w-4 h-4" />
        <a href="/login" class="text-white hover:underline underline-offset-4">Back to sign in</a>
      </p>
    </div>
  </div>
</div>
