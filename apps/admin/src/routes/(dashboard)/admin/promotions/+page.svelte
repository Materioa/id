<svelte:head>
  <title>Promotions</title>
</svelte:head>

<script lang="ts">
  import { makeAdminRequest } from "$lib/api/admin";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import {
    Megaphone01Icon,
    Add01Icon,
    CheckmarkCircle01Icon,
    Delete01Icon,
    Calendar01Icon,
    Edit01Icon,
    Clock01Icon,
    ViewIcon,
    Upload01Icon,
  } from "@hugeicons/core-free-icons";
  import { onMount } from "svelte";
  import { addToast } from "$lib/stores/toast";
  import Modal from "$lib/components/Modal.svelte";
  import Checkbox from "$lib/components/Checkbox.svelte";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import IconSelector, {
    getHugeIcon,
  } from "$lib/components/IconSelector.svelte";

  type Promotion = {
    id: string;
    title: string;
    description: string;
    category: string;
    link?: string;
    frequency?: string;
    customFrequencyHours?: string;
    media?: string[];
    mediaFit?: string;
    showImageOnMaintenance?: boolean;
    orientation?: string;
    imageRotationInterval?: number;
    imageAnimation?: {
      type: string;
      duration: number;
    };
    isLimitedOffer?: boolean;
    startDate?: string;
    endDate?: string;
    showDateInfo?: boolean;
    buttons?: {
      primary?: {
        show?: boolean;
        text?: string;
        icon?: string;
        url?: string;
      };
      secondary?: {
        show?: boolean;
        text?: string;
        icon?: string;
        url?: string;
      };
    };
    disclaimer?: {
      show?: boolean;
      text?: string;
      linkText?: string;
      linkUrl?: string;
    };
    // Legacy fallbacks
    buttonText?: string;
    buttonLink?: string;
    buttonPrimaryIcon?: string;
    buttonSecondaryText?: string;
    buttonSecondaryLink?: string;
    buttonSecondaryIcon?: string;
    imageUrl?: string;
    isActive: boolean;
    createdAt?: string;
    lastUpdated?: string;
  };

  interface PromoForm {
    title: string;
    category: string;
    description: string;
    link: string;
    frequency: string;
    customFrequencyHours: string;
    media: string;
    mediaFit: string;
    showImageOnMaintenance: boolean;
    orientation: string;
    imageRotationInterval: number;
    imageAnimationType: string;
    imageAnimationDuration: number;
    isLimitedOffer: boolean;
    startDate: string;
    endDate: string;
    showDateInfo: boolean;
    buttons: {
      primary: {
        show: boolean;
        text: string;
        icon: string;
        url: string;
      };
      secondary: {
        show: boolean;
        text: string;
        icon: string;
        url: string;
      };
    };
    disclaimer: {
      show: boolean;
      text: string;
      linkText: string;
      linkUrl: string;
    };
    isActive: boolean;
  }

  function defaultPromoForm(): PromoForm {
    return {
      title: "",
      category: "whats-new",
      description: "",
      link: "",
      frequency: "daily",
      customFrequencyHours: "0",
      media: "",
      mediaFit: "scale-down",
      showImageOnMaintenance: false,
      orientation: "vertical",
      imageRotationInterval: 2500,
      imageAnimationType: "fade",
      imageAnimationDuration: 600,
      isLimitedOffer: false,
      startDate: "",
      endDate: "",
      showDateInfo: false,
      buttons: {
        primary: {
          show: true,
          text: "Learn More",
          icon: "ArrowRight01Icon",
          url: "",
        },
        secondary: {
          show: true,
          text: "Got it",
          icon: "",
          url: "",
        },
      },
      disclaimer: {
        show: false,
        text: "Terms and conditions apply.",
        linkText: "Read more",
        linkUrl: "",
      },
      isActive: true,
    };
  }

  let promotions = $state<Promotion[]>([]);
  let activePromotions = $derived(promotions.filter((p) => p.isActive));
  let historyPromotions = $derived(promotions.filter((p) => !p.isActive));
  let isLoading = $state(false);
  let activeTab = $state<"active" | "history">("active");

  // Form state
  let newPromo = $state<PromoForm>(defaultPromoForm());
  let isSubmitting = $state(false);
  let isPromoModalOpen = $state(false);
  let editingPromoId = $state<string | null>(null);
  let formSection = $state<
    "content" | "appearance" | "schedule" | "actions" | "disclaimer"
  >("content");
  let previewDevice = $state<"desktop" | "mobile">("desktop");

  // Confirm Modal state
  let isConfirmOpen = $state(false);
  let confirmTitle = $state("");
  let confirmMessage = $state("");
  let onConfirmAction = $state<() => void>(() => {});

  // Icon Selector state
  let isIconSelectorOpen = $state(false);
  let currentIconField = $state<"primary" | "secondary">("primary");

  function openIconSelector(field: "primary" | "secondary") {
    currentIconField = field;
    isIconSelectorOpen = true;
  }

  function handleIconSelect(iconName: string) {
    if (currentIconField === "primary") {
      newPromo.buttons.primary.icon = iconName;
    } else {
      newPromo.buttons.secondary.icon = iconName;
    }
  }

  async function loadPromotions() {
    isLoading = true;
    try {
      const res: any = await makeAdminRequest("promotions?all=true", "GET");
      promotions = Array.isArray(res) ? res : res.promotions || [];
    } catch (e: any) {
      console.error(e);
      promotions = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadPromotions();
  });

  function openNewPromoModal() {
    editingPromoId = null;
    newPromo = defaultPromoForm();
    formSection = "content";
    isPromoModalOpen = true;
  }

  function editPromotion(promo: Promotion) {
    editingPromoId = promo.id;
    formSection = "content";

    const mediaUrls =
      Array.isArray(promo.media) && promo.media.length > 0
        ? promo.media.join("\n")
        : promo.imageUrl || "";

    const primaryBtn = promo.buttons?.primary || {};
    const secondaryBtn = promo.buttons?.secondary || {};
    const disclaimerObj = promo.disclaimer || {};

    newPromo = {
      title: promo.title || "",
      category: promo.category || "whats-new",
      description: promo.description || "",
      link: promo.link || primaryBtn.url || promo.buttonLink || "",
      frequency: promo.frequency || "daily",
      customFrequencyHours: String(promo.customFrequencyHours || "0"),
      media: mediaUrls,
      mediaFit: promo.mediaFit || "scale-down",
      showImageOnMaintenance: !!promo.showImageOnMaintenance,
      orientation: promo.orientation || "vertical",
      imageRotationInterval: promo.imageRotationInterval || 2500,
      imageAnimationType: promo.imageAnimation?.type || "fade",
      imageAnimationDuration: promo.imageAnimation?.duration || 600,
      isLimitedOffer: !!promo.isLimitedOffer,
      startDate: promo.startDate ? promo.startDate.slice(0, 16) : "",
      endDate: promo.endDate ? promo.endDate.slice(0, 16) : "",
      showDateInfo: !!promo.showDateInfo,
      buttons: {
        primary: {
          show:
            primaryBtn.show ??
            (primaryBtn.text || promo.buttonText ? true : true),
          text: primaryBtn.text || promo.buttonText || "",
          icon: primaryBtn.icon || promo.buttonPrimaryIcon || "",
          url: primaryBtn.url || promo.link || promo.buttonLink || "",
        },
        secondary: {
          show:
            secondaryBtn.show ??
            (secondaryBtn.text || promo.buttonSecondaryText ? true : false),
          text: secondaryBtn.text || promo.buttonSecondaryText || "",
          icon: secondaryBtn.icon || promo.buttonSecondaryIcon || "",
          url: secondaryBtn.url || promo.buttonSecondaryLink || "",
        },
      },
      disclaimer: {
        show: !!disclaimerObj.show,
        text: disclaimerObj.text || "",
        linkText: disclaimerObj.linkText || "",
        linkUrl: disclaimerObj.linkUrl || "",
      },
      isActive: promo.isActive,
    };
    isPromoModalOpen = true;
  }

  function cancelEdit() {
    isPromoModalOpen = false;
    editingPromoId = null;
    newPromo = defaultPromoForm();
  }

  async function createPromotion(e: Event) {
    e.preventDefault();
    isSubmitting = true;

    const mediaList = newPromo.media
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: newPromo.title,
      category: newPromo.category,
      description: newPromo.description,
      link: newPromo.link || newPromo.buttons.primary.url,
      frequency: newPromo.frequency,
      customFrequencyHours: newPromo.customFrequencyHours,
      media: mediaList,
      mediaFit: newPromo.mediaFit,
      showImageOnMaintenance: newPromo.showImageOnMaintenance,
      orientation: newPromo.orientation,
      imageRotationInterval: Number(newPromo.imageRotationInterval) || 2500,
      imageAnimation: {
        type: newPromo.imageAnimationType,
        duration: Number(newPromo.imageAnimationDuration) || 600,
      },
      isLimitedOffer: newPromo.isLimitedOffer,
      startDate:
        newPromo.isLimitedOffer && newPromo.startDate
          ? newPromo.startDate
          : null,
      endDate:
        newPromo.isLimitedOffer && newPromo.endDate ? newPromo.endDate : null,
      showDateInfo: newPromo.showDateInfo,
      buttons: newPromo.buttons,
      disclaimer: newPromo.disclaimer,
      isActive: newPromo.isActive,
      enabled: newPromo.isActive,
    };

    try {
      if (editingPromoId) {
        await makeAdminRequest(`promotions?id=${editingPromoId}`, "PUT", {
          id: editingPromoId,
          ...payload,
        });
        addToast("Promotion updated successfully!");
      } else {
        await makeAdminRequest("promotions", "POST", payload);
        addToast("Promotion created successfully!");
      }
      cancelEdit();
      loadPromotions();
    } catch (e: any) {
      addToast(`Failed to save promotion: ${e.message}`);
    } finally {
      isSubmitting = false;
    }
  }

  function toggleStatus(promo: Promotion) {
    const action = promo.isActive ? "deactivate" : "activate";
    const warning = !promo.isActive
      ? " This will deactivate other active promotions."
      : "";

    confirmTitle = `${action === "activate" ? "Activate" : "Deactivate"} Promotion`;
    confirmMessage = `Are you sure you want to ${action} "${promo.title || "this promotion"}"?${warning}`;
    onConfirmAction = async () => {
      try {
        await makeAdminRequest(`promotions?id=${promo.id}`, "PUT", {
          id: promo.id,
          isActive: !promo.isActive,
        });
        loadPromotions();
        addToast(`Promotion ${action}d.`);
      } catch (e: any) {
        addToast(`Failed to update status: ${e.message}`);
      }
    };
    isConfirmOpen = true;
  }

  function deletePromotion(id: string, title: string) {
    confirmTitle = "Delete Promotion";
    confirmMessage = `Are you sure you want to delete "${title || "this promotion"}"? This action cannot be undone.`;
    onConfirmAction = async () => {
      try {
        await makeAdminRequest(`promotions?id=${id}`, "DELETE");
        loadPromotions();
        addToast("Promotion deleted successfully.");
      } catch (e: any) {
        addToast(`Failed to delete promotion: ${e.message}`);
      }
    };
    isConfirmOpen = true;
  }

  // Media Upload State & Cloudinary integration
  let isUploadingMedia = $state(false);
  let uploadStatusText = $state("");
  let mediaFileInput = $state<HTMLInputElement | null>(null);

  async function convertImageToWebP(
    file: File,
  ): Promise<{ blob: Blob; fileName: string }> {
    if (file.type === "image/webp") {
      return { blob: file, fileName: file.name };
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve({ blob: file, fileName: file.name });
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
              resolve({ blob: blob || file, fileName: newName });
            },
            "image/webp",
            0.92,
          );
        };
        img.onerror = () => resolve({ blob: file, fileName: file.name });
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve({ blob: file, fileName: file.name });
      reader.readAsDataURL(file);
    });
  }

  function addMediaUrl(url: string) {
    if (!newPromo.media.trim()) {
      newPromo.media = url;
    } else {
      newPromo.media = `${newPromo.media.trim()}\n${url}`;
    }
  }

  async function handleMediaFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isUploadingMedia = true;
    try {
      let uploadBlob: Blob = file;
      let uploadName = file.name;

      if (file.type.startsWith("image/")) {
        uploadStatusText = "Converting to WebP...";
        const converted = await convertImageToWebP(file);
        uploadBlob = converted.blob;
        uploadName = converted.fileName;
      } else if (file.type.startsWith("video/")) {
        uploadStatusText = "Preparing video...";
      }

      uploadStatusText = "Uploading to Cloudinary...";

      const serverFormData = new FormData();
      serverFormData.append("file", uploadBlob, uploadName);
      serverFormData.append("folder", "insightroom");

      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("materio_auth_token") ||
        "";

      const serverRes = await fetch("/api/v2/admin/cloudinary", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: serverFormData,
      });

      const serverJson = (await serverRes.json()) as any;
      if (!serverRes.ok || !serverJson.success || !serverJson.url) {
        throw new Error(serverJson.error || "Cloudinary upload failed");
      }

      let finalUrl = serverJson.url;
      if (file.type.startsWith("video/") && !finalUrl.endsWith(".webm")) {
        finalUrl = finalUrl.replace(/\.[^.]+$/, ".webm");
      }
      addMediaUrl(finalUrl);
      addToast("Media converted & uploaded to Cloudinary!");
    } catch (err: any) {
      console.error("Upload error:", err);
      addToast(`Upload failed: ${err.message || err}`);
    } finally {
      isUploadingMedia = false;
      uploadStatusText = "";
      if (input) input.value = "";
    }
  }

  // Derive primary media URL for preview
  let previewMediaUrl = $derived.by(() => {
    const lines = newPromo.media
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return lines[0] || "";
  });
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
  <ConfirmModal
    bind:isOpen={isConfirmOpen}
    title={confirmTitle}
    message={confirmMessage}
    onConfirm={onConfirmAction}
    confirmText={confirmTitle.includes("Delete") ? "Delete" : "Confirm"}
  />

  <IconSelector
    bind:isOpen={isIconSelectorOpen}
    selectedIcon={currentIconField === "primary"
      ? newPromo.buttons.primary.icon
      : newPromo.buttons.secondary.icon}
    onSelect={handleIconSelect}
  />

  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6"
  >
    <div>
      <h1 class="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
        Promotions
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Configure announcements, limited-time offers, and modal banners.
      </p>
    </div>
    <button
      onclick={openNewPromoModal}
      class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
    >
      <HugeiconsIcon icon={Add01Icon} size={18} />
      <span>New promotion</span>
    </button>
  </div>

  <!-- Promotion Editor Modal -->
  <Modal
    bind:isOpen={isPromoModalOpen}
    title={editingPromoId ? "Edit promotion" : "New promotion"}
    onClose={cancelEdit}
    maxWidthClass="sm:max-w-4xl lg:max-w-5xl"
  >
    <form onsubmit={createPromotion} class="space-y-6">
      <!-- Minimalist Section Nav Tabs -->
      <div
        class="flex items-center gap-1 overflow-x-auto pb-2 border-b border-border/50 text-sm no-scrollbar"
      >
        <button
          type="button"
          onclick={() => (formSection = "content")}
          class="px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium {formSection ===
          'content'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
        >
          General
        </button>
        <button
          type="button"
          onclick={() => (formSection = "appearance")}
          class="px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium {formSection ===
          'appearance'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
        >
          Media & Layout
        </button>
        <button
          type="button"
          onclick={() => (formSection = "schedule")}
          class="px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium {formSection ===
          'schedule'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
        >
          Schedule & Frequency
        </button>
        <button
          type="button"
          onclick={() => (formSection = "actions")}
          class="px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium {formSection ===
          'actions'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
        >
          Buttons
        </button>
        <button
          type="button"
          onclick={() => (formSection = "disclaimer")}
          class="px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap font-medium {formSection ===
          'disclaimer'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
        >
          Disclaimer
        </button>
      </div>

      <!-- Main Layout: Editor on left, Real-time Live Preview on right -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- Left: Clean, un-nested form inputs -->
        <div class="lg:col-span-7 space-y-6">
          <!-- Section 1: Content & General -->
          {#if formSection === "content"}
            <div class="space-y-5 animate-in fade-in duration-200">
              <div class="space-y-1.5">
                <label
                  for="promoTitle"
                  class="text-xs font-medium text-muted-foreground">Title</label
                >
                <input
                  id="promoTitle"
                  type="text"
                  bind:value={newPromo.title}
                  required
                  class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                  placeholder="e.g. Materio v5 is here"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="space-y-1.5">
                  <label
                    for="promoCategory"
                    class="text-xs font-medium text-muted-foreground"
                    >Category</label
                  >
                  <input
                    id="promoCategory"
                    type="text"
                    bind:value={newPromo.category}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                    placeholder="e.g. whats-new, offer, release"
                  />
                </div>
                <div class="space-y-1.5">
                  <label
                    for="promoLink"
                    class="text-xs font-medium text-muted-foreground"
                    >Primary link</label
                  >
                  <input
                    id="promoLink"
                    type="text"
                    bind:value={newPromo.link}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                    placeholder="e.g. /whats-new/materio-v5 or https://..."
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <label
                  for="promoDescription"
                  class="text-xs font-medium text-muted-foreground"
                  >Description</label
                >
                <textarea
                  id="promoDescription"
                  bind:value={newPromo.description}
                  required
                  rows="4"
                  class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors resize-y placeholder:text-muted-foreground/50"
                  placeholder="Detail the announcement or offer..."
                ></textarea>
              </div>

              <div class="pt-2">
                <Checkbox
                  bind:checked={newPromo.isActive}
                  label="Enable promotion (active)"
                />
                <p class="text-[11px] text-muted-foreground mt-1 ml-8">
                  When active, this will be presented to users based on
                  frequency settings.
                </p>
              </div>
            </div>
          {/if}

          <!-- Section 2: Media & Layout -->
          {#if formSection === "appearance"}
            <div class="space-y-5 animate-in fade-in duration-200">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label
                    for="promoMedia"
                    class="text-xs font-medium text-muted-foreground"
                    >Media URLs (one per line for rotation)</label
                  >
                  <button
                    type="button"
                    onclick={() => mediaFileInput?.click()}
                    disabled={isUploadingMedia}
                    class="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    <HugeiconsIcon icon={Upload01Icon} size={14} />
                    <span
                      >{isUploadingMedia
                        ? uploadStatusText
                        : "Upload media"}</span
                    >
                  </button>
                </div>
                <input
                  bind:this={mediaFileInput}
                  type="file"
                  accept="image/*,video/*"
                  class="hidden"
                  onchange={handleMediaFileUpload}
                />
                <textarea
                  id="promoMedia"
                  bind:value={newPromo.media}
                  rows="3"
                  class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm font-mono text-xs focus:outline-none transition-colors resize-y placeholder:text-muted-foreground/50"
                  placeholder="https://.../promo-image.webp"
                ></textarea>
                <p class="text-[11px] text-muted-foreground">
                  Images are automatically converted to .webp before Cloudinary
                  upload. Videos are served as .webm.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="space-y-1.5">
                  <label
                    for="promoMediaFit"
                    class="text-xs font-medium text-muted-foreground"
                    >Media fit</label
                  >
                  <Dropdown
                    bind:value={newPromo.mediaFit}
                    options={[
                      {
                        value: "scale-down",
                        label: "Scale down (original or fit)",
                      },
                      { value: "cover", label: "Cover (fill & crop)" },
                      { value: "contain", label: "Contain (fit entirely)" },
                      { value: "fill", label: "Fill (stretch)" },
                      { value: "none", label: "None (natural size)" },
                    ]}
                  />
                </div>

                <div class="space-y-1.5">
                  <label
                    for="promoOrientation"
                    class="text-xs font-medium text-muted-foreground"
                    >Orientation</label
                  >
                  <Dropdown
                    bind:value={newPromo.orientation}
                    options={[
                      {
                        value: "vertical",
                        label: "Vertical (stacked media on top)",
                      },
                      {
                        value: "horizontal",
                        label: "Horizontal (media on side)",
                      },
                    ]}
                  />
                  <p class="text-[11px] text-muted-foreground">
                    Applies to desktop only. Mobile always displays as a bottom
                    sheet.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div class="space-y-1.5">
                  <label
                    for="promoInterval"
                    class="text-xs font-medium text-muted-foreground"
                    >Rotation interval (ms)</label
                  >
                  <input
                    id="promoInterval"
                    type="number"
                    bind:value={newPromo.imageRotationInterval}
                    min="1000"
                    step="500"
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div class="space-y-1.5">
                  <label
                    for="promoAnimType"
                    class="text-xs font-medium text-muted-foreground"
                    >Animation</label
                  >
                  <Dropdown
                    bind:value={newPromo.imageAnimationType}
                    options={[
                      { value: "fade", label: "Fade" },
                      { value: "fade-scale", label: "Fade & scale" },
                      { value: "slide-left", label: "Slide left" },
                      { value: "slide-right", label: "Slide right" },
                      { value: "slide-up", label: "Slide up" },
                      { value: "zoom", label: "Zoom" },
                    ]}
                  />
                </div>

                <div class="space-y-1.5">
                  <label
                    for="promoAnimDuration"
                    class="text-xs font-medium text-muted-foreground"
                    >Duration (ms)</label
                  >
                  <input
                    id="promoAnimDuration"
                    type="number"
                    bind:value={newPromo.imageAnimationDuration}
                    min="100"
                    step="50"
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div class="pt-2">
                <Checkbox
                  bind:checked={newPromo.showImageOnMaintenance}
                  label="Show media during maintenance mode"
                />
              </div>
            </div>
          {/if}

          <!-- Section 3: Schedule & Frequency -->
          {#if formSection === "schedule"}
            <div class="space-y-5 animate-in fade-in duration-200">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div class="space-y-1.5">
                  <label
                    for="promoFrequency"
                    class="text-xs font-medium text-muted-foreground"
                    >Display frequency</label
                  >
                  <Dropdown
                    bind:value={newPromo.frequency}
                    options={[
                      { value: "daily", label: "Daily (once per day)" },
                      { value: "once", label: "Once (first visit only)" },
                      { value: "everytime", label: "Every page load" },
                      { value: "every-3hr", label: "Every 3 hours" },
                      { value: "every-6hr", label: "Every 6 hours" },
                      { value: "every-12hr", label: "Every 12 hours" },
                      { value: "every-3days", label: "Every 3 days" },
                      { value: "random", label: "Random window" },
                      { value: "custom", label: "Custom hours" },
                    ]}
                  />
                </div>

                {#if newPromo.frequency === "custom"}
                  <div class="space-y-1.5">
                    <label
                      for="promoCustomHours"
                      class="text-xs font-medium text-muted-foreground"
                      >Interval in hours</label
                    >
                    <input
                      id="promoCustomHours"
                      type="number"
                      bind:value={newPromo.customFrequencyHours}
                      min="1"
                      class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                    />
                  </div>
                {/if}
              </div>

              <div class="pt-2 space-y-4">
                <Checkbox
                  bind:checked={newPromo.isLimitedOffer}
                  label="Limited-time offer (schedule date window)"
                />

                {#if newPromo.isLimitedOffer}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 pl-8 pt-2">
                    <div class="space-y-1.5">
                      <label
                        for="promoStartDate"
                        class="text-xs font-medium text-muted-foreground"
                        >Start date & time</label
                      >
                      <input
                        id="promoStartDate"
                        type="datetime-local"
                        bind:value={newPromo.startDate}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label
                        for="promoEndDate"
                        class="text-xs font-medium text-muted-foreground"
                        >End date & time</label
                      >
                      <input
                        id="promoEndDate"
                        type="datetime-local"
                        bind:value={newPromo.endDate}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div class="pl-8">
                    <Checkbox
                      bind:checked={newPromo.showDateInfo}
                      label="Show active date range badge in modal"
                    />
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Section 4: Buttons & Actions -->
          {#if formSection === "actions"}
            <div class="space-y-6 animate-in fade-in duration-200">
              <!-- Primary Button -->
              <div class="space-y-3 pb-4 border-b border-border/40">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-semibold text-foreground">
                    Primary button
                  </div>
                  <Checkbox
                    bind:checked={newPromo.buttons.primary.show}
                    label="Visible"
                  />
                </div>

                {#if newPromo.buttons.primary.show}
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div class="space-y-1.5">
                      <label
                        for="promoBtnText"
                        class="text-xs font-medium text-muted-foreground"
                        >Label</label
                      >
                      <input
                        id="promoBtnText"
                        type="text"
                        bind:value={newPromo.buttons.primary.text}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                        placeholder="e.g. Read release notes"
                      />
                    </div>

                    <div class="space-y-1.5">
                      <label
                        for="promoBtnUrl"
                        class="text-xs font-medium text-muted-foreground"
                        >URL / link</label
                      >
                      <input
                        id="promoBtnUrl"
                        type="text"
                        bind:value={newPromo.buttons.primary.url}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                        placeholder="Leave blank to use primary link"
                      />
                    </div>

                    <div class="space-y-1.5">
                      <span
                        class="text-xs font-medium text-muted-foreground block"
                        >Icon</span
                      >
                      <button
                        type="button"
                        onclick={() => openIconSelector("primary")}
                        class="w-full flex items-center justify-between border-0 border-b border-border/80 hover:border-primary py-2 text-sm text-left transition-colors cursor-pointer"
                      >
                        <span class="flex items-center gap-2 truncate">
                          {#if getHugeIcon(newPromo.buttons.primary.icon)}
                            <HugeiconsIcon
                              icon={getHugeIcon(newPromo.buttons.primary.icon)}
                              size={16}
                              class="text-primary shrink-0"
                            />
                            <span class="text-foreground"
                              >{newPromo.buttons.primary.icon.replace(
                                /Icon$/,
                                "",
                              )}</span
                            >
                          {:else if newPromo.buttons.primary.icon}
                            <span
                              class="text-muted-foreground font-mono text-xs"
                              >{newPromo.buttons.primary.icon}</span
                            >
                          {:else}
                            <span class="text-muted-foreground"
                              >Choose icon...</span
                            >
                          {/if}
                        </span>
                        <span class="text-xs text-primary font-medium"
                          >Change</span
                        >
                      </button>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Secondary Button -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-semibold text-foreground">
                    Secondary button
                  </div>
                  <Checkbox
                    bind:checked={newPromo.buttons.secondary.show}
                    label="Visible"
                  />
                </div>

                {#if newPromo.buttons.secondary.show}
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    <div class="space-y-1.5">
                      <label
                        for="promoSecBtnText"
                        class="text-xs font-medium text-muted-foreground"
                        >Label</label
                      >
                      <input
                        id="promoSecBtnText"
                        type="text"
                        bind:value={newPromo.buttons.secondary.text}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                        placeholder="e.g. Got it"
                      />
                    </div>

                    <div class="space-y-1.5">
                      <label
                        for="promoSecBtnUrl"
                        class="text-xs font-medium text-muted-foreground"
                        >URL / link (optional)</label
                      >
                      <input
                        id="promoSecBtnUrl"
                        type="text"
                        bind:value={newPromo.buttons.secondary.url}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                        placeholder="Leave blank to dismiss"
                      />
                    </div>

                    <div class="space-y-1.5">
                      <span
                        class="text-xs font-medium text-muted-foreground block"
                        >Icon</span
                      >
                      <button
                        type="button"
                        onclick={() => openIconSelector("secondary")}
                        class="w-full flex items-center justify-between border-0 border-b border-border/80 hover:border-primary py-2 text-sm text-left transition-colors cursor-pointer"
                      >
                        <span class="flex items-center gap-2 truncate">
                          {#if getHugeIcon(newPromo.buttons.secondary.icon)}
                            <HugeiconsIcon
                              icon={getHugeIcon(
                                newPromo.buttons.secondary.icon,
                              )}
                              size={16}
                              class="text-primary shrink-0"
                            />
                            <span class="text-foreground"
                              >{newPromo.buttons.secondary.icon.replace(
                                /Icon$/,
                                "",
                              )}</span
                            >
                          {:else if newPromo.buttons.secondary.icon}
                            <span
                              class="text-muted-foreground font-mono text-xs"
                              >{newPromo.buttons.secondary.icon}</span
                            >
                          {:else}
                            <span class="text-muted-foreground"
                              >Choose icon...</span
                            >
                          {/if}
                        </span>
                        <span class="text-xs text-primary font-medium"
                          >Change</span
                        >
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Section 5: Disclaimer -->
          {#if formSection === "disclaimer"}
            <div class="space-y-5 animate-in fade-in duration-200">
              <Checkbox
                bind:checked={newPromo.disclaimer.show}
                label="Show small disclaimer under buttons"
              />

              {#if newPromo.disclaimer.show}
                <div class="space-y-4 pt-1">
                  <div class="space-y-1.5">
                    <label
                      for="disclaimerText"
                      class="text-xs font-medium text-muted-foreground"
                      >Disclaimer text</label
                    >
                    <input
                      id="disclaimerText"
                      type="text"
                      bind:value={newPromo.disclaimer.text}
                      class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                      placeholder="e.g. Terms and conditions apply."
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div class="space-y-1.5">
                      <label
                        for="disclaimerLinkText"
                        class="text-xs font-medium text-muted-foreground"
                        >Link text</label
                      >
                      <input
                        id="disclaimerLinkText"
                        type="text"
                        bind:value={newPromo.disclaimer.linkText}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                        placeholder="e.g. Read more"
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label
                        for="disclaimerLinkUrl"
                        class="text-xs font-medium text-muted-foreground"
                        >Link URL</label
                      >
                      <input
                        id="disclaimerLinkUrl"
                        type="text"
                        bind:value={newPromo.disclaimer.linkUrl}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Bottom Action Buttons -->
          <div class="flex items-center gap-3 pt-6 border-t border-border/50">
            <button
              type="submit"
              disabled={isSubmitting}
              class="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
            >
              <HugeiconsIcon
                icon={editingPromoId ? Edit01Icon : Megaphone01Icon}
                size={16}
              />
              <span
                >{isSubmitting
                  ? "Saving..."
                  : editingPromoId
                    ? "Update promotion"
                    : "Publish promotion"}</span
              >
            </button>
            <button
              type="button"
              onclick={cancelEdit}
              class="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Right: Real-time Live Preview -->
        <div class="lg:col-span-5 flex flex-col space-y-3">
          <div
            class="flex items-center justify-between text-xs text-muted-foreground px-1"
          >
            <span class="font-medium text-foreground text-xs">Preview</span>
            <div class="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg">
              <button
                type="button"
                onclick={() => (previewDevice = "desktop")}
                class="px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer {previewDevice ===
                'desktop'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground'}"
              >
                Desktop
              </button>
              <button
                type="button"
                onclick={() => (previewDevice = "mobile")}
                class="px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer {previewDevice ===
                'mobile'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground'}"
              >
                Mobile
              </button>
            </div>
          </div>

          <!-- Preview Frame -->
          {#if previewDevice === "desktop"}
            <!-- Desktop Canvas: Adapts to Horizontal vs Vertical Orientation -->
            <div
              class="bg-neutral-900/10 dark:bg-neutral-950/60 border border-border/60 rounded-xl p-5 flex items-center justify-center min-h-[380px] overflow-hidden relative"
            >
              <div
                class="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[1px] pointer-events-none"
              ></div>

              <!-- Desktop Promo Card -->
              <div
                class="relative z-10 w-full bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 {newPromo.orientation ===
                  'horizontal' && previewMediaUrl
                  ? 'max-w-[480px] flex flex-row'
                  : 'max-w-[340px] flex flex-col'}"
              >
                {#if previewMediaUrl}
                  <div
                    class="{newPromo.orientation === 'horizontal'
                      ? 'w-5/12 min-w-[160px] self-stretch border-r border-border/60'
                      : 'w-full h-36 border-b border-border/60'} relative bg-muted/40 overflow-hidden flex items-center justify-center shrink-0"
                  >
                    <img
                      src={previewMediaUrl}
                      alt="Promo preview"
                      class="w-full h-full object-{newPromo.mediaFit}"
                      onerror={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                    {#if newPromo.isLimitedOffer}
                      <div
                        class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-background/90 backdrop-blur-xs text-foreground shadow-xs"
                      >
                        Limited offer
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- Content Area -->
                <div
                  class={newPromo.orientation === "horizontal" &&
                  previewMediaUrl
                    ? "w-7/12 p-4 flex flex-col justify-between"
                    : "p-4 space-y-3"}
                >
                  <div class="space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <span
                        class="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10"
                      >
                        {newPromo.category || "whats-new"}
                      </span>
                      {#if newPromo.showDateInfo && newPromo.isLimitedOffer && newPromo.endDate}
                        <span
                          class="text-[9px] text-muted-foreground flex items-center gap-1"
                        >
                          <HugeiconsIcon icon={Clock01Icon} size={10} />
                          Ends {new Date(newPromo.endDate).toLocaleDateString()}
                        </span>
                      {/if}
                    </div>

                    <h4
                      class="font-semibold text-foreground text-sm leading-snug"
                    >
                      {newPromo.title || "Untitled Promotion"}
                    </h4>

                    <p
                      class="text-xs text-muted-foreground line-clamp-3 leading-relaxed"
                    >
                      {newPromo.description ||
                        "Promotion description will appear here."}
                    </p>
                  </div>

                  <!-- Actions & Buttons -->
                  <div class="pt-2 space-y-1.5">
                    {#if newPromo.buttons.primary.show}
                      <button
                        type="button"
                        class="w-full py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs cursor-default"
                      >
                        {#if getHugeIcon(newPromo.buttons.primary.icon)}
                          <HugeiconsIcon
                            icon={getHugeIcon(newPromo.buttons.primary.icon)}
                            size={13}
                          />
                        {/if}
                        <span class="truncate"
                          >{newPromo.buttons.primary.text || "Action"}</span
                        >
                      </button>
                    {/if}

                    {#if newPromo.buttons.secondary.show}
                      <button
                        type="button"
                        class="w-full py-1.5 px-3 rounded-xl bg-muted/60 text-foreground text-xs font-medium flex items-center justify-center gap-1.5 cursor-default"
                      >
                        {#if getHugeIcon(newPromo.buttons.secondary.icon)}
                          <HugeiconsIcon
                            icon={getHugeIcon(newPromo.buttons.secondary.icon)}
                            size={13}
                          />
                        {/if}
                        <span class="truncate"
                          >{newPromo.buttons.secondary.text || "Dismiss"}</span
                        >
                      </button>
                    {/if}

                    {#if newPromo.disclaimer.show && newPromo.disclaimer.text}
                      <div
                        class="pt-1 text-[9px] text-muted-foreground text-center leading-tight"
                      >
                        {newPromo.disclaimer.text}
                        {#if newPromo.disclaimer.linkText}
                          <span
                            class="text-primary underline ml-1 cursor-pointer"
                            >{newPromo.disclaimer.linkText}</span
                          >
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <!-- Mobile Preview: Pure Bottom Sheet (Minimal & Clean, No Phone Bezel) -->
            <div
              class="bg-neutral-900/10 dark:bg-neutral-950/60 border border-border/60 rounded-xl p-4 flex flex-col justify-end min-h-[380px] overflow-hidden relative"
            >
              <!-- Darkened backdrop overlay -->
              <div
                class="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none"
              ></div>

              <!-- Bottom Sheet -->
              <div
                class="relative z-10 w-full max-w-[340px] mx-auto bg-card border-t border-x border-border/80 rounded-t-2xl rounded-b-none shadow-xl flex flex-col max-h-[350px] animate-in slide-in-from-bottom-3 duration-200"
              >
                <!-- Drag Handle -->
                <div
                  class="w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1.5 shrink-0"
                ></div>

                {#if previewMediaUrl}
                  <div
                    class="w-full h-24 bg-muted/40 relative overflow-hidden flex items-center justify-center border-b border-border/40 shrink-0"
                  >
                    <img
                      src={previewMediaUrl}
                      alt="Promo preview"
                      class="w-full h-full object-{newPromo.mediaFit}"
                      onerror={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                    {#if newPromo.isLimitedOffer}
                      <div
                        class="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[8px] font-medium bg-background/90 backdrop-blur-xs text-foreground shadow-xs"
                      >
                        Limited offer
                      </div>
                    {/if}
                  </div>
                {/if}

                <div class="p-3.5 space-y-2 overflow-y-auto">
                  <div class="flex items-center justify-between gap-1">
                    <span
                      class="text-[9px] font-semibold text-primary px-1.5 py-0.5 rounded-full bg-primary/10"
                    >
                      {newPromo.category || "whats-new"}
                    </span>
                    {#if newPromo.showDateInfo && newPromo.isLimitedOffer && newPromo.endDate}
                      <span
                        class="text-[8px] text-muted-foreground flex items-center gap-0.5"
                      >
                        <HugeiconsIcon icon={Clock01Icon} size={9} />
                        Ends {new Date(newPromo.endDate).toLocaleDateString()}
                      </span>
                    {/if}
                  </div>

                  <h4
                    class="font-semibold text-foreground text-xs leading-snug line-clamp-2"
                  >
                    {newPromo.title || "Untitled Promotion"}
                  </h4>

                  <p
                    class="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed"
                  >
                    {newPromo.description ||
                      "Promotion description will appear here."}
                  </p>

                  <!-- Buttons -->
                  <div class="pt-1 space-y-1.5">
                    {#if newPromo.buttons.primary.show}
                      <button
                        type="button"
                        class="w-full py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-1.5 shadow-xs cursor-default"
                      >
                        {#if getHugeIcon(newPromo.buttons.primary.icon)}
                          <HugeiconsIcon
                            icon={getHugeIcon(newPromo.buttons.primary.icon)}
                            size={12}
                          />
                        {/if}
                        <span class="truncate"
                          >{newPromo.buttons.primary.text || "Action"}</span
                        >
                      </button>
                    {/if}

                    {#if newPromo.buttons.secondary.show}
                      <button
                        type="button"
                        class="w-full py-1.5 px-3 rounded-xl bg-muted/60 text-foreground text-xs font-medium flex items-center justify-center gap-1.5 cursor-default"
                      >
                        {#if getHugeIcon(newPromo.buttons.secondary.icon)}
                          <HugeiconsIcon
                            icon={getHugeIcon(newPromo.buttons.secondary.icon)}
                            size={12}
                          />
                        {/if}
                        <span class="truncate"
                          >{newPromo.buttons.secondary.text || "Dismiss"}</span
                        >
                      </button>
                    {/if}

                    {#if newPromo.disclaimer.show && newPromo.disclaimer.text}
                      <div
                        class="pt-0.5 text-[8px] text-muted-foreground text-center leading-tight"
                      >
                        {newPromo.disclaimer.text}
                        {#if newPromo.disclaimer.linkText}
                          <span
                            class="text-primary underline ml-0.5 cursor-pointer"
                            >{newPromo.disclaimer.linkText}</span
                          >
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </form>
  </Modal>

  <!-- Promotions List -->
  <div class="space-y-6">
    <div
      class="flex items-center justify-between border-b border-border/50 pb-3"
    >
      <div class="flex items-center gap-2 p-1 bg-muted/40 rounded-xl">
        <button
          onclick={() => (activeTab = "active")}
          class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors {activeTab ===
          'active'
            ? 'bg-background text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          Active ({activePromotions.length})
        </button>
        <button
          onclick={() => (activeTab = "history")}
          class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors {activeTab ===
          'history'
            ? 'bg-background text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'}"
        >
          History ({historyPromotions.length})
        </button>
      </div>
    </div>

    {#if isLoading}
      <div class="flex items-center justify-center h-48 text-muted-foreground">
        <p class="animate-pulse text-sm font-medium">Loading promotions...</p>
      </div>
    {:else if (activeTab === "active" ? activePromotions : historyPromotions).length === 0}
      <div
        class="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
      >
        <HugeiconsIcon icon={Megaphone01Icon} size={32} class="opacity-40" />
        <p class="text-sm font-medium">No {activeTab} promotions found.</p>
        <button
          type="button"
          onclick={openNewPromoModal}
          class="text-xs text-primary font-medium hover:underline cursor-pointer"
        >
          Create a new promotion
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each activeTab === "active" ? activePromotions : historyPromotions as promo}
          {@const mediaUrl =
            Array.isArray(promo.media) && promo.media.length > 0
              ? promo.media[0]
              : promo.imageUrl || ""}
          <div
            class="flex flex-col rounded-2xl border border-border/60 hover:border-border transition-all duration-200 overflow-hidden bg-background"
          >
            {#if mediaUrl}
              <div
                class="h-36 bg-muted/30 relative overflow-hidden flex items-center justify-center border-b border-border/40"
              >
                <img
                  src={mediaUrl}
                  alt="Promotion"
                  class="w-full h-full object-{promo.mediaFit || 'scale-down'}"
                  onerror={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
                <div class="absolute top-2.5 right-2.5">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium {promo.isActive
                      ? 'bg-primary/90 text-primary-foreground shadow-xs'
                      : 'bg-background/80 text-muted-foreground backdrop-blur-xs'}"
                  >
                    {promo.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            {/if}

            <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="text-[10px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10"
                  >
                    {promo.category || "whats-new"}
                  </span>
                  {#if !mediaUrl}
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-medium {promo.isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'}"
                    >
                      {promo.isActive ? "Active" : "Inactive"}
                    </span>
                  {/if}
                </div>

                <h3 class="font-semibold text-foreground text-sm line-clamp-1">
                  {promo.title || "Untitled"}
                </h3>

                <p
                  class="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                >
                  {promo.description}
                </p>
              </div>

              <!-- Button Badges Preview -->
              {#if promo.buttons?.primary?.text || promo.buttonText}
                <div
                  class="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-muted-foreground"
                >
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/40"
                  >
                    {#if getHugeIcon(promo.buttons?.primary?.icon || promo.buttonPrimaryIcon)}
                      <HugeiconsIcon
                        icon={getHugeIcon(
                          promo.buttons?.primary?.icon ||
                            promo.buttonPrimaryIcon,
                        )}
                        size={12}
                        class="text-primary"
                      />
                    {/if}
                    <span class="truncate max-w-[120px]"
                      >{promo.buttons?.primary?.text || promo.buttonText}</span
                    >
                  </span>

                  {#if promo.buttons?.secondary?.text || promo.buttonSecondaryText}
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/40"
                    >
                      {#if getHugeIcon(promo.buttons?.secondary?.icon || promo.buttonSecondaryIcon)}
                        <HugeiconsIcon
                          icon={getHugeIcon(
                            promo.buttons?.secondary?.icon ||
                              promo.buttonSecondaryIcon,
                          )}
                          size={12}
                        />
                      {/if}
                      <span class="truncate max-w-[120px]"
                        >{promo.buttons?.secondary?.text ||
                          promo.buttonSecondaryText}</span
                      >
                    </span>
                  {/if}
                </div>
              {/if}

              <!-- Actions & Meta -->
              <div
                class="flex items-center justify-between pt-3 border-t border-border/40 text-xs"
              >
                <span
                  class="text-[11px] text-muted-foreground flex items-center gap-1"
                >
                  <HugeiconsIcon icon={Calendar01Icon} size={12} />
                  {new Date(
                    promo.createdAt || promo.lastUpdated || Date.now(),
                  ).toLocaleDateString()}
                </span>

                <div class="flex items-center gap-1">
                  <button
                    onclick={() => editPromotion(promo)}
                    class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <HugeiconsIcon icon={Edit01Icon} size={15} />
                  </button>
                  <button
                    onclick={() => toggleStatus(promo)}
                    class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    title={promo.isActive ? "Deactivate" : "Activate"}
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={15}
                      class={promo.isActive ? "text-primary" : ""}
                    />
                  </button>
                  <button
                    onclick={() => deletePromotion(promo.id, promo.title)}
                    class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <HugeiconsIcon icon={Delete01Icon} size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
