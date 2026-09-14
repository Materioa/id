import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken, generateToken, generateHandoffCode, storeHandoffCode, verifyTOTP } from '$lib/server/utils';
import crypto from 'node:crypto';

export async function POST({ request, getClientAddress }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded || decoded.token_use !== '2fa_temp') return json({ error: 'Invalid or expired temporary token' }, { status: 401 });

    const { code } = (await request.json().catch(() => ({}))) as any;
    if (!code) return json({ error: 'Missing code' }, { status: 400 });

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, has_admin_privileges, is_plus_user, profile_picture, two_factor_secret')
      .eq('id', decoded.id)
      .single();

    if (userError || !user || !user.two_factor_secret) {
      return json({ error: '2FA not configured properly' }, { status: 400 });
    }

    let isValid = false;
    
    if (code.length === 6) {
      isValid = verifyTOTP(code, user.two_factor_secret);
    }

    if (isValid) {

      const sessionId = crypto.randomUUID();
      const finalToken = generateToken({ id: user.id, email: user.email, username: user.username }, { jti: sessionId });
      const handoffCode = generateHandoffCode();
      const userAgent = request.headers.get('user-agent') || '';
      let ip = '';
      try { ip = request.headers.get('x-forwarded-for')?.split(',')[0] || getClientAddress() || ''; } catch(e){}

      await supabaseAdmin.from('user_sessions').insert({
        id: sessionId,
        user_id: user.id,
        user_agent: userAgent,
        ip_address: ip
      });

      await storeHandoffCode(handoffCode, finalToken, user.id, userAgent, ip);

      return json({
        message: 'Login successful',
        handoffCode,
        token: finalToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          hasAdminPrivileges: user.has_admin_privileges,
          isPlusUser: user.is_plus_user,
          profilePicture: user.profile_picture
        }
      });
    } else {
      return json({ error: 'Invalid verification code' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Error verifying 2FA for login:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
