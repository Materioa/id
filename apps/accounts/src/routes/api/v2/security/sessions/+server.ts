import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

export async function GET({ request }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid token' }, { status: 401 });

    const { data: sessions, error } = await supabaseAdmin
      .from('user_sessions')
      .select('id, user_agent, ip_address, created_at, last_active_at')
      .eq('user_id', decoded.id)
      .order('last_active_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return json({ error: 'Database error' }, { status: 500 });
    }
    
    return json({ sessions, currentSessionId: decoded.jti });
  } catch (err: any) {
    console.error('Sessions API Error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE({ request, url }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid token' }, { status: 401 });

    const sessionId = url.searchParams.get('id');
    if (!sessionId) return json({ error: 'Session ID required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', decoded.id);

    if (error) {
      console.error('Error revoking session:', error);
      return json({ error: 'Failed to revoke session' }, { status: 500 });
    }
    
    return json({ success: true });
  } catch (err: any) {
    console.error('Session Revoke API Error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
