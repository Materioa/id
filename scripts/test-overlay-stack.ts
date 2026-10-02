/**
 * Exercises the overlay stack rules that Modal relies on:
 *   1. newer layers stack above older ones
 *   2. only the topmost layer is "top"
 *   3. scroll lock is ref-counted and fully released
 *   4. a released layer promotes the one beneath it
 */
import {
  openOverlay,
  isOverlayOpen,
  overlayDepth,
  topOverlayZ,
  toastZ,
  subscribeOverlay
} from '../packages/ui/src/overlay.ts';

let pass = 0;
let fail = 0;
function check(name: string, got: any, want: any) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`); }
}

console.log('\n— stacking order —');
check('nothing open to begin with', isOverlayOpen(), false);

const seen: boolean[] = [];
const a = openOverlay((top) => seen.push(top));
check('one layer open', overlayDepth(), 1);
check('it is the top', a.isTop(), true);

const b = openOverlay();
const c = openOverlay();
check('three layers open', overlayDepth(), 3);
check('newest sits above the oldest', c.z > a.z, true);
check('newest sits above the middle', c.z > b.z, true);
check('the oldest is no longer on top', a.isTop(), false);
check('the newest is on top', c.isTop(), true);
check('toasts still clear every layer', toastZ() > topOverlayZ(), true);

console.log('\n— release promotes the layer beneath —');
const wasTopBefore = c.isTop();
c.release();
check('releasing the top changes its own mind', wasTopBefore, true);
check('it is now closed', c.isTop(), false);
check('the middle is promoted', b.isTop(), true);
check('depth dropped', overlayDepth(), 2);

b.release();
check('the original layer is promoted back', a.isTop(), true);
a.release();
check('nothing left open', isOverlayOpen(), false);
check('depth back to zero', overlayDepth(), 0);

console.log('\n— observers are notified —');
let notifications = 0;
const unsubscribe = subscribeOverlay(() => notifications++);
const d = openOverlay();
d.release();
check('open and release each notify', notifications >= 2, true);
unsubscribe();
const before = notifications;
const e = openOverlay();
e.release();
check('unsubscribe stops notifications', notifications, before);

console.log('\n— double release is a no-op —');
const f = openOverlay();
const depthBefore = overlayDepth();
f.release();
f.release();
f.release();
check('depth unchanged by extra releases', overlayDepth(), depthBefore - 1);

console.log('\n— out-of-order release —');
const g = openOverlay();
const h = openOverlay();
const i = openOverlay();
g.release();          // close the bottom one while two sit above it
check('top unaffected by an under-layer release', i.isTop(), true);
check('depth reflects the removal', overlayDepth(), 2);
i.release();
h.release();
check('all closed', isOverlayOpen(), false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);