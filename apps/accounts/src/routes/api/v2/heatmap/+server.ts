import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

export async function GET({ request }: RequestEvent) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const { data: stats, error } = await supabaseAdmin
      .from('user_daily_stats')
      .select('date, metrics, usermeta')
      .eq('user_id', decoded.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching heatmap stats:', error);
      return json({ error: 'Database error', details: error.message }, { status: 500 });
    }

    const heatmapData = (stats || []).map((row: any) => {
      const readingSec = row.metrics?.total_reading_sec || 0;
      const engagementSec = row.usermeta?.total_engagement_sec || 0;
      const totalHours = (readingSec + engagementSec) / 3600;
      return {
        date: new Date(row.date),
        value: totalHours
      };
    });

    return json({ data: heatmapData });
  } catch (err: any) {
    console.error('Heatmap API Error:', err);
    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
