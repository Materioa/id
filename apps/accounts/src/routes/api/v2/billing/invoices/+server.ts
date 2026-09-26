import { corsJson as J, handleOptions } from '$lib/server/cors';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { razorpayKeys, rzpFetch } from '$lib/server/razorpay';

export async function OPTIONS({ request }: any) {
  return handleOptions(request);
}

function toISO(ts: number | null | undefined): string | null {
  if (!ts || Number(ts) <= 0) return null;
  const d = new Date(Number(ts) * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * GET /api/v2/billing/invoices
 * Styled invoice list for the subscription page. Each row merges our local
 * payment record (plan, period) with the Razorpay invoice (status +
 * short_url for view/download). Rows without a Razorpay match (mock/test
 * payments) carry downloadUrl: null.
 */
export async function GET({ request }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return J(request, { error: 'Unauthorized' }, 401);
    const decoded: any = await verifyToken(token);
    if (!decoded) return J(request, { error: 'Invalid or expired token' }, 401);

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, provider_subscription_id')
      .eq('id', decoded.id)
      .single();
    if (!user) return J(request, { error: 'User not found' }, 404);

    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('id, plan, amount_paise, currency, status, provider_subscription_id, provider_payment_id, period_start, period_end, created_at')
      .eq('user_id', decoded.id)
      .order('created_at', { ascending: false })
      .limit(25);

    const rows: any[] = payments ?? [];
    const subIds = [...new Set([
      ...((user as any).provider_subscription_id ? [(user as any).provider_subscription_id] : []),
      ...rows.map((r: any) => r.provider_subscription_id).filter(Boolean)
    ])].slice(0, 5);

    // Pull Razorpay invoices per subscription (for status + download links).
    const rzpBySub = new Map<string, any[]>();
    const { configured } = razorpayKeys();
    if (configured && subIds.length > 0) {
      await Promise.all(subIds.map(async (sid) => {
        try {
          const col = await rzpFetch(`/invoices?subscription_id=${encodeURIComponent(sid)}&count=25`);
          const items = Array.isArray(col?.items) ? col.items : [];
          rzpBySub.set(sid, items);
        } catch {
          rzpBySub.set(sid, []);
        }
      }));
    }

    const usedInv = new Set<string>();
    const invoices = rows.map((r: any) => {
      const pool = (r.provider_subscription_id && rzpBySub.get(r.provider_subscription_id)) || [];
      const match = pool.find((inv: any) => !usedInv.has(inv.id));
      if (match) usedInv.add(match.id);
      return {
        id: match?.id ?? r.id,
        invoiceNumber: match?.invoice_number ?? null,
        date: (match && (toISO(match.date) || toISO(match.created_at))) || r.created_at,
        plan: r.plan,
        amountPaise: match?.gross_amount ?? match?.amount ?? r.amount_paise,
        currency: match?.currency?.toLowerCase?.() || r.currency || 'inr',
        status: match ? String(match.status || 'issued') : r.status,
        periodEnd: r.period_end ?? null,
        downloadUrl: match?.short_url ?? null,
        receipt: match?.receipt ?? null
      };
    });

    // Razorpay invoices with no local payment row (shouldn't normally happen).
    for (const [, items] of rzpBySub) {
      for (const inv of items) {
        if (usedInv.has(inv.id)) continue;
        invoices.push({
          id: inv.id,
          invoiceNumber: inv.invoice_number ?? null,
          date: toISO(inv.date) || toISO(inv.created_at),
          plan: null,
          amountPaise: inv.gross_amount ?? inv.amount ?? 0,
          currency: (inv.currency || 'inr').toLowerCase(),
          status: String(inv.status || 'issued'),
          periodEnd: null,
          downloadUrl: inv.short_url ?? null,
          receipt: inv.receipt ?? null
        });
      }
    }

    invoices.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    return J(request, { invoices, count: invoices.length });
  } catch (e: any) {
    return J(request, { error: 'Internal server error', details: e?.message }, 500);
  }
}
