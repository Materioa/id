import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { 
  supabaseAdmin, 
  comparePassword, 
  generateToken, 
  generateHandoffCode,
  storeHandoffCode,
  consumeHandoffCode,
  verifyToken 
} from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { setSessionCookie } from '@materio/config';
import crypto from 'node:crypto';

export async function POST({ request, getClientAddress, cookies, url }: RequestEvent) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const { username, password, code, action } = body;

    // 1. EXCHANGE HANDOFF
    if (action === 'exchange' || code) {
      const exchangeCode = code || body.handoffCode;
      if (!exchangeCode) return json({ error: 'Handoff code is required' }, { status: 400 });

      const userAgent = request.headers.get('user-agent') || '';
      let ip = '';
      try { ip = request.headers.get('x-forwarded-for')?.split(',')[0] || getClientAddress() || ''; } catch(e){}

      const result = await consumeHandoffCode(exchangeCode, userAgent, ip);
      if (!result.valid) return json({ error: result.error }, { status: 401 });

      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, email, has_admin_privileges, is_plus_user, profile_picture')
        .eq('id', result.userId)
        .single();

      if (userError || !user) {
        setSessionCookie(cookies, result.token, url.origin);
        return json({ message: 'Handoff successful', token: result.token }, { status: 200 });
      }

      setSessionCookie(cookies, result.token, url.origin);
      return json({
        message: 'Handoff successful',
        token: result.token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          hasAdminPrivileges: user.has_admin_privileges,
          isPlusUser: user.is_plus_user,
          profilePicture: user.profile_picture
        }
      }, { status: 200 });
    }

    // 2. CREATE HANDOFF
    const authHeader = request.headers.get('authorization') || '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (action === 'create' || (tokenFromHeader && !password)) {
      if (!tokenFromHeader) return json({ error: 'Authentication required' }, { status: 401 });

      const decoded = await verifyToken(tokenFromHeader);
      if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

      const handoffCode = generateHandoffCode();
      const userAgent = request.headers.get('user-agent') || '';
      let ip = '';
      try { ip = request.headers.get('x-forwarded-for')?.split(',')[0] || getClientAddress() || ''; } catch(e){}

      const stored = await storeHandoffCode(handoffCode, tokenFromHeader, decoded.id, userAgent, ip);
      if (!stored) return json({ error: 'Failed to create handoff code' }, { status: 500 });

      return json({ message: 'Handoff code created', handoffCode, expiresIn: 60 }, { status: 200 });
    }

    // 3. TRADITIONAL LOGIN
    const normalizedUsername = (username || '').trim();
    const method = body.method || 'password';

    if (!normalizedUsername) return json({ error: 'Username or email is required' }, { status: 400 });
    if (method === 'password' && !password) return json({ error: 'Password is required' }, { status: 400 });
    if (method === 'otp' && !body.otp) return json({ error: 'Verification code is required' }, { status: 400 });

    const isEmail = /\S+@\S+\.\S+/.test(normalizedUsername);
    const field = isEmail ? 'email' : 'username';

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike(field, normalizedUsername)
      .maybeSingle();

    if (error || !user) return json({ error: 'Identity not found' }, { status: 401 });

    // Check if account is suspended in MongoDB abuse_moderation_rules
    try {
      const db = await getDb();
      const banRule = await db.collection('abuse_moderation_rules').findOne({
        action: 'ban',
        active: { $ne: false },
        $or: [
          { user_id: user.id },
          { username: user.username },
          { email: user.email }
        ]
      });

      if (banRule) {
        const reason = banRule.body || banRule.reason || 'Violation of platform terms and conditions';
        return json({
          error: `Your account has been suspended for: ${reason}. Access has been revoked.`,
          suspended: true,
          banReason: reason
        }, { status: 403 });
      }
    } catch (err) {
      console.error('Failed to check moderation rule during login:', err);
    }

    if (method === 'otp') {
      const { data: otpRecord, error: otpError } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('email', user.email)
        .eq('otp', body.otp)
        .eq('type', 'login')
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (otpError || !otpRecord) return json({ error: 'Invalid or expired verification code' }, { status: 401 });
      await supabaseAdmin.from('otps').delete().eq('id', otpRecord.id);
    } else {
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) return json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.two_factor_enabled) {
      // 2FA is required, return temp token
      const tempToken = generateToken({ id: user.id, email: user.email, username: user.username }, { tokenUse: '2fa_temp', expiresIn: '15m' });
      return json({
        message: '2FA required',
        requires_2fa: true,
        tempToken
      }, { status: 200 });
    }

    const sessionId = crypto.randomUUID();
    const token = generateToken({ id: user.id, email: user.email, username: user.username }, { jti: sessionId });
    const handoffCode = generateHandoffCode();
    const userAgent = request.headers.get('user-agent') || '';
    let ip = '';
    try { ip = request.headers.get('x-forwarded-for')?.split(',')[0] || getClientAddress() || ''; } catch(e){}

    // Create session in DB
    await supabaseAdmin.from('user_sessions').insert({
      id: sessionId,
      user_id: user.id,
      user_agent: userAgent,
      ip_address: ip
    });

    await storeHandoffCode(handoffCode, token, user.id, userAgent, ip);

    // Set shared cross-app session cookie
    setSessionCookie(cookies, token, url.origin);

    return json({
      message: 'Login successful',
      handoffCode,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        hasAdminPrivileges: user.has_admin_privileges,
        isPlusUser: user.is_plus_user,
        profilePicture: user.profile_picture
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Auth handler error:', error);
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
