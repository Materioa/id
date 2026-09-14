import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken, verifyTOTP } from '$lib/server/utils';

export async function POST({ request }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid token' }, { status: 401 });

    const { code } = (await request.json().catch(() => ({}))) as any;
    if (!code) return json({ error: 'Missing code' }, { status: 400 });

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('two_factor_secret')
      .eq('id', decoded.id)
      .single();

    if (userError || !user || !user.two_factor_secret) {
      return json({ error: '2FA not initialized' }, { status: 400 });
    }

    const isValid = verifyTOTP(code, user.two_factor_secret);
    
    if (isValid) {
      // Enable 2FA on the account
      await supabaseAdmin
        .from('users')
        .update({ two_factor_enabled: true, two_factor_enabled_at: new Date().toISOString() })
        .eq('id', decoded.id);
        
      return json({ success: true, message: '2FA has been successfully enabled' });
    } else {
      return json({ error: 'Invalid verification code' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Error verifying 2FA:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
