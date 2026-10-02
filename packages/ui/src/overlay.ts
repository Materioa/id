/**
 * overlay.ts — one stacking authority for every floating layer in the suite.
 *
 * Before this, every overlay hard-coded `z-[9999]`, so two open overlays
 * shared a single level and the one mounted first could paint over the one
 * mounted last. Body scroll was also never locked, so a dialog scrolled the
 * page behind it.
 *
 * The rules now:
 *   1. Layers stack in open order. The newest overlay is always on top.
 *   2. Only the topmost overlay reacts to Escape / backdrop clicks.
 *   3. The page behind any open overlay cannot scroll (ref-counted, so
 *      nested dialogs release cleanly and the page never stays stuck).
 *   4. `isOverlayOpen()` lets a view (the interviewer shell, a promo card)
 *      stand down instead of painting over a dialog the visitor already has open.
 */

type Listener = () => void;

/** Base sits above app chrome (sidebar z-40, dropdowns z-50) and below nothing else. */
const BASE_Z = 2000;
/** Generous headroom so a long session of nested dialogs never climbs into the toast band. */
const STEP = 20;
const TOAST_Z = 9000;

type Entry = { id: number; z: number; onTop: (isTop: boolean) => void };

const stack: Entry[] = [];
let seq = 0;
let scrollLocks = 0;
let savedScrollY = 0;

const listeners = new Set<Listener>();

function notify() {
	for (const fn of listeners) fn();
}

/** Subscribe to stack changes. Returns an unsubscribe function. */
export function subscribeOverlay(fn: Listener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function isTop(id: number) {
	const top = stack[stack.length - 1];
	return !!top && top.id === id;
}

function applyScrollLock(locked: boolean) {
	if (typeof document === 'undefined') return;
	const body = document.body;
	if (locked) {
		if (scrollLocks === 0) {
			savedScrollY = window.scrollY;
			// iOS needs position:fixed to actually stop the rubber-band.
			body.style.position = 'fixed';
			body.style.top = `-${savedScrollY}px`;
			body.style.left = '0';
			body.style.right = '0';
			body.style.width = '100%';
			body.dataset.overlayScrollY = String(savedScrollY);
		}
		scrollLocks += 1;
		return;
	}
	scrollLocks = Math.max(0, scrollLocks - 1);
	if (scrollLocks === 0) {
		body.style.position = '';
		body.style.top = '';
		body.style.left = '';
		body.style.right = '';
		body.style.width = '';
		const y = Number(body.dataset.overlayScrollY || '0');
		delete body.dataset.overlayScrollY;
		window.scrollTo(0, y);
	}
}

/**
 * Register an overlay while it is open.
 * Returns the layer's z-index plus a release function.
 */
export function openOverlay(onTopChange?: (isTop: boolean) => void): { z: number; release: () => void; isTop: () => boolean } {
	seq += 1;
	const id = seq;
	// Deeper dialogs start above every older one, and stay under the toast band.
	const z = BASE_Z + stack.length * STEP;
	const entry: Entry = { id, z, onTop: onTopChange || (() => {}) };
	stack.push(entry);
	applyScrollLock(true);
	onTopChange?.(true);
	notify();

	let released = false;
	function release() {
		if (released) return;
		released = true;
		const i = stack.findIndex((e) => e.id === id);
		if (i >= 0) stack.splice(i, 1);
		applyScrollLock(false);
		const wasTop = isTop(id);
		onTopChange?.(false);
		notify();
		// Layers below may have been promoted — let them know they are back on top.
		const newTop = stack[stack.length - 1];
		newTop?.onTop(true);
		void wasTop;
	}

	return { z, release, isTop: () => isTop(id) };
}

/** True when at least one overlay is open. Views use this to stand down. */
export function isOverlayOpen(): boolean {
	return stack.length > 0;
}

/** How many overlays are open — used by tests and by views that need depth. */
export function overlayDepth(): number {
	return stack.length;
}

/** Highest z-index currently in use. */
export function topOverlayZ(): number {
	return stack.length ? stack[stack.length - 1].z : BASE_Z;
}

/**
 * For persistent app furniture that must never cover a dialog — the
 * open-in-app banner, sticky page headers. Above ordinary chrome, below the
 * lowest possible dialog.
 */
export function underlayZ(): number {
	return BASE_Z - 100;
}

/** z-index for toasts/banners that must always sit above dialogs. */
export function toastZ(): number {
	return TOAST_Z;
}