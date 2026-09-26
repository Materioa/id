import { corsJson as J, handleOptions, corsHeaders } from '$lib/server/cors';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { razorpayKeys, rzpFetch } from '$lib/server/razorpay';
import { BILLING_PLANS } from '$lib/server/billing';

export async function OPTIONS({ request }: any) {
  return handleOptions(request);
}

const PLAN_LABELS: Record<string, string> = {
  plus: 'Materio Plus',
  pro: 'Materio Pro',
  weekly: 'Weekly Pass'
};

function periodLabel(startISO: string | null, endISO: string | null, plan: string | null): string {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const s = fmt(startISO);
  const e = fmt(endISO);
  if (s && e) return `${s} – ${e}`;
  if (plan === 'weekly') return '7 days of Pro';
  return 'Monthly billing';
}

function fileSlug(dateISO: string | null, id: string): string {
  const d = dateISO ? new Date(dateISO) : new Date();
  const stamp = Number.isNaN(d.getTime()) ? 'receipt' : d.toISOString().slice(0, 10);
  const short = String(id).replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'receipt';
  return `materio-invoice-${stamp}-${short}.pdf`;
}

/**
 * GET /api/v2/billing/invoices/[id]/pdf
 * Direct PDF download of an invoice, styled for Materio (no Razorpay page).
 * Accepts our local payment row id, or a Razorpay `inv_*` id (live keys).
 */
export async function GET({ request, params }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return J(request, { error: 'Unauthorized' }, 401);
    const decoded: any = await verifyToken(token);
    if (!decoded) return J(request, { error: 'Invalid or expired token' }, 401);

    const id = String(params.id || '');
    if (!id) return J(request, { error: 'Invoice id required' }, 400);

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email')
      .eq('id', decoded.id)
      .single();
    if (!user) return J(request, { error: 'User not found' }, 404);

    let plan: string | null = null;
    let amountPaise = 0;
    let dateISO: string | null = null;
    let status = 'recorded';
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    let isGiftLifetime = false;
    let number = id;
    let paymentId: string | null = null;
    let subscriptionId: string | null = null;
    let orderId: string | null = null;

    const { configured } = razorpayKeys();
    if (id.startsWith('inv_') && configured) {
      // Razorpay-hosted invoice.
      let inv: any = null;
      try {
        inv = await rzpFetch(`/invoices/${encodeURIComponent(id)}`);
      } catch (e: any) {
        return J(request, { error: e?.message || 'Invoice not found' }, 404);
      }
      // Only the owner's invoices: match by subscription or customer email.
      let mine = false;
      if (inv.subscription_id) {
        const { data: owner } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id', decoded.id)
          .eq('provider_subscription_id', inv.subscription_id)
          .maybeSingle();
        mine = Boolean(owner);
        if (mine) {
          const { data: pay } = await supabaseAdmin
            .from('payments')
            .select('plan, period_start, period_end, provider_payment_id, provider_subscription_id, provider_order_id')
            .eq('user_id', decoded.id)
            .eq('provider_subscription_id', inv.subscription_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          plan = (pay as any)?.plan ?? null;
          periodStart = (pay as any)?.period_start ?? null;
          periodEnd = (pay as any)?.period_end ?? null;
          paymentId = (pay as any)?.provider_payment_id ?? null;
          subscriptionId = inv.subscription_id ?? null;
          orderId = (pay as any)?.provider_order_id ?? null;
        }
      }
      if (!mine && inv.customer_details?.email) {
        mine = String(inv.customer_details.email).toLowerCase() === String((user as any).email).toLowerCase();
      }
      if (!mine) return J(request, { error: 'Invoice not found' }, 404);
      number = inv.invoice_number || inv.id;
      amountPaise = inv.gross_amount ?? inv.amount ?? 0;
      dateISO = inv.date ? new Date(Number(inv.date) * 1000).toISOString() : null;
      status = String(inv.status || 'issued');
    } else {
      // Our local payment record.
      const { data: row, error } = await supabaseAdmin
        .from('payments')
        .select('id, plan, amount_paise, currency, status, provider, provider_payment_id, provider_subscription_id, provider_order_id, period_start, period_end, created_at')
        .eq('id', id)
        .eq('user_id', decoded.id)
        .single();
      if (error || !row) return J(request, { error: 'Invoice not found' }, 404);
      plan = (row as any).plan;
      amountPaise = (row as any).amount_paise;
      dateISO = (row as any).created_at;
      status = String((row as any).status || 'recorded');
      periodStart = (row as any).period_start;
      periodEnd = (row as any).period_end;
      paymentId = (row as any).provider_payment_id ?? null;
      subscriptionId = (row as any).provider_subscription_id ?? null;
      orderId = (row as any).provider_order_id ?? null;
      number = String((row as any).id).slice(0, 8).toUpperCase();
      // Lifetime gift receipts never expire.
      if ((row as any).provider === 'gift' && amountPaise === 0) {
        periodStart = null;
        periodEnd = null;
        isGiftLifetime = true;
      }
    }

    let pdf: Uint8Array;
    try {
      const { buildInvoicePdf } = await import('$lib/server/invoice-pdf');
      const planShort = plan === 'plus' ? 'Materio Plus' : plan === 'pro' ? 'Materio Pro' : plan === 'weekly' ? 'Weekly Pass' : 'Materio';
      const isGift = isGiftLifetime;
      // Gift receipts show the month they cover (not lifetime text).
      let giftPeriod: string | null = null;
      if (isGift) {
        const base = periodStart ? new Date(periodStart) : dateISO ? new Date(dateISO) : new Date();
        if (!Number.isNaN(base.getTime())) {
          const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
          const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
          const f = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
          giftPeriod = `${f(first)} – ${f(last)}`;
        }
      }
      const unitPaise = isGift && plan && (BILLING_PLANS as any)[plan] ? (BILLING_PLANS as any)[plan].pricePaise : amountPaise;
      pdf = await buildInvoicePdf({
        number,
        dateISO,
        status,
        billedToName: (user as any).display_name || (user as any).username || '',
        billedToEmail: (user as any).email || '',
        billedToUsername: (user as any).username || '',
        planLabel: (plan && PLAN_LABELS[plan]) || 'Materio subscription',
        planShort,
        periodLabel: isGift && giftPeriod ? giftPeriod : periodLabel(periodStart, periodEnd, plan),
        amountPaise,
        isGift,
        unitPaise,
        paymentId,
        subscriptionId,
        orderId
      });
    } catch (e: any) {
      return J(request, { error: 'Failed to generate invoice PDF', details: e?.message }, 500);
    }

    // ArrayBuffer → Response body (Workers-safe, no Node Buffer needed).
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileSlug(dateISO, id)}"`
      }
    });
  } catch (e: any) {
    return J(request, { error: 'Internal server error', details: e?.message }, 500);
  }
}
