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

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const period = url.searchParams.get('period') || 'all_time';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 50);
    const pdfSearch = url.searchParams.get('pdfSearch');

    const isAllTime = period === 'all_time';

    const { data: topPdfs, error: pdfsError } = await supabaseAdmin.rpc('get_top_pdfs_v4');
    const { data: topUsers, error: usersError } = await supabaseAdmin.rpc('get_top_readers_v4');

    if (pdfsError) {
      console.error('RPC Error (top_pdfs):', pdfsError);
      throw pdfsError;
    }
    if (usersError) {
      console.error('RPC Error (top_users):', usersError);
      throw usersError;
    }

    let filteredPdfs = topPdfs || [];
    if (pdfSearch) {
      const search = pdfSearch.toLowerCase();
      filteredPdfs = filteredPdfs.filter((pdf: any) => String(pdf.title || '').toLowerCase().includes(search));
    }

    return json({
      period,
      range: isAllTime ? null : undefined,
      filters: {
        pdfSearch: pdfSearch || null
      },
      top_pdfs: filteredPdfs.slice(0, limit),
      top_users: (topUsers || []).slice(0, limit)
    });
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
