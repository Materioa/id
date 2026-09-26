<script lang="ts">
  import { page } from '$app/stores';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { 
    DashboardSquare01Icon,
    SidebarLeftIcon,
    Logout01Icon,
    Upload01Icon,
    Folder01Icon,
    Megaphone01Icon,
    CodeIcon,
    TestTube01Icon,
    Notification01Icon,
    UserAdd01Icon,
    ShieldAlertIcon,
    Globe02Icon,
    UserIcon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { userStore } from '$lib/stores/user.svelte';
  import { getAppUrls, getClientCookie, setClientCookie, clearClientCookie } from '@materio/config';
  import ToastProvider from '$lib/components/ToastProvider.svelte';

  let { children } = $props();

  // Access control states
  let isVerifying = $state(true);
  let hasAccess = $state(false);
  let accessError = $state('');

  // Sidebar states
  let isCollapsed = $state(false);
  let isMobileMenuOpen = $state(false);
  let appUrls = $state(getAppUrls());

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
    if (path.includes('/admin/uploads')) return ['Admin', 'Uploads'];
    if (path.includes('/admin/files')) return ['Admin', 'File Management'];
    if (path.includes('/admin/promotions')) return ['Admin', 'Promotions'];
    if (path.includes('/admin/forms')) return ['Admin', 'Forms & Wizards'];
    if (path.includes('/admin/releases')) return ['Admin', 'Releases'];
    if (path.includes('/admin/exams')) return ['Admin', 'Exams & Seating'];
    if (path.includes('/admin/notifications')) return ['Admin', 'Notifications'];
    if (path.includes('/admin/invites')) return ['Admin', 'Invites'];
    if (path.includes('/admin/bans')) return ['Admin', 'Bans'];
    if (path.includes('/admin/overview')) return ['Admin', 'Overview'];
    return ['Admin', 'Portal'];
  };

  const adminNav = [
    { name: 'Overview', href: '/admin/overview', icon: DashboardSquare01Icon },
    { name: 'Uploads', href: '/admin/uploads', icon: Upload01Icon },
    { name: 'File Management', href: '/admin/files', icon: Folder01Icon },
    { name: 'Promotions', href: '/admin/promotions', icon: Megaphone01Icon },
    { name: 'Forms & Wizards', href: '/admin/forms', icon: Folder01Icon },
    { name: 'Releases', href: '/admin/releases', icon: CodeIcon },
    { name: 'Exams & Seating', href: '/admin/exams', icon: TestTube01Icon },
    { name: 'Notifications', href: '/admin/notifications', icon: Notification01Icon },
    { name: 'Invites', href: '/admin/invites', icon: UserAdd01Icon },
    { name: 'Bans', href: '/admin/bans', icon: ShieldAlertIcon }
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
      const appUrls = getAppUrls(window.location.origin);

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
        window.location.href = `${appUrls.auth}/login?callback=` + encodeURIComponent(window.location.origin + '/auth/callback?next=' + encodeURIComponent(window.location.pathname + window.location.search));
        return;
      }

      userStore.loadUser();

      try {
        const res = await fetch('/api/v2/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to verify profile');
        const data = await res.json() as any;
        if (data && data.user) {
          userStore.setUser(data.user);
          const isAdminUser = Boolean(
            data.user.hasAdminPrivileges === true ||
            data.user.has_admin_privileges === true ||
            userStore.isAdmin
          );
          if (isAdminUser) {
            hasAccess = true;
            isVerifying = false;
          } else {
            hasAccess = false;
            isVerifying = false;
            accessError = 'Superuser / Admin privileges required to access this portal.';
            localStorage.removeItem('token');
            clearClientCookie('materio_token');
            localStorage.removeItem('materio_user');
            setTimeout(() => {
              window.location.href = `${appUrls.accounts}/overview`;
            }, 3000);
          }
        } else {
          throw new Error('Invalid user profile');
        }
      } catch (err) {
        console.error(err);
        hasAccess = false;
        isVerifying = false;
        accessError = 'Authentication failed. Redirecting to login...';
        localStorage.removeItem('token');
        clearClientCookie('materio_token');
        setTimeout(() => {
          window.location.href = `${appUrls.auth}/login?callback=` + encodeURIComponent(window.location.origin + '/auth/callback');
        }, 2000);
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
    window.location.href = `${appUrls.auth}/logout?callback=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
  }

  let crumbs = $derived(getBreadcrumbs());
</script>

{#if isVerifying}
  <div class="h-screen w-full flex flex-col items-center justify-center bg-background p-4 text-center">
    <div class="inline-block animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
    <h2 class="text-lg font-semibold mb-1">Verifying Admin Privileges...</h2>
    <p class="text-sm text-muted-foreground">Please wait while we confirm your security access level.</p>
  </div>
{:else if !hasAccess}
  <div class="h-screen w-full flex flex-col items-center justify-center bg-background p-4 text-center">
    <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 text-destructive mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
    </div>
    <h2 class="text-2xl font-bold mb-2 text-foreground">Access Denied</h2>
    <p class="text-sm text-muted-foreground max-w-sm mb-6">{accessError || 'You need superuser / admin privileges to view this portal.'}</p>
    <div class="flex gap-3">
      <button 
        onclick={() => { const u = getAppUrls(window.location.origin); window.location.href = `${u.accounts}/overview`; }}
        class="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Go to Materio ID
      </button>
      <button 
        onclick={handleLogout}
        class="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Sign Out
      </button>
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
          <!-- Admin Category -->
          <div>

            <nav class="space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
              {#each adminNav as item}
                <a 
                  href={item.href} 
                  onclick={closeMobileMenu}
                  class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 {isRouteActive(item.href) ? 'bg-card shadow-xs font-medium text-foreground border border-border/80' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'} {(isCollapsed && !isMobileMenuOpen) ? 'md:justify-center' : ''}"
                  title={item.name}
                >
                  <HugeiconsIcon icon={item.icon} size={16} class="shrink-0 {isRouteActive(item.href) ? 'text-primary' : 'text-muted-foreground'}" />
                  {#if !(isCollapsed && !isMobileMenuOpen)}
                    <span class="truncate pl-2 border-l border-border/40 ml-1">{item.name}</span>
                  {/if}
                </a>
              {/each}
            </nav>
          </div>
        </div>
      </div>

      <!-- Sidebar Footer (Sticky) -->
      <div class="px-2 pb-2 pt-2 space-y-1 sticky bottom-0 z-20 bg-background md:bg-transparent">
        <!-- Quick App / Account Switcher -->
        <div class="flex justify-center {(isCollapsed && !isMobileMenuOpen) ? 'mb-2' : 'mb-2 px-1'}">
          {#if (isCollapsed && !isMobileMenuOpen)}
            <div class="flex flex-col gap-1 w-full">
              <a 
                href={appUrls.app || 'https://getmaterio.app'} 
                class="w-full aspect-square flex items-center justify-center rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
                title="Go to app"
              >
                <HugeiconsIcon icon={Globe02Icon} size={15} />
              </a>
              <a 
                href={`${appUrls.accounts}/overview`} 
                class="w-full aspect-square flex items-center justify-center rounded-lg bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-xs"
                title="Go to account"
              >
                <HugeiconsIcon icon={UserIcon} size={15} />
              </a>
            </div>
          {:else}
            <div class="flex items-center gap-1 w-full">
              <a 
                href={appUrls.app || 'https://getmaterio.app'} 
                class="flex-1 flex items-center justify-center py-1.5 px-2 text-xs font-medium rounded-l-full rounded-r-[5px] bg-muted/70 hover:bg-muted text-foreground border border-border/70 hover:border-border transition-all text-center truncate shadow-2xs active:scale-[0.98]"
                title="Go to app"
              >
                <span class="truncate">Go to app</span>
              </a>
              <a 
                href={`${appUrls.accounts}/overview`} 
                class="flex-1 flex items-center justify-center py-1.5 px-2 text-xs font-medium rounded-l-[5px] rounded-r-full bg-muted/70 hover:bg-muted text-foreground border border-border/70 hover:border-border transition-all text-center truncate shadow-2xs active:scale-[0.98]"
                title="Go to account"
              >
                <span class="truncate">Go to account</span>
              </a>
            </div>
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
