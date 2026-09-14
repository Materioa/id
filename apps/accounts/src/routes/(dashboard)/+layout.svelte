<script lang="ts">
  import { page } from '$app/stores';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    UserIcon,
    ShieldAlertIcon,
    Key01Icon,
    SidebarLeftIcon,
    Logout01Icon,
    Home01Icon,
    CreditCardIcon,
    Database02Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/user.svelte';
  import { getAppUrls } from '@materio/config';
  import ToastProvider from '$lib/components/ToastProvider.svelte';

  let { children } = $props();

  // Sidebar states
  let isCollapsed = $state(false);
  let isMobileMenuOpen = $state(false);

  // Suspension states
  let isSuspended = $state(false);
  let suspensionReason = $state('');

  // Theme states
  let theme = $state('system'); // 'light', 'dark', 'system'

  function applyTheme(themeType: string) {
    if (typeof window === 'undefined') return;
    const isDark = themeType === 'dark' || (themeType === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function setTheme(newTheme: string) {
    theme = newTheme;
    if (typeof window !== 'undefined') {
      localStorage.setItem('materio_theme', newTheme);
      applyTheme(newTheme);
    }
  }

  function cycleTheme() {
    if (theme === 'light') setTheme('system');
    else if (theme === 'system') setTheme('dark');
    else setTheme('light');
  }

  // Active route checking
  const isRouteActive = (href: string) => $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');

  // Breadcrumbs calculation
  const getBreadcrumbs = () => {
    const path = $page.url.pathname;
    if (path.includes('/profile')) return ['My Account', 'Personal Info'];
    if (path.includes('/security')) return ['My Account', 'Security & Access'];
    if (path.includes('/api-keys')) return ['My Account', 'Developer Apps'];
    if (path.includes('/overview')) return ['My Account', 'Home'];
    if (path.includes('/upgrade')) return ['My Account', 'Payments and Subscription'];
    if (path.includes('/data-controls')) return ['My Account', 'Data Controls'];
    return ['My Account', 'Home'];
  };

  // Nav list containing ONLY actual features
  const mainNav = [
    { name: 'Home', href: '/overview', icon: Home01Icon },
    { name: 'Personal Info', href: '/profile', icon: UserIcon },
    { name: 'Security', href: '/security', icon: ShieldAlertIcon },
    { name: 'Developer Apps', href: '/api-keys', icon: Key01Icon },
    { name: 'Payments and Subscription', href: '/upgrade', icon: CreditCardIcon },
    { name: 'Data Controls', href: '/data-controls', icon: Database02Icon }
  ];

  onMount(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      const appUrls = getAppUrls(window.location.origin);
      window.location.href = `${appUrls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
      return;
    }

    userStore.loadUser();

    fetch('/api/v2/profile', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then((data: any) => {
        if (data && data.user) {
          userStore.setUser(data.user);
          if (data.suspended || data.user.isBanned) {
            isSuspended = true;
            suspensionReason = data.banReason || data.user.banReason || 'Violation of terms of service';
          }
        }
      })
      .catch(console.error);

    const savedState = localStorage.getItem('sidebar_collapsed');
    if (savedState) isCollapsed = savedState === 'true';

    const savedTheme = localStorage.getItem('materio_theme') || 'system';
    setTheme(savedTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  });

  function toggleSidebar() {
    if (window.innerWidth < 768) {
      isMobileMenuOpen = false;
      return;
    }
    isCollapsed = !isCollapsed;
    localStorage.setItem('sidebar_collapsed', String(isCollapsed));
  }

  function closeMobileMenu() {
    isMobileMenuOpen = false;
  }

  function handleLogout() {
    userStore.logout();
    const appUrls = getAppUrls(window.location.origin);
    window.location.href = `${appUrls.auth}/logout?callback=${encodeURIComponent(window.location.origin)}`;
  }

  let crumbs = $derived(getBreadcrumbs());
</script>

{#if isSuspended}
  <div class="h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-6 relative select-none">
    <!-- Top Left Logo -->
    <div class="absolute top-6 left-6 flex items-center">
      <img src="/logo-wordmark.webp" alt="Materio" class="h-6 object-contain" />
    </div>

    <!-- Suspension Notice -->
    <div class="max-w-md w-full text-center space-y-6">
      <div class="mx-auto w-12 h-12 text-destructive flex items-center justify-center">
        <HugeiconsIcon icon={ShieldAlertIcon} size={36} />
      </div>

      <div class="space-y-3">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Account Suspended
        </h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          Your account has been suspended for <span class="font-medium text-foreground">{suspensionReason}</span> and thereby access has been revoked.
        </p>
      </div>

      <div class="flex items-center justify-center gap-3 pt-2">
        <a 
          href="mailto:support@getmaterio.app?subject={encodeURIComponent('Account Suspension Appeal - @' + (userStore.user?.username || 'user'))}&body={encodeURIComponent('Hello Materio Team,\n\nMy account (@' + (userStore.user?.username || '') + ') has been suspended for:\n' + suspensionReason + '\n\nI believe this was a mistake because:\n[Please explain why your account should be reinstated]\n\nThank you.')}"
          class="btn-base btn-primary"
        >
          File an Appeal
        </a>
        <button
          type="button"
          onclick={handleLogout}
          class="btn-base btn-secondary"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
{:else}
  <div class="h-screen bg-secondary text-foreground font-sans flex md:p-1 md:gap-1 overflow-hidden">
  <!-- Mobile Overlay -->
  {#if isMobileMenuOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 bg-black/50 z-40 md:hidden" onclick={closeMobileMenu}></div>
  {/if}

  <!-- Sidebar Container -->
  <aside 
    class="bg-secondary md:bg-transparent flex flex-col justify-between transition-all duration-300 select-none
      fixed md:relative z-50 md:z-auto top-0 left-0 h-full
      {isMobileMenuOpen ? '/*  */w-[260px] translate-x-0' : '-translate-x-full md:translate-x-0'}
      {isCollapsed ? 'md:w-10' : 'md:w-55'}
      md:translate-x-0
    "
  >
    <!-- Sidebar Top Navigation Controls (Sticky) -->
    <div class="px-4 md:px-2 pt-4 md:pt-2 pb-2 sticky top-0 z-20 bg-secondary md:bg-transparent">
      <!-- Sidebar Title & Toggle -->
      <div class="flex items-center {(isCollapsed && !isMobileMenuOpen) ? 'justify-center w-full' : 'justify-between px-1'} mb-8 h-8">
        {#if !(isCollapsed && !isMobileMenuOpen)}
          <div class="flex items-center gap-2 animate-in fade-in duration-300">
            <img src="/logo-wordmark.webp" alt="Materio" class="h-8 object-contain transition-all" />
          </div>
        {/if}

        <button 
          onclick={toggleSidebar} 
          class="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted transition-colors shrink-0 flex items-center justify-center {(isCollapsed && !isMobileMenuOpen) ? '' : 'mt-1'} md:flex {isMobileMenuOpen ? 'hidden' : ''}"
          title={(isCollapsed && !isMobileMenuOpen) ? "Expand sidebar" : "Collapse sidebar"}
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={16} />
        </button>
      </div>

      <!-- Navigation Arrows and History search removed per user request -->

    </div>

    <!-- Scrollable Middle Section -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-2 no-scrollbar mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)] -my-2 py-2">
      <!-- Primary Nav Sections -->
      <div class="space-y-6 pt-4 pb-4">
        <!-- Main Nav -->
        <div>
          <nav class="space-y-0.5">
            {#each mainNav as item}
              <a 
                href={item.href} 
                onclick={closeMobileMenu}
                class="flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 {isRouteActive(item.href) ? 'bg-background shadow-[0_1px_3px_rgba(0,0,0,0.05)] font-semibold text-foreground border border-border/50' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} {(isCollapsed && !isMobileMenuOpen) ? 'md:justify-center' : ''}"
                title={item.name}
              >
                <HugeiconsIcon icon={item.icon} size={16} class="shrink-0 {isRouteActive(item.href) ? 'text-foreground font-bold' : 'text-muted-foreground'}" />
                {#if !(isCollapsed && !isMobileMenuOpen)}
                  <span class="truncate">{item.name}</span>
                {/if}
              </a>
            {/each}
          </nav>
        </div>
      </div>
    </div>

    <!-- Sidebar Footer (Sticky) -->
    <div class="px-2 pb-2 pt-2 space-y-1 sticky bottom-0 z-20 bg-secondary md:bg-transparent">
      <!-- Theme Switcher Pill -->

      <div class="flex justify-center {(isCollapsed && !isMobileMenuOpen) ? 'mb-4' : 'mb-2 px-1'}">
        {#if (isCollapsed && !isMobileMenuOpen)}
          <button 
            onclick={cycleTheme} 
            class="w-full aspect-square flex items-center justify-center rounded-xl bg-background border border-border/50 text-foreground hover:bg-muted/40 transition-colors shadow-sm"
            title="Toggle Theme"
          >
            {#if theme === 'light'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            {:else if theme === 'dark'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            {/if}
          </button>
        {:else}
          <div class="flex items-center p-1 bg-muted/40 border border-border/40 rounded-full w-full">
            <button onclick={() => setTheme('light')} class="flex-1 flex items-center justify-center p-1.5 rounded-full transition-all {theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-zinc-500 hover:text-foreground'}" title="Light">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            </button>
            <button onclick={() => setTheme('system')} class="flex-1 flex items-center justify-center p-1.5 rounded-full transition-all {theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-zinc-500 hover:text-foreground'}" title="System">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </button>
            <button onclick={() => setTheme('dark')} class="flex-1 flex items-center justify-center p-1.5 rounded-full transition-all {theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-zinc-500 hover:text-foreground'}" title="Dark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            </button>
          </div>
        {/if}
      </div>


      <button 
        onclick={handleLogout}
        class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 {(isCollapsed && !isMobileMenuOpen) ? 'justify-center' : ''}"
        title="Logout"
      >
        <HugeiconsIcon icon={Logout01Icon} size={16} class="shrink-0 text-muted-foreground" />
        {#if !(isCollapsed && !isMobileMenuOpen)}
          <span>Logout</span>
        {/if}
      </button>
    </div>
  </aside>

  <!-- Main Content Panel -->
  <main class="flex-1 bg-background md:border md:border-border md:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden">
    <!-- Main Content Header -->
    <header class="h-14 px-4 md:px-6 flex items-center justify-between shrink-0 select-none bg-background border-b md:border-b-0 border-border/50">
      <!-- Mobile hamburger -->
      <button 
        onclick={() => isMobileMenuOpen = !isMobileMenuOpen}
        class="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors -ml-1"
        aria-label="Toggle menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
      </button>
      <!-- Breadcrumbs -->
      <div class="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>{crumbs[0]}</span>
        <span class="text-border/80">/</span>
        <span class="font-semibold text-foreground flex items-center gap-1.5">
          {#if crumbs[1] === 'Personal Info'}
            <HugeiconsIcon icon={UserIcon} size={14} class="text-muted-foreground shrink-0" />
          {/if}
          {crumbs[1]}
        </span>
      </div>
    </header>

    <!-- Main Content Page Frame -->
    <div class="flex-1 overflow-y-auto bg-background relative px-2 md:px-0">
      {@render children()}
    </div>
  </main>
</div>
{/if}

<ToastProvider />
