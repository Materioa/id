/**
 * magicPreview — runs an admin-authored Magic snippet against an editor
 * preview. Mirrors the live-site runner (same ctx shape, same guards)
 * so what authors see here matches what visitors get.
 *
 * Never throws: syntax/runtime problems come back as `error` text.
 * Returns a cleanup function when the snippet provides one.
 */

export type PreviewMagicCtx = {
	root: Element | null;
	overlay: Element | null;
	data: unknown;
	id: string;
	title: string;
	kind: string;
	stage: string;
	formData: Record<string, unknown>;
	isApp: boolean;
	platform: string;
	close: () => void;
	track: (name: string, params?: Record<string, unknown>) => boolean;
};

/** Same shell detection as the live site (admin always previews as web). */
export function detectPreviewPlatform(): string {
	try {
		if (typeof window === 'undefined') return 'web';
		if (
			(window as any).__TAURI_INTERNALS__ ||
			(window as any).__TAURI__ ||
			window.location?.hostname === 'tauri.localhost' ||
			window.location?.protocol === 'tauri:'
		)
			return 'windows';
		const cap = (window as any).Capacitor;
		if (
			(cap?.isNativePlatform && cap.isNativePlatform()) ||
			(cap?.getPlatform && cap.getPlatform() !== 'web') ||
			(window as any).AndroidBridge ||
			window.location?.protocol === 'capacitor:' ||
			window.location?.hostname === 'capacitor.localhost'
		)
			return 'android';
	} catch {
		/* fall through to web */
	}
	return 'web';
}

export function runPreviewMagic(
	code: string,
	ctx: Partial<PreviewMagicCtx> = {}
): { cleanup: (() => void) | null; error: string | null } {
	if (typeof code !== 'string' || !code.trim()) return { cleanup: null, error: null };
	if (typeof window === 'undefined' || typeof document === 'undefined')
		return { cleanup: null, error: null };
	const source = code.slice(0, 20000);

	const fullCtx: PreviewMagicCtx = {
		root: null,
		overlay: null,
		data: null,
		id: 'preview',
		title: 'Preview',
		kind: 'promotion',
		stage: 'open',
		formData: {},
		isApp: undefined as unknown as boolean,
		platform: undefined as unknown as string,
		close: () => {},
		track: () => false,
		...ctx
	};
	if (typeof fullCtx.platform !== 'string' || !fullCtx.platform)
		fullCtx.platform = detectPreviewPlatform();
	if (typeof fullCtx.isApp !== 'boolean') fullCtx.isApp = fullCtx.platform !== 'web';
	// Same backfill as the live site, so previews behave the same.
	try {
		const root = fullCtx.root as Element | null;
		if (!fullCtx.overlay && root && typeof root.closest === 'function') {
			fullCtx.overlay =
				root.closest('.promo-modal-overlay, .modal-backdrop, .overlay-fullscreen') ||
				(root.classList?.contains('promo-modal-overlay') ||
				root.classList?.contains('modal-backdrop') ||
				root.classList?.contains('overlay-fullscreen')
					? root
					: null);
		}
		if (!fullCtx.overlay) fullCtx.overlay = document.body;
		const overlay = fullCtx.overlay as Element | null;
		if (!fullCtx.root && overlay && typeof overlay.querySelector === 'function') {
			fullCtx.root = overlay.querySelector('.promo-modal, .modal-card') || overlay;
		}
		if (!fullCtx.root) fullCtx.root = document.body;
	} catch {
		/* keep going with what we have */
	}

	let fn: (c: PreviewMagicCtx) => unknown;
	try {
		fn = new Function('ctx', '"use strict";\n' + source) as (c: PreviewMagicCtx) => unknown;
	} catch (err: unknown) {
		return { cleanup: null, error: err instanceof Error ? err.message : 'Code did not run' };
	}
	try {
		const cleanup = fn(fullCtx);
		return { cleanup: typeof cleanup === 'function' ? (cleanup as () => void) : null, error: null };
	} catch (err: unknown) {
		return { cleanup: null, error: err instanceof Error ? err.message : 'Code did not run' };
	}
}
