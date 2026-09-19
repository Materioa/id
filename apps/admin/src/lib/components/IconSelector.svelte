<script lang="ts" module>
  import * as allIcons from '@hugeicons/core-free-icons';

  export function getHugeIcon(iconName: string | undefined | null) {
    if (!iconName) return null;
    const name = iconName.trim();
    if (!name || name === '&#8206;' || name === 'none') return null;
    if ((allIcons as any)[name]) return (allIcons as any)[name];
    if (!name.endsWith('Icon') && (allIcons as any)[`${name}Icon`]) {
      return (allIcons as any)[`${name}Icon`];
    }
    const lower = name.toLowerCase();
    const lowerWithIcon = lower.endsWith('icon') ? lower : `${lower}icon`;
    const match = Object.keys(allIcons).find(k => k.toLowerCase() === lower || k.toLowerCase() === lowerWithIcon);
    if (match) return (allIcons as any)[match];
    return null;
  }
</script>

<script lang="ts">
  import Modal from './Modal.svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Search01Icon, Cancel01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';

  let {
    isOpen = $bindable(false),
    selectedIcon = '',
    onSelect = () => {},
    onClose = () => {}
  }: {
    isOpen?: boolean;
    selectedIcon?: string;
    onSelect?: (icon: string) => void;
    onClose?: () => void;
  } = $props();

  let searchQuery = $state('');
  let activeCategory = $state<'popular' | 'arrows' | 'actions' | 'rewards' | 'media' | 'communication' | 'all'>('popular');

  const categorizedIcons: Record<string, string[]> = {
    popular: [
      'SparklesIcon', 'StarIcon', 'Rocket01Icon', 'FireIcon', 'GiftIcon', 'HeartIcon',
      'FlashIcon', 'Notification01Icon', 'Megaphone01Icon', 'ArrowRight01Icon', 'ArrowLeft01Icon',
      'CheckmarkCircle01Icon', 'Link01Icon', 'Download01Icon', 'PlayIcon', 'ShoppingBag01Icon',
      'Tag01Icon', 'Book01Icon', 'Calendar01Icon', 'UserIcon', 'Settings01Icon'
    ],
    arrows: [
      'ArrowRight01Icon', 'ArrowLeft01Icon', 'ArrowUp01Icon', 'ArrowDown01Icon',
      'ArrowRight02Icon', 'ArrowLeft02Icon', 'ChevronRightIcon', 'ChevronLeftIcon',
      'ChevronUpIcon', 'ChevronDownIcon', 'Compass01Icon', 'Globe01Icon', 'Home01Icon'
    ],
    actions: [
      'CheckmarkCircle01Icon', 'CheckmarkBadge01Icon', 'Delete01Icon', 'Edit01Icon',
      'Add01Icon', 'Cancel01Icon', 'Share01Icon', 'Copy01Icon', 'Download01Icon',
      'Upload01Icon', 'RefreshIcon', 'Search01Icon', 'FilterIcon', 'Settings01Icon'
    ],
    rewards: [
      'GiftIcon', 'Discount01Icon', 'Tag01Icon', 'ShoppingBag01Icon', 'ShoppingCart01Icon',
      'Coins01Icon', 'SparklesIcon', 'StarIcon', 'FireIcon', 'Rocket01Icon',
      'Award01Icon', 'CrownIcon', 'Trophy01Icon'
    ],
    media: [
      'Image01Icon', 'Video01Icon', 'MusicNote01Icon', 'File01Icon', 'Folder01Icon',
      'Book01Icon', 'BookOpen01Icon', 'Link01Icon', 'Calendar01Icon', 'Clock01Icon', 'PlayIcon'
    ],
    communication: [
      'UserIcon', 'UserGroupIcon', 'Mail01Icon', 'Message01Icon', 'Notification01Icon',
      'Megaphone01Icon', 'HelpCircleIcon', 'InformationCircleIcon', 'AlertCircleIcon',
      'ThumbsUpIcon', 'HeartIcon'
    ]
  };

  const categories = [
    { id: 'popular', label: 'Popular' },
    { id: 'arrows', label: 'Arrows' },
    { id: 'actions', label: 'Actions' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'media', label: 'Media' },
    { id: 'communication', label: 'Social' },
    { id: 'all', label: 'All' }
  ] as const;

  // Flatten unique icon names for 'all'
  const allCommonIcons = Array.from(new Set(Object.values(categorizedIcons).flat()));

  // Dynamically resolve filtered icons
  let displayedIcons = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      if (activeCategory === 'all') return allCommonIcons;
      return categorizedIcons[activeCategory] || categorizedIcons.popular;
    }

    // If there's a search query, search in allCommonIcons first
    const commonMatches = allCommonIcons.filter(name => {
      const clean = name.replace('Icon', '').toLowerCase();
      return clean.includes(q) || name.toLowerCase().includes(q);
    });

    // If query is 2+ chars, also search the full Hugeicons library
    if (q.length >= 2) {
      const fullMatches = Object.keys(allIcons)
        .filter(k => k.endsWith('Icon') && !k.endsWith('FreeIcons'))
        .filter(k => k.toLowerCase().includes(q))
        .slice(0, 48);

      return Array.from(new Set([...commonMatches, ...fullMatches]));
    }

    return commonMatches;
  });

  // Custom icon preview if query is typed
  let customIconDef = $derived(searchQuery.trim() ? getHugeIcon(searchQuery.trim()) : null);

  function selectIcon(iconName: string) {
    onSelect(iconName);
    isOpen = false;
    onClose();
  }

  function clearIcon() {
    onSelect('');
    isOpen = false;
    onClose();
  }

  function formatIconLabel(name: string) {
    return name
      .replace(/01Icon$/, '')
      .replace(/02Icon$/, '')
      .replace(/Icon$/, '');
  }
</script>

<Modal bind:isOpen title="Select an Icon" onClose={() => { isOpen = false; onClose(); }} maxWidthClass="sm:max-w-xl">
  <div class="space-y-4">
    <!-- Search Bar -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
        <HugeiconsIcon icon={Search01Icon} size={16} />
      </div>
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search icons (e.g. rocket, star, arrow, gift, check)..." 
        class="w-full pl-10 pr-10 py-2.5 bg-muted/40 border border-border/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/60"
      />
      {#if searchQuery}
        <button 
          type="button" 
          onclick={() => searchQuery = ''}
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
          title="Clear search"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      {/if}
    </div>

    <!-- Category Pills (hidden when actively searching) -->
    {#if !searchQuery}
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {#each categories as cat}
          <button 
            type="button"
            onclick={() => activeCategory = cat.id}
            class="px-3 py-1.5 rounded-full transition-all whitespace-nowrap font-medium {activeCategory === cat.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'}"
          >
            {cat.label}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Custom Icon Search Preview banner -->
    {#if searchQuery && customIconDef}
      <div class="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 text-sm">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-background flex items-center justify-center text-primary shadow-xs">
            <HugeiconsIcon icon={customIconDef} size={20} />
          </div>
          <div>
            <div class="font-medium text-foreground text-xs">Matched Hugeicon</div>
            <div class="text-xs text-muted-foreground font-mono">{searchQuery.trim()}</div>
          </div>
        </div>
        <button 
          type="button"
          onclick={() => selectIcon(searchQuery.trim().endsWith('Icon') ? searchQuery.trim() : `${searchQuery.trim()}Icon`)}
          class="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          Select Icon
        </button>
      </div>
    {/if}

    <!-- Icon Grid -->
    <div class="max-h-[320px] overflow-y-auto pr-1">
      {#if displayedIcons.length === 0}
        <div class="py-12 text-center text-muted-foreground space-y-2">
          <p class="text-sm">No icons found matching "{searchQuery}"</p>
          {#if searchQuery}
            <button 
              type="button"
              onclick={() => selectIcon(searchQuery.trim())}
              class="text-xs text-primary hover:underline font-medium"
            >
              Use "{searchQuery.trim()}" as custom icon value
            </button>
          {/if}
        </div>
      {:else}
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {#each displayedIcons as iconName}
            {@const iconObj = getHugeIcon(iconName)}
            {#if iconObj}
              {@const isSelected = selectedIcon === iconName || selectedIcon === formatIconLabel(iconName)}
              <button 
                type="button"
                onclick={() => selectIcon(iconName)}
                class="group flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer {isSelected ? 'border-primary bg-primary/10 text-primary shadow-xs' : 'border-border/40 hover:border-primary/40 hover:bg-muted/50 text-foreground'}"
                title={iconName}
              >
                <div class="w-7 h-7 flex items-center justify-center transition-transform group-hover:scale-110">
                  <HugeiconsIcon icon={iconObj} size={20} />
                </div>
                <span class="text-[10px] text-muted-foreground group-hover:text-foreground mt-1.5 truncate w-full text-center font-normal transition-colors">
                  {formatIconLabel(iconName)}
                </span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Bottom Actions -->
    <div class="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
      <span class="text-muted-foreground">
        {displayedIcons.length} icon{displayedIcons.length === 1 ? '' : 's'} available
      </span>
      {#if selectedIcon}
        <button 
          type="button"
          onclick={clearIcon}
          class="text-muted-foreground hover:text-destructive transition-colors font-medium cursor-pointer"
        >
          Remove icon (clear)
        </button>
      {/if}
    </div>
  </div>
</Modal>
