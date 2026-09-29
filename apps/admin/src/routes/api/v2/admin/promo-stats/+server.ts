import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

async function checkAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('has_admin_privileges')
    .eq('id', decoded.id)
    .single();

  return user?.has_admin_privileges === true;
}

// Beacon activity for one promotion, backed by the main backend's GA4
// promo-stats (per-event counts for this modal). Server-to-server so no
// CORS or key handling in the browser.
const EXODUS_BASE =
  process.env.PUBLIC_MATERIO_API_URL ||
  process.env.VITE_MATERIO_API_URL ||
  'https://getmaterio.app';

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  const modalId = (url.searchParams.get('modalId') || '').trim().slice(0, 120);
  const title = (url.searchParams.get('title') || '').trim().slice(0, 160);
  if (!modalId && !title) return json({ error: 'modalId or title is required' }, { status: 400 });

  const target =
    `${EXODUS_BASE}/api/v2/features?action=promo-stats` +
    `&modalId=${encodeURIComponent(modalId)}&title=${encodeURIComponent(title)}`;
  try {
    const auth = request.headers.get('authorization') || '';
    const res = await fetch(target, { headers: auth ? { Authorization: auth } : {} });
    const data = await res.json().catch(() => ({}));
    return json(data, { status: res.status });
  } catch (e: any) {
    return json({ supported: false, reason: 'error', message: e?.message || 'Upstream failure' }, { status: 502 });
  }
}
