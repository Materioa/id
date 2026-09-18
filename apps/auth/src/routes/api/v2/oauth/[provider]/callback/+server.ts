import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getFreshEnv } from '$lib/server/env';
import { 
  supabaseAdmin, 
  hashPassword,
  generateRecoveryKey,
  generateToken, 
  generateHandoffCode, 
  storeHandoffCode 
} from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import crypto from 'node:crypto';

import { setSessionCookie } from '@materio/config';

const ALLOWED_DOMAINS = ['@paruluniversity.ac.in', '@getmaterio.app', '@gmail.com'];

export async function GET({ params, url, request, getClientAddress, cookies }: RequestEvent) {
  const provider = params.provider.toLowerCase();
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');
  const stateRaw = url.searchParams.get('state') || '';
  const origin = url.origin;

  let callback = '';
  try {
    if (stateRaw) {
      const decoded = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
      callback = decoded.callback || '';
    }
  } catch {}

  if (errorParam) {
    throw redirect(302, `/login?error=${encodeURIComponent('Authentication canceled or denied by provider')}&provider=${provider}`);
  }

  if (!code) {
    throw redirect(302, `/login?error=${encodeURIComponent('No authorization code was provided')}&provider=${provider}`);
  }

  let email = '';
  let displayName = '';
  let profilePicture = '';
  let preferredUsername = '';

  try {
    if (provider === 'google') {
      const clientId = getFreshEnv('GOOGLE_CLIENT_ID');
      const clientSecret = getFreshEnv('GOOGLE_CLIENT_SECRET');
      const redirectUri = `${origin}/api/v2/oauth/google/callback`;

      // 1. Exchange code for Google tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json() as any;
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange Google authorization code');
      }

      // 2. Fetch Google user profile
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const userData = await userRes.json() as any;
      if (!userRes.ok || !userData.email) {
        throw new Error('Failed to retrieve Google user profile');
      }

      email = userData.email.toLowerCase().trim();
      displayName = userData.name || userData.given_name || email.split('@')[0];
      profilePicture = userData.picture || '';
      preferredUsername = email.split('@')[0];

    } else if (provider === 'github') {
      const clientId = getFreshEnv('GITHUB_CLIENT_ID');
      const clientSecret = getFreshEnv('GITHUB_CLIENT_SECRET');
      const redirectUri = `${origin}/api/v2/oauth/github/callback`;

      // 1. Exchange code for GitHub access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json() as any;
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange GitHub authorization code');
      }

      // 2. Fetch GitHub user profile
      const userRes = await fetch('https://api.github.com/user', {
        headers: { 
          'Authorization': `Bearer ${tokenData.access_token}`,
          'User-Agent': 'Materio-Auth'
        }
      });

      const userData = await userRes.json() as any;
      displayName = userData.name || userData.login || '';
      profilePicture = userData.avatar_url || '';
      preferredUsername = userData.login || '';

      // 3. Fetch GitHub emails to get verified primary email
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { 
          'Authorization': `Bearer ${tokenData.access_token}`,
          'User-Agent': 'Materio-Auth'
        }
      });

      if (emailRes.ok) {
        const emails = await emailRes.json() as any[];
        const primary = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified) || emails[0];
        if (primary) email = primary.email;
      } else if (userData.email) {
        email = userData.email;
      }

      email = (email || '').toLowerCase().trim();
      if (!email) {
        throw new Error('Could not obtain a verified email address from GitHub.');
      }
    } else {
      throw redirect(302, `/login?error=${encodeURIComponent('Unsupported OAuth provider')}`);
    }

    // STRICT DOMAIN RESTRICTION CHECK
    const isAllowed = ALLOWED_DOMAINS.some(domain => email.endsWith(domain));
    if (!isAllowed) {
      throw redirect(302, `/login?error=domain_restricted&provider=${provider}&blocked_email=${encodeURIComponent(email)}`);
    }

    // Check account suspension rules in MongoDB
    try {
      const db = await getDb();
      const banRule = await db.collection('abuse_moderation_rules').findOne({
        action: 'ban',
        active: { $ne: false },
        $or: [
          { email }
        ]
      });

      if (banRule) {
        const reason = banRule.body || banRule.reason || 'Violation of terms of service';
        throw redirect(302, `/login?error=${encodeURIComponent('Account suspended: ' + reason)}&provider=${provider}`);
      }
    } catch (err: any) {
      if (err.status === 302) throw err;
      console.error('Moderation check error:', err);
    }

    // Look up or auto-provision in custom `users` table
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (!user) {
      let username = preferredUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '') || email.split('@')[0];
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        username = `${username}_${Math.floor(100 + Math.random() * 900)}`;
      }

      const randomSecret = crypto.randomUUID() + crypto.randomBytes(32).toString('hex');
      const hashedPassword = await hashPassword(randomSecret);
      const recoveryKey = generateRecoveryKey();
      const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username)}&background=random&size=128&bold=true`;

      const newUserPayload: any = {
        id: crypto.randomUUID(),
        email,
        username,
        display_name: displayName || username,
        password: hashedPassword,
        recovery_key: recoveryKey,
        profile_picture: profilePicture || fallbackAvatar,
        has_admin_privileges: false,
        is_plus_user: false,
        two_factor_enabled: false,
        university_roll_no: email.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert(newUserPayload)
        .select('*')
        .single();

      if (createError) {
        console.error('Failed to auto-provision user:', createError);
        throw new Error('Failed to create user record: ' + createError.message);
      }
      user = createdUser;
    }

    // Generate custom Materio JWT token and session
    const sessionId = crypto.randomUUID();
    const token = generateToken({ id: user.id, email: user.email, username: user.username }, { jti: sessionId });
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

    await storeHandoffCode(handoffCode, token, user.id, userAgent, ip);

    // Set shared cross-app session cookie
    setSessionCookie(cookies, token, origin);

    // Redirect to login callback to set localStorage and finalize redirect
    const finalizeUrl = new URL(`${origin}/login/callback`);
    finalizeUrl.searchParams.set('token', token);
    finalizeUrl.searchParams.set('handoffCode', handoffCode);
    finalizeUrl.searchParams.set('provider', provider);
    if (callback) finalizeUrl.searchParams.set('callback', callback);

    throw redirect(302, finalizeUrl.toString());

  } catch (err: any) {
    if (err.status === 302) throw err;
    console.error('OAuth callback execution error:', err);
    throw redirect(302, `/login?error=${encodeURIComponent(err.message || 'Authentication failed')}&provider=${provider}`);
  }
}
