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
    Database02Icon,
    Globe02Icon,
    Shield01Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/user.svelte';
  import { getAppUrls, getClientCookie, setClientCookie, clearClientCookie } from '@materio/config';
  import ToastProvider from '$lib/components/ToastProvider.svelte';

  let { children } = $props();

  // Sidebar states
  let isCollapsed = $state(false);
  let isMobileMenuOpen = $state(false);
  let appUrls = $state(getAppUrls());
  let hasAdminPrivileges = $derived(Boolean(userStore.user?.hasAdminPrivileges || userStore.user?.has_admin_privileges || userStore.isAdmin));

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
    if (path.includes('/profile')) return ['Materio ID', 'Personal Info'];
    if (path.includes('/security')) return ['Materio ID', 'Security & Access'];
    if (path.includes('/api-keys')) return ['Materio ID', 'Developer Apps'];
    if (path.includes('/overview')) return ['Materio ID', 'Home'];
    if (path.includes('/upgrade')) return ['Materio ID', 'Payments and Subscription'];
    if (path.includes('/data-controls')) return ['Materio ID', 'Data Controls'];
    return ['Materio ID', 'Home'];
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
    async function initSession() {
      // 1. Universal handoff code exchange if present in URL
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        try {
          const res = await fetch('/api/v2/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'exchange', code })
          });
          const data = await res.json() as any;
          if (data.token) {
            localStorage.setItem('token', data.token);
            setClientCookie('materio_token', data.token);
            if (data.user) {
              userStore.setUser(data.user);
            }
            // Remove ?code= from the URL cleanly
            searchParams.delete('code');
            const newSearch = searchParams.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (err) {
          console.error('Failed to exchange handoff code:', err);
        }
      }

      // 2. Synchronize with shared cross-app cookie
      const cookieToken = getClientCookie('materio_token');
      let token = localStorage.getItem('token');

      if (cookieToken && cookieToken !== token) {
        token = cookieToken;
        localStorage.setItem('token', cookieToken);
      } else if (!token && cookieToken) {
        token = cookieToken;
        localStorage.setItem('token', cookieToken);
      } else if (token && !cookieToken) {
        setClientCookie('materio_token', token);
      }

      if (!token) {
        const appUrls = getAppUrls(window.location.origin);
        window.location.href = `${appUrls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback?next=' + encodeURIComponent(window.location.pathname + window.location.search))}`;
        return;
      }

      userStore.loadUser();

      try {
        const res = await fetch('/api/v2/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) {
          // Stale / revoked session: clear all storages and redirect
          localStorage.removeItem('token');
          clearClientCookie('materio_token');
          userStore.logout();
          const appUrls = getAppUrls(window.location.origin);
          window.location.href = `${appUrls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
          return;
        }
        const data = await res.json() as any;
        if (data && data.user) {
          userStore.setUser(data.user);
          if (data.suspended || data.user.isBanned) {
            isSuspended = true;
            suspensionReason = data.banReason || data.user.banReason || 'Violation of terms of service';
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    initSession();

    appUrls = getAppUrls(window.location.origin);

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
    clearClientCookie('materio_token');
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
        <h1 class="text-2xl font-serif font-normal tracking-tight text-foreground">
          Materio ID Suspended
        </h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          Your Materio ID has been suspended for <span class="font-medium text-foreground">{suspensionReason}</span> and thereby access has been revoked.
        </p>
      </div>

      <div class="flex items-center justify-center gap-3 pt-2">
        <a 
          href="mailto:support@getmaterio.app?subject={encodeURIComponent('Materio ID Suspension Appeal - @' + (userStore.user?.username || 'user'))}&body={encodeURIComponent('Hello Materio Team,\n\nMy Materio ID (@' + (userStore.user?.username || '') + ') has been suspended for:\n' + suspensionReason + '\n\nI believe this was a mistake because:\n[Please explain why your Materio ID should be reinstated]\n\nThank you.')}"
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
  <div class="h-screen bg-background text-foreground font-sans flex md:p-1.5 md:gap-1.5 overflow-hidden">
  <!-- Mobile Overlay -->
  {#if isMobileMenuOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 bg-black/50 z-40 md:hidden" onclick={closeMobileMenu}></div>
  {/if}

  <!-- Sidebar Container -->
  <aside 
    class="bg-background md:bg-transparent flex flex-col justify-between transition-all duration-300 select-none
      fixed md:relative z-50 md:z-auto top-0 left-0 h-full
      {isMobileMenuOpen ? 'w-[260px] translate-x-0' : '-translate-x-full md:translate-x-0'}
      {isCollapsed ? 'md:w-10' : 'md:w-56'}
      md:translate-x-0
    "
  >
    <!-- Sidebar Top Navigation Controls (Sticky) -->
    <div class="px-4 md:px-2 pt-4 md:pt-2 pb-2 sticky top-0 z-20 bg-background md:bg-transparent">
      <!-- Sidebar Title & Toggle -->
      <div class="flex items-center {(isCollapsed && !isMobileMenuOpen) ? 'justify-center w-full' : 'justify-between px-1'} mb-8 h-8">
        {#if !(isCollapsed && !isMobileMenuOpen)}
          <div class="flex items-center gap-2 animate-in fade-in duration-300 shrink-0">
            <img src="/logo-wordmark.webp" alt="Materio" class="h-7 md:h-8 w-auto shrink-0 object-contain transition-all" />
          </div>
        {/if}

        <button 
          onclick={toggleSidebar} 
          class="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/60 transition-colors shrink-0 flex items-center justify-center {(isCollapsed && !isMobileMenuOpen) ? '' : 'mt-1'} md:flex {isMobileMenuOpen ? 'hidden' : ''}"
          title={(isCollapsed && !isMobileMenuOpen) ? "Expand sidebar" : "Collapse sidebar"}
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={16} />
        </button>
      </div>

    </div>

    <!-- Scrollable Middle Section -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-2 no-scrollbar mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)] -my-2 py-2">
      <!-- Primary Nav Sections -->
      <div class="space-y-6 pt-4 pb-4">
        <!-- Main Nav -->
        <div>
          <nav class="space-y-1">
            {#each mainNav as item}
              <a 
                href={item.href} 
                onclick={closeMobileMenu}
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 {isRouteActive(item.href) ? 'bg-card shadow-xs font-medium text-foreground border border-border/80' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'} {(isCollapsed && !isMobileMenuOpen) ? 'md:justify-center' : ''}"
                title={item.name}
              >
                <HugeiconsIcon icon={item.icon} size={16} class="shrink-0 {isRouteActive(item.href) ? 'text-primary' : 'text-muted-foreground'}" />
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
    <div class="px-2 pb-2 pt-2 space-y-1 sticky bottom-0 z-20 bg-background md:bg-transparent">
      <!-- Quick App / Admin Switcher -->
      <div class="flex justify-center {(isCollapsed && !isMobileMenuOpen) ? 'mb-2' : 'mb-2 px-1'}">
        {#if (isCollapsed && !isMobileMenuOpen)}
          {#if hasAdminPrivileges}
            <div class="flex flex-col gap-1 w-full">
              <a 
                href={appUrls.app || 'https://getmaterio.app'} 
                class="w-full aspect-square flex items-center justify-center rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
                title="Go to app"
              >
                <HugeiconsIcon icon={Globe02Icon} size={15} />
              </a>
              <a 
                href={appUrls.admin} 
                class="w-full aspect-square flex items-center justify-center rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
                title="Go to admin"
              >
                <HugeiconsIcon icon={Shield01Icon} size={15} />
              </a>
            </div>
          {:else}
            <a 
              href={appUrls.app || 'https://getmaterio.app'} 
              class="w-full aspect-square flex items-center justify-center rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
              title="Go to app"
            >
              <HugeiconsIcon icon={Globe02Icon} size={15} />
            </a>
          {/if}
        {:else}
          {#if hasAdminPrivileges}
            <div class="flex items-center gap-1 w-full">
              <a 
                href={appUrls.app || 'https://getmaterio.app'} 
                class="flex-1 flex items-center justify-center py-1.5 px-2 text-xs font-medium rounded-l-full rounded-r-[5px] bg-muted/70 hover:bg-muted text-foreground border border-border/70 hover:border-border transition-all text-center truncate shadow-2xs active:scale-[0.98]"
                title="Go to app"
              >
                <span class="truncate">Go to app</span>
              </a>
              <a 
                href={appUrls.admin} 
                class="flex-1 flex items-center justify-center py-1.5 px-2 text-xs font-medium rounded-l-[5px] rounded-r-full bg-muted/70 hover:bg-muted text-foreground border border-border/70 hover:border-border transition-all text-center truncate shadow-2xs active:scale-[0.98]"
                title="Go to admin"
              >
                <span class="truncate">Go to admin</span>
              </a>
            </div>
          {:else}
            <a 
              href={appUrls.app || 'https://getmaterio.app'} 
              class="w-full flex items-center justify-center py-1.5 px-3 text-xs font-medium rounded-full bg-muted/70 hover:bg-muted text-foreground border border-border/70 hover:border-border transition-all text-center truncate shadow-2xs active:scale-[0.98]"
              title="Go to app"
            >
              <span class="truncate">Go to app</span>
            </a>
          {/if}
        {/if}
      </div>

      <!-- Theme Switcher Pill -->
      <div class="flex justify-center {(isCollapsed && !isMobileMenuOpen) ? 'mb-4' : 'mb-2 px-1'}">
        {#if (isCollapsed && !isMobileMenuOpen)}
          <button 
            onclick={cycleTheme} 
            class="w-full aspect-square flex items-center justify-center rounded-lg bg-card border border-border/80 text-foreground hover:bg-muted/50 transition-colors shadow-xs"
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
          <div class="flex items-center p-1 bg-muted/60 border border-border/70 rounded-full w-full">
            <button onclick={() => setTheme('light')} class="flex-1 flex items-center justify-center p-1.5 rounded-full transition-all {theme === 'light' ? 'bg-card shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}" title="Light">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            </button>
            <button onclick={() => setTheme('system')} class="flex-1 flex items-center justify-center p-1.5 rounded-full transition-all {theme === 'system' ? 'bg-card shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}" title="System">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </button>
            <button onclick={() => setTheme('dark')} class="flex-1 flex items-center justify-center p-1.5 rounded-full transition-all {theme === 'dark' ? 'bg-card shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}" title="Dark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            </button>
          </div>
        {/if}
      </div>

      <button 
        onclick={handleLogout}
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-150 {(isCollapsed && !isMobileMenuOpen) ? 'justify-center' : ''}"
        title="Logout"
      >
        <HugeiconsIcon icon={Logout01Icon} size={16} class="shrink-0 text-muted-foreground" />
        {#if !(isCollapsed && !isMobileMenuOpen)}
          <span>Logout</span>
        {/if}
      </button>
    </div>
  </aside>

  <!-- Main Content Panel: Pure Surface Card with Hairline Border -->
  <main class="flex-1 bg-card md:border md:border-border/80 md:rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden">
    <!-- Main Content Header -->
    <header class="h-14 px-4 md:px-6 flex items-center justify-between shrink-0 select-none bg-card border-b border-border/60">
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
        <span class="text-border">/</span>
        <span class="font-medium text-foreground flex items-center gap-1.5">
          {#if crumbs[1] === 'Personal Info'}
            <HugeiconsIcon icon={UserIcon} size={14} class="text-muted-foreground shrink-0" />
          {/if}
          {crumbs[1]}
        </span>
      </div>
    </header>

    <!-- Main Content Page Frame -->
    <div class="flex-1 overflow-y-auto bg-card relative px-2 md:px-0">
      {@render children()}
    </div>
  </main>
</div>
{/if}

<ToastProvider />
