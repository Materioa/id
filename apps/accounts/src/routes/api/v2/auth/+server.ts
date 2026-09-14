import { json } from '@sveltejs/kit';
import { 
  supabase,
  supabaseAdmin,
  hashPassword,
  generateToken,
  generateIdToken,
  getJwks,
  generateOpaqueToken,
  hashToken,
  verifyToken
} from '$lib/server/utils';
import { sendOTPEmail } from '$lib/server/mailer';
import { getOTPTemplate } from '$lib/server/otp_template';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
const DEFAULT_ISSUER = 'https://getmaterio.app';
const DEFAULT_SCOPES = 'openid profile email offline_access admin';

function getIssuer(req: Request) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return env.OAUTH_ISSUER || (host ? `${proto}://${host}` : DEFAULT_ISSUER);
}

function getAuthBaseUrl(req: Request) {
  return env.OAUTH_PUBLIC_BASE_URL || getIssuer(req);
}

function normalizeScope(scope: any) {
  const requested = String(scope || '').split(/\s+/).filter(Boolean);
  const unique = [...new Set(requested.length ? requested : ['admin'])];
  return unique.join(' ');
}

function hasScope(scope, value) {
  return String(scope || '').split(/\s+/).includes(value);
}

function oauthError(status: number, error: string, description?: string) {
  const payload: any = { error };
  if (description) payload.error_description = description;
  return json(payload, { status });
}

function oauthRedirectError(redirectUri: string, error: string, description?: string, state?: string) {
  try {
    const target = new URL(redirectUri);
    target.searchParams.set('error', error);
    if (description) target.searchParams.set('error_description', description);
    if (state) target.searchParams.set('state', state);
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  } catch (e) {
    return oauthError(400, error, description);
  }
}

function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function getClientRedirectUris(app) {
  const uris = parseJsonArray(app?.redirect_uris, []);
  if (app?.redirect_uri && !uris.includes(app.redirect_uri)) uris.push(app.redirect_uri);
  return uris;
}

function isRedirectUriAllowed(app, redirectUri) {
  const uris = getClientRedirectUris(app);
  return uris.length === 0 ? false : uris.includes(redirectUri);
}

function getBasicClientCredentials(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('basic ')) return {};
  const decodedStr = Buffer.from(authHeader.substring(6).trim(), 'base64').toString();
  const firstColon = decodedStr.indexOf(':');
  if (firstColon === -1) return {};
  return {
    client_id: decodeURIComponent(decodedStr.substring(0, firstColon)),
    client_secret: decodeURIComponent(decodedStr.substring(firstColon + 1))
  };
}

async function isTokenRevoked(token) {
  if (!token) return false;
  const { data } = await supabaseAdmin
    .from('oauth_revoked_tokens')
    .select('token_hash')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  return Boolean(data);
}

export async function POST({ request, url }: any) {
  return handleMain(request, url);
}

export async function GET({ request, url }: any) {
  return handleMain(request, url);
}

async function handleMain(req: Request, url: URL) {
  let bodyData: any = {};
  if (req.method === 'POST') {
    bodyData = await req.json().catch(() => ({} as any));
  }

  let action = url.searchParams.get('action') || bodyData.action;

  // Auto-detect OAuth Token exchange standard requests if action is not specified
  if (!action && req.method === 'POST') {
    const grantType = (bodyData as any).grant_type || url.searchParams.get('grant_type');
    if (grantType === 'authorization_code' || grantType === 'refresh_token') {
      action = 'oauth_token';
    }
  }

  // Method restrictions
  const isOauthGet = (action === 'oauth_list_apps' || action === 'oauth_client_info' || action === 'fetch_url_title' || action === 'oauth_metadata' || action === 'oidc_metadata' || action === 'jwks' || action === 'userinfo') && req.method === 'GET';
  if (req.method !== 'POST' && !isOauthGet) {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (action === 'forgot-password') {
    return handleForgotPassword(req, bodyData, url);
  } else if (action === 'admin-recovery') {
    return handleAdminRecovery(req, bodyData, url);
  } else if (action === 'otp') {
    return handleOTP(req, bodyData, url);
  } else if (action === 'oauth_list_apps') {
    return handleOAuthListApps(req, bodyData, url);
  } else if (action === 'oauth_register_app') {
    return handleOAuthRegisterApp(req, bodyData, url);
  } else if (action === 'oauth_delete_app') {
    return handleOAuthDeleteApp(req, bodyData, url);
  } else if (action === 'oauth_client_info') {
    return handleOAuthClientInfo(req, bodyData, url);
  } else if (action === 'fetch_url_title') {
    return handleFetchUrlTitle(req, bodyData, url);
  } else if (action === 'oauth_authorize') {
    return handleOAuthAuthorize(req, bodyData, url);
  } else if (action === 'oauth_token') {
    return handleOAuthToken(req, bodyData, url);
  } else if (action === 'oauth_metadata' || action === 'oidc_metadata') {
    return handleOAuthMetadata(req, bodyData, url, action === 'oidc_metadata');
  } else if (action === 'jwks') {
    return handleJwks(req, bodyData, url);
  } else if (action === 'userinfo') {
    return handleUserInfo(req, bodyData, url);
  } else if (action === 'oauth_revoke') {
    return handleOAuthRevoke(req, bodyData, url);
  } else if (action === 'oauth_introspect') {
    return handleOAuthIntrospect(req, bodyData, url);
  } else if (action === 'logout') {
    return handleLogout(req, bodyData, url);
  } else {
    return json({ error: 'Invalid action' }, { status: 400 });
  }
};

async function handleOAuthMetadata(req: Request, bodyData: any, url: URL, oidc = false) {
  const issuer = getIssuer(req);
  const baseUrl = getAuthBaseUrl(req);
  const metadata = {
    issuer,
    authorization_endpoint: `${baseUrl}/account/sso`,
    token_endpoint: `${baseUrl}/api/v2/auth`,
    jwks_uri: `${baseUrl}/api/v2/auth?action=jwks`,
    registration_endpoint: `${baseUrl}/api/v2/auth?action=oauth_register_app`,
    revocation_endpoint: `${baseUrl}/api/v2/auth?action=oauth_revoke`,
    introspection_endpoint: `${baseUrl}/api/v2/auth?action=oauth_introspect`,
    userinfo_endpoint: `${baseUrl}/api/v2/auth?action=userinfo`,
    end_session_endpoint: `${baseUrl}/api/v2/auth?action=logout`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: DEFAULT_SCOPES.split(' '),
    claims_supported: ['sub', 'email', 'email_verified', 'preferred_username', 'name', 'picture', 'auth_time'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [env.OIDC_PRIVATE_KEY || env.OIDC_PRIVATE_KEY_B64 ? 'RS256' : 'HS256']
  };

  if (!oidc) {
    delete metadata.claims_supported;
    delete metadata.subject_types_supported;
    delete metadata.id_token_signing_alg_values_supported;
  }

  return json(metadata, { status: 200 });
}

async function handleJwks(req: Request, bodyData: any, url: URL) {
  return json(getJwks(), { status: 200 });
}

async function handleUserInfo(req: Request, bodyData: any, url: URL) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return oauthError(401, 'invalid_token', 'Bearer token is required');
    if (await isTokenRevoked(token)) return oauthError(401, 'invalid_token', 'Token has been revoked');

    const decoded = await verifyToken(token);
    if (!decoded) return oauthError(401, 'invalid_token', 'Token is invalid or expired');

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, profile_picture')
      .eq('id', decoded.id || decoded.sub)
      .single();

    if (error || !user) return oauthError(404, 'invalid_token', 'User not found');

    return json({
      sub: String(user.id),
      email: user.email,
      email_verified: Boolean(user.email),
      preferred_username: user.username,
      name: user.display_name || user.username,
      picture: user.profile_picture || null
    });
  } catch (error) {
    console.error('userinfo error:', error);
    return json({ error: 'server_error' }, { status: 500 });
  }
}

async function handleOAuthRevoke(req: Request, bodyData: any, url: URL) {
  try {
    const body: any = bodyData || {};
    const token = body.token || url.searchParams.get('token');
    const tokenTypeHint = body.token_type_hint || url.searchParams.get('token_type_hint') || null;
    if (!token) return oauthError(400, 'invalid_request', 'token is required');

    let decoded = await verifyToken(token);
    let userId = decoded?.id || decoded?.sub || null;
    let clientId = decoded?.client_id || body.client_id || url.searchParams.get('client_id') || null;

    await supabaseAdmin
      .from('oauth_revoked_tokens')
      .upsert({
        token_hash: hashToken(token),
        token_type_hint: tokenTypeHint,
        user_id: userId,
        client_id: clientId,
        expires_at: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        revoked_at: new Date().toISOString()
      });

    if (tokenTypeHint === 'refresh_token' || !decoded) {
      await supabaseAdmin
        .from('oauth_refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', hashToken(token));
    }

    return new Response('', { status: 200 });
  } catch (error) {
    console.error('oauth_revoke error:', error);
    return json({ error: 'server_error' }, { status: 500 });
  }
}

async function handleOAuthIntrospect(req: Request, bodyData: any, url: URL) {
  try {
    const body: any = bodyData || {};
    const token = body.token || url.searchParams.get('token');
    if (!token) return oauthError(400, 'invalid_request', 'token is required');

    // Resolve client credentials from Authorization header or body
    const basic = getBasicClientCredentials(req);
    const client_id = body.client_id || url.searchParams.get('client_id') || basic.client_id;
    const client_secret = body.client_secret || url.searchParams.get('client_secret') || basic.client_secret;

    if (!client_id) {
      return oauthError(401, 'invalid_client', 'client_id is required for introspection');
    }

    // Look up client app
    const { data: app, error: appError } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    if (appError || !app) {
      return oauthError(401, 'invalid_client', 'Client not found');
    }

    // Authenticate client
    const authMethod = app.token_endpoint_auth_method || (client_secret ? 'client_secret_post' : 'none');
    if (authMethod !== 'none' && app.client_secret && app.client_secret !== client_secret) {
      
      return oauthError(401, 'invalid_client', 'Invalid client credentials');
    }

    const decoded = await verifyToken(token);
    if (!decoded || await isTokenRevoked(token)) {
      return json({ active: false }, { status: 200 });
    }

    // Check that the client calling introspection is the client to which the token was issued
    if (decoded.client_id !== client_id) {
      return oauthError(403, 'forbidden', 'Token was not issued to this client');
    }

    return json({
      active: true,
      sub: String(decoded.sub || decoded.id),
      username: decoded.username,
      email: decoded.email,
      client_id: decoded.client_id,
      scope: decoded.scope,
      token_type: 'Bearer',
      exp: decoded.exp,
      iat: decoded.iat,
      iss: decoded.iss,
      aud: decoded.aud,
      jti: decoded.jti
    });
  } catch (error) {
    console.error('oauth_introspect error:', error);
    return json({ error: 'server_error' }, { status: 500 });
  }
}

async function handleLogout(req: Request, bodyData: any, url: URL) {
  try {
    const postLogoutRedirectUri = url.searchParams.get('post_logout_redirect_uri') || bodyData?.post_logout_redirect_uri || '/';
    const state = url.searchParams.get('state') || bodyData?.state || '';
    const idTokenHint = url.searchParams.get('id_token_hint') || bodyData?.id_token_hint || ''; // support id_token_hint for OIDC RP-Initiated Logout

    // Validate postLogoutRedirectUri against registered URIs to prevent open redirects
    let safeRedirectUri = '/';
    if (postLogoutRedirectUri !== '/') {
      if (idTokenHint) {
        // loosely verify token just to extract audience without forcing strict signature failure for expired tokens
        let clientId = null;
        try {
          const payload = JSON.parse(Buffer.from(idTokenHint.split('.')[1], 'base64').toString());
          clientId = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
        } catch (e) {}

        if (clientId) {
          const { data: app } = await supabaseAdmin.from('oauth_apps').select('post_logout_redirect_uris').eq('client_id', clientId).maybeSingle();
          if (app) {
            const allowedUris = parseJsonArray(app.post_logout_redirect_uris, []);
            if (allowedUris.includes(postLogoutRedirectUri)) {
              safeRedirectUri = postLogoutRedirectUri;
            }
          }
        }
      }
    }

    // Clear standard cookie
    

    // Construct redirect URL
    let targetUrl;
    try {
      targetUrl = new URL(safeRedirectUri, getIssuer(req));
      if (state && safeRedirectUri !== '/') targetUrl.searchParams.set('state', state);
    } catch (e) {
      targetUrl = new URL('/', getIssuer(req));
    }

    // Return page to clear localStorage on the main domain
    
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Logging out...</title>
        <script>
          try {
            localStorage.removeItem('materio_auth_token', { status: 200 });
            localStorage.removeItem('materio_user');
          } catch (e) {
            console.error('Failed to clear local storage:', e);
          }
          window.location.replace(${JSON.stringify(targetUrl.toString())});
        </script>
      </head>
      <body>
        <p>Logging out, please wait...</p>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Logout handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
async function handleForgotPassword(req: Request, bodyData: any, url: URL) {
  try {
    const { email, recoveryKey, recoveryCode, otp, newPassword } = bodyData;
 
    // Alias recoveryCode to recoveryKey for consistency with frontend naming
    const finalRecoveryKey = recoveryKey || recoveryCode;

    // Validate inputs
    if (!email) {
      return json({ error: 'Email is required' }, { status: 400 });
    }

    // Must have at least one method of verification
    if (!finalRecoveryKey && !otp) {
      return json({ error: 'Verification method (OTP or Recovery Key, { status: 400 }) is required' });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Verify method
    let isVerified = false;

    if (otp) {
      // Check OTP in Supabase otps table
      const { data: otpRecord, error: otpError } = await supabase
        .from('otps')
        .select('*')
        .eq('email', email)
        .eq('otp', otp)
        .eq('type', 'recovery')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!otpError && otpRecord) {
        isVerified = true;
        // Clean up OTP
        await supabase.from('otps').delete().eq('id', otpRecord.id);
      }
    } else if (finalRecoveryKey) {
      isVerified = (user.recovery_key === finalRecoveryKey);
    }

    if (!isVerified) {
      return json({ error: 'Verification failed. Incorrect code or key.' }, { status: 401 });
    }

    // Only proceed if newPassword is provided
    if (newPassword) {
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      const updateData = {
          password: hashedPassword,
          updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        return json({ error: 'Failed to update password' }, { status: 500 });
      }

      // Generate a token for the user so they can be logged in immediately
      const token = generateToken(user);
      return json({
        message: 'Password updated successfully',
        token: token
      }, { status: 200 });
    } else {
      // Just verifying the key/OTP
      return json({
        verified: true,
        message: 'Verification successful'
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleAdminRecovery(req: Request, bodyData: any, url: URL) {
  try {
    // Get token from headers
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';

    if (!token) {
      return json({ error: 'Authentication token required' }, { status: 401 });
    }

    // Verify token
    const decoded = await verifyToken(token);
    if (!decoded) {
      return json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get admin user and verify privileges
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, has_admin_privileges')
      .eq('id', decoded.id)
      .single();

    if (adminError || !adminUser || !adminUser.has_admin_privileges) {
      return json({ error: 'Admin privileges required for account recovery service' }, { status: 403 });
    }

    // Parse request body
    const { email, username } = bodyData;

    // Validate required fields
    if (!email || !username) {
      return json({ error: 'Both email and username are required for account recovery' }, { status: 400 });
    }

    // Find target user by email AND username for security
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username, display_name, email, profile_picture, created_at, updated_at, recovery_key, has_admin_privileges, is_plus_user')
      .eq('email', email)
      .eq('username', username)
      .single();

    if (userError || !targetUser) {
      return json({
        error: 'User not found with the provided email and username combination',
        details: 'Both email and username must match exactly for security purposes'
      }, { status: 404 });
    }

    // Log the recovery attempt for audit purposes
    console.log(`Admin recovery attempted by ${adminUser.id} for user ${targetUser.id} (${targetUser.email})`);

    // Return the recovery key and all user data
    return json({
      message: 'Account recovery data retrieved successfully',
      recoveryService: 'Premium Admin Account Recovery',
      adminId: adminUser.id,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.display_name,
        email: targetUser.email,
        profilePicture: targetUser.profile_picture,
        recoveryKey: targetUser.recovery_key,
        hasAdminPrivileges: targetUser.has_admin_privileges,
        isPlusUser: targetUser.is_plus_user,
        createdAt: targetUser.created_at,
        updatedAt: targetUser.updated_at
      },
      securityNote: 'This recovery includes the user\'s recovery key for password reset purposes',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin recovery error:', error);
    return json({
      error: 'Internal server error during account recovery',
      details: error.message
    }, { status: 500 });
  }
}

async function handleOTP(req: Request, bodyData: any, url: URL) {
  try {
    const { email, type } = bodyData; // type: 'signup' or 'recovery'

    if (!email || !type) {
      return json({ error: 'Email and type are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Signup restricted to university email
    if (type === 'signup') {
      if (!normalizedEmail.endsWith('@paruluniversity.ac.in') && !normalizedEmail.endsWith('@getmaterio.app')) {
        return json({ 
          error: 'Restricted Signup', 
          message: 'Only students with @paruluniversity.ac.in emails are allowed to create an account.' 
        }, { status: 400 });
      }
    }

    // Clean up previous OTPs for this email and type
    await supabaseAdmin
      .from('otps')
      .delete()
      .eq('email', normalizedEmail)
      .eq('type', type);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store in Supabase otps table
    const { error: dbError } = await supabaseAdmin
      .from('otps')
      .insert({
        email: normalizedEmail,
        otp,
        type,
        expires_at: expiresAt
      });

    if (dbError) {
      console.error('OTP Save Error:', {
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code
      });
      return json({ error: 'Failed to generate verification code', details: dbError.message }, { status: 500 });
    }

    // Render Template
    const html = getOTPTemplate(otp, type, normalizedEmail);

    // Send Email
    const emailResult = await sendOTPEmail({
      to: normalizedEmail,
      otp,
      type,
      html
    });

    if (!emailResult.success) {
      if (emailResult.error === 'SMTP not configured') {
        console.log(`\n[DEV MODE - OTP GENERATED] Send this code to ${normalizedEmail}: ${otp}\n`);
        return json({ 
          success: true, 
          message: `A verification code has been sent to ${email} (Simulated in Console). It expires in 10 minutes.` 
        }, { status: 200 });
      }
      console.error('OTP Email Delivery Error:', emailResult.error);
      return json({ 
        error: 'Failed to send verification email',
        message: `Email delivery failed: ${emailResult.error || 'SMTP configuration error'}. Please verify email address or try again later.`,
        details: emailResult.error 
      }, { status: 500 });
    }

    return json({ 
      success: true, 
      message: `A verification code has been sent to ${email}. It expires in 10 minutes.` 
    }, { status: 200 });

  } catch (error) {
    console.error('OTP Handler Error:', error);
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// ==========================================
// OAuth Helpers & Handlers
// ==========================================

async function getAuthedUser(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) {
    return null;
  }
  const decoded = await verifyToken(token);
  if (!decoded) {
    return null;
  }
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    return null;
  }
  return user;
}

async function handleOAuthListApps(req: Request, bodyData: any, url: URL) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { data: apps, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return json({ error: 'Database error', details: error.message }, { status: 500 });
    }

    return json({ apps: apps || [] }, { status: 200 });
  } catch (error) {
    console.error('oauth_list_apps error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleOAuthRegisterApp(req: Request, bodyData: any, url: URL) {
  try {
    const body: any = bodyData || {};

    // RFC 7591-style Dynamic Client Registration. This branch intentionally does
    // not require a logged-in Materio user because the user grant happens later.
    if (Array.isArray(body.redirect_uris)) {
      if (body.redirect_uris.length === 0) {
        return oauthError(400, 'invalid_client_metadata', 'redirect_uris must contain at least one URI');
      }

      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabaseAdmin
        .from('oauth_registration_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('created_at', oneHourAgo);

      if (countError) {
        console.error('Failed to query registration logs:', countError);
      } else if (count && count >= 5) {
        return oauthError(429, 'slow_down', 'Too many registration attempts. Please try again later.');
      }

      const clientId = body.client_id || 'client_' + crypto.randomBytes(12).toString('hex');
      const authMethod = body.token_endpoint_auth_method || 'none';
      const isPublicClient = authMethod === 'none';
      const clientSecret = isPublicClient ? null : 'secret_' + crypto.randomBytes(24).toString('hex');
      const clientName = body.client_name || 'OAuth Client';
      const scope = normalizeScope(body.scope || 'openid profile email');

      const extendedPayload = {
        client_id: clientId,
        client_secret: clientSecret || '',
        name: clientName,
        redirect_uri: body.redirect_uris[0],
        redirect_uris: body.redirect_uris,
        user_id: null,
        token_endpoint_auth_method: authMethod,
        scope,
        client_uri: body.client_uri || null,
        logo_uri: body.logo_uri || null,
        contacts: Array.isArray(body.contacts) ? body.contacts : []
      };

      const { error } = await supabaseAdmin
        .from('oauth_apps')
        .insert(extendedPayload);

      if (error) {
        return oauthError(500, 'server_error', error.message || 'Failed to register client');
      }

      // Log successful registration for rate limiting
      await supabaseAdmin
        .from('oauth_registration_logs')
        .insert({ ip_address: ip });

      const responsePayload = {
        client_id: clientId,
        client_name: clientName,
        redirect_uris: body.redirect_uris,
        grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
        response_types: body.response_types || ['code'],
        token_endpoint_auth_method: authMethod,
        scope,
        client_id_issued_at: Math.floor(Date.now() / 1000)
      };

      if (clientSecret) {
        (responsePayload as any).client_secret = clientSecret;
        (responsePayload as any).client_secret_expires_at = 0;
      }

      return json(responsePayload, { status: 201 });
    }

    // Existing dashboard app registration for authenticated Materio users.
    const user = await getAuthedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { name, redirectUri } = body as any;
    if (!name || !redirectUri) {
      return json({ error: 'Application name and redirect URI are required' }, { status: 400 });
    }

    const clientId = 'client_' + crypto.randomBytes(8).toString('hex');
    const clientSecret = 'secret_' + crypto.randomBytes(16).toString('hex');

    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .insert({
        client_id: clientId,
        client_secret: clientSecret,
        name,
        redirect_uri: redirectUri,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      return json({ error: 'Failed to register application', details: error.message }, { status: 500 });
    }

    return json({ success: true, app }, { status: 200 });
  } catch (error) {
    console.error('oauth_register_app error:', error);
    return json({ error: 'server_error' }, { status: 500 });
  }
}
async function handleOAuthDeleteApp(req: Request, bodyData: any, url: URL) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { clientId } = bodyData || {};

    if (!clientId) {
      return json({ error: 'Client ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('oauth_apps')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', user.id);

    if (error) {
      return json({ error: 'Failed to delete application', details: error.message }, { status: 500 });
    }

    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('oauth_delete_app error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleOAuthClientInfo(req: Request, bodyData: any, url: URL) {
  try {
    const clientId = url.searchParams.get('client_id') || (bodyData && (bodyData as any).client_id);

    if (!clientId) {
      return json({ error: 'Client ID is required' }, { status: 400 });
    }

    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('client_id, name, redirect_uri')
      .eq('client_id', clientId)
      .single();

    if (error || !app) {
      return json({ error: 'Application not found' }, { status: 404 });
    }

    return json({
      client_id: app.client_id,
      name: app.name,
      redirect_uri: app.redirect_uri
    }, { status: 200 });
  } catch (error) {
    console.error('oauth_client_info error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleOAuthAuthorize(req: Request, bodyData: any, url: URL) {
  try {
    const {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      response_type = 'code',
      scope,
      state,
      nonce,
      prompt,
      auth_time
    } = bodyData || {};

    const user = await getAuthedUser(req);
    if (!user) {
      if (prompt === 'none') {
        return redirect_uri 
          ? oauthRedirectError(redirect_uri, 'login_required', 'User is not logged in', state)
          : oauthError(400, 'login_required', 'User is not logged in');
      }
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (response_type !== 'code') {
      return redirect_uri
        ? oauthRedirectError(redirect_uri, 'unsupported_response_type', 'Only authorization code flow is supported', state)
        : oauthError(400, 'unsupported_response_type', 'Only authorization code flow is supported');
    }

    if (!client_id || !redirect_uri) {
      return oauthError(400, 'invalid_request', 'client_id and redirect_uri are required');
    }

    if (code_challenge && code_challenge_method !== 'S256') {
      return oauthRedirectError(redirect_uri, 'invalid_request', 'Only S256 PKCE is supported', state);
    }

    const { data: app, error } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    const isDynamicClient = (error || !app);
    const requiresPkce = isDynamicClient || app?.token_endpoint_auth_method === 'none' || app?.enforce_pkce;
    if (requiresPkce && !code_challenge) {
      return oauthRedirectError(redirect_uri, 'invalid_request', 'PKCE is required for this client', state);
    }

    if (!isDynamicClient && !isRedirectUriAllowed(app, redirect_uri)) {
      return oauthError(400, 'invalid_request', 'Redirect URI mismatch');
    }

    if (isDynamicClient) {
      const clientSecret = 'secret_dynamic_' + crypto.randomBytes(16).toString('hex');
      let appName = 'Dynamic OAuth Client';
      if (client_id.startsWith('http')) {
        try { appName = new URL(client_id).hostname; } catch (e) {}
      }

      const extendedInsertPayload = {
        client_id,
        client_secret: clientSecret,
        name: appName,
        redirect_uri,
        redirect_uris: [redirect_uri],
        user_id: user.id,
        token_endpoint_auth_method: 'none',
        scope: normalizeScope(scope || 'admin')
      };
      const legacyInsertPayload = {
        client_id,
        client_secret: clientSecret,
        name: appName,
        redirect_uri,
        user_id: user.id
      };

      let { error: insertAppError } = await supabaseAdmin
        .from('oauth_apps')
        .insert(extendedInsertPayload);

      if (insertAppError) {
        const fallback = await supabaseAdmin.from('oauth_apps').insert(legacyInsertPayload);
        insertAppError = fallback.error;
      }

      if (insertAppError) {
        return oauthRedirectError(redirect_uri, 'server_error', 'Failed to register dynamic client', state);
      }
    }

    const code = generateOpaqueToken(32);
    const normalizedScope = normalizeScope(scope || app?.scope || 'admin');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // Use frontend-provided auth_time if available, otherwise current time
    let codeAuthTime = new Date().toISOString();
    if (auth_time) {
      const parsedTime = new Date(auth_time);
      if (!isNaN(parsedTime.getTime())) codeAuthTime = parsedTime.toISOString();
    }
    const token = generateToken(user, {
      issuer: getIssuer(req),
      audience: client_id,
      clientId: client_id,
      scope: normalizedScope,
      tokenUse: 'access'
    });

    const extendedCodePayload = {
      code,
      client_id,
      user_id: user.id,
      redirect_uri,
      token,
      expires_at: expiresAt,
      code_challenge: code_challenge || null,
      code_challenge_method: code_challenge_method || null,
      scope: normalizedScope,
      nonce: nonce || null,
      auth_time: codeAuthTime
    };

    let { error: insertError } = await supabaseAdmin
      .from('oauth_codes')
      .insert(extendedCodePayload);

    if (insertError) {
      const legacyPayload = {
        code,
        client_id,
        user_id: user.id,
        redirect_uri,
        token,
        expires_at: expiresAt
      };
      const fallback = await supabaseAdmin.from('oauth_codes').insert(legacyPayload);
      insertError = fallback.error;
    }

    if (insertError) {
      return oauthRedirectError(redirect_uri, 'server_error', 'Failed to generate authorization code', state);
    }

    return json({ success: true, code, state, iss: getIssuer(req) }, { status: 200 });
  } catch (error) {
    console.error('oauth_authorize error:', error);
    return json({ error: 'server_error' }, { status: 500 });
  }
}
async function handleOAuthToken(req: Request, bodyData: any, url: URL) {
  try {
    
    

    bodyData = bodyData || {};
    if (Buffer.isBuffer(bodyData)) bodyData = bodyData.toString('utf8');
    if (typeof bodyData === 'string') {
      try { bodyData = JSON.parse(bodyData); }
      catch (e) { bodyData = Object.fromEntries(new URLSearchParams(bodyData)); }
    }

    const basic = getBasicClientCredentials(req);
    let client_id = (bodyData as any).client_id || url.searchParams.get('client_id') || basic.client_id;
    let client_secret = (bodyData as any).client_secret || url.searchParams.get('client_secret') || basic.client_secret;
    const code = (bodyData as any).code || url.searchParams.get('code');
    const redirect_uri = (bodyData as any).redirect_uri || url.searchParams.get('redirect_uri');
    const grant_type = (bodyData as any).grant_type || url.searchParams.get('grant_type');
    const refresh_token = (bodyData as any).refresh_token || url.searchParams.get('refresh_token');
    const code_verifier = (bodyData as any).code_verifier || url.searchParams.get('code_verifier');

    const resource = (bodyData as any).resource || url.searchParams.get('resource');

    if (!client_id) return oauthError(400, 'invalid_request', 'client_id is required');

    const { data: app, error: appError } = await supabaseAdmin
      .from('oauth_apps')
      .select('*')
      .eq('client_id', client_id)
      .maybeSingle();

    const isDynamicClient = appError || !app;
    const authMethod = app?.token_endpoint_auth_method || (client_secret ? 'client_secret_post' : 'none');

    const isPkceTokenRequest = grant_type === 'authorization_code' && Boolean(code_verifier);
    if (!isPkceTokenRequest && !isDynamicClient && authMethod !== 'none' && app.client_secret && app.client_secret !== client_secret) {
      
      return oauthError(401, 'invalid_client', 'Invalid client credentials');
    }

    let tokenToReturn = null;
    let userIdToFetch = null;
    let finalScope = 'admin';
    let finalNonce = null;
    let finalAuthTime = null;

    if (grant_type === 'authorization_code') {
      if (!code) return oauthError(400, 'invalid_request', 'code is required');

      const { data: codeRecord, error: codeError } = await supabaseAdmin
        .from('oauth_codes')
        .delete()
        .eq('code', code)
        .eq('client_id', client_id)
        .gt('expires_at', new Date().toISOString())
        .select()
        .maybeSingle();

      if (codeError || !codeRecord) return oauthError(400, 'invalid_grant', 'Invalid or expired authorization code');
      if (redirect_uri && codeRecord.redirect_uri !== redirect_uri) return oauthError(400, 'invalid_grant', 'Redirect URI mismatch');

      let expectedChallenge = codeRecord.code_challenge || null;
      let challengeMethod = codeRecord.code_challenge_method || null;

      // Backward compatibility for pre-compliance PKCE codes that embedded challenge metadata.
      if (!expectedChallenge && code.startsWith('pkce_')) {
        try {
          const pkceData = JSON.parse(Buffer.from(code.substring(5), 'base64url').toString('utf8'));
          expectedChallenge = pkceData.c;
          challengeMethod = pkceData.m;
        } catch (e) {
          return oauthError(400, 'invalid_grant', 'Invalid authorization code format');
        }
      }

      if (expectedChallenge) {
        if (!code_verifier) return oauthError(400, 'invalid_request', 'code_verifier is required');
        if (challengeMethod !== 'S256') return oauthError(400, 'invalid_grant', 'Only S256 PKCE is supported');
        const calculatedChallenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
        if (calculatedChallenge !== expectedChallenge) return oauthError(400, 'invalid_grant', 'Invalid code_verifier');
      } else if (isDynamicClient || authMethod === 'none' || app?.enforce_pkce) {
        if (!isPkceTokenRequest) {
          return oauthError(400, 'invalid_grant', 'PKCE is required for this client');
        }
      }

      tokenToReturn = codeRecord.token;
      userIdToFetch = codeRecord.user_id;
      finalScope = normalizeScope(codeRecord.scope || app?.scope || 'admin');
      finalNonce = codeRecord.nonce || null;
      finalAuthTime = codeRecord.auth_time || codeRecord.created_at || null;
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) return oauthError(400, 'invalid_request', 'refresh_token is required');

      const refreshHash = hashToken(refresh_token);
      const { data: storedRefresh } = await supabaseAdmin
        .from('oauth_refresh_tokens')
        .select('*')
        .eq('token_hash', refreshHash)
        .maybeSingle();

      if (storedRefresh) {
        if (storedRefresh.revoked_at || new Date(storedRefresh.expires_at) < new Date()) {
          return oauthError(400, 'invalid_grant', 'Refresh token is invalid or expired');
        }
        userIdToFetch = storedRefresh.user_id;
        finalScope = normalizeScope(storedRefresh.scope || app?.scope || 'admin');
      } else {
        const decoded = await verifyToken(refresh_token);
        if (!decoded || await isTokenRevoked(refresh_token)) {
          return oauthError(400, 'invalid_grant', 'Refresh token is invalid or expired');
        }
        userIdToFetch = decoded.id || decoded.sub;
        finalScope = normalizeScope(decoded.scope || app?.scope || 'admin');
      }
    } else {
      return oauthError(400, 'unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, has_admin_privileges, is_plus_user, is_lite_user, profile_picture')
      .eq('id', userIdToFetch)
      .single();

    if (userError || !user) return oauthError(400, 'invalid_grant', 'User not found');

    tokenToReturn = generateToken(user, {
      issuer: getIssuer(req),
      audience: resource || client_id,
      clientId: client_id,
      scope: finalScope,
      tokenUse: 'access'
    });

    const newRefreshToken = generateOpaqueToken(48);
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let refreshTokenToReturn = newRefreshToken;

    const refreshInsert = await supabaseAdmin
      .from('oauth_refresh_tokens')
      .insert({
        token_hash: hashToken(newRefreshToken),
        user_id: user.id,
        client_id,
        scope: finalScope,
        expires_at: refreshExpiresAt
      });

    if (refreshInsert.error) {
      refreshTokenToReturn = tokenToReturn;
    } else if (grant_type === 'refresh_token' && refresh_token) {
      await supabaseAdmin
        .from('oauth_refresh_tokens')
        .update({ revoked_at: new Date().toISOString(), replaced_by_hash: hashToken(newRefreshToken) })
        .eq('token_hash', hashToken(refresh_token));
    }

    const responsePayload = {
      access_token: tokenToReturn,
      token_type: 'Bearer',
      expires_in: 86400,
      refresh_token: refreshTokenToReturn,
      scope: finalScope,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        hasAdminPrivileges: user.has_admin_privileges,
        isPlusUser: user.is_plus_user,
        isLiteUser: user.is_lite_user,
        profilePicture: user.profile_picture
      }
    };

    if (hasScope(finalScope, 'openid')) {
      (responsePayload as any).id_token = generateIdToken(user, {
        issuer: getIssuer(req),
        clientId: client_id,
        nonce: finalNonce,
        authTime: finalAuthTime,
        accessToken: tokenToReturn,
        code: grant_type === 'authorization_code' ? code : undefined
      });
    }

    return json(responsePayload, { status: 200 });
  } catch (error) {
    console.error('oauth_token error:', error);
    return json({ error: 'server_error' }, { status: 500 });
  }
}
async function handleFetchUrlTitle(req: Request, bodyData: any, url: URL) {
  try {
    const urlStr = url.searchParams.get('url');
    if (!urlStr) {
      return json({ error: 'URL is required' }, { status: 400 });
    }

    // Basic URL validation
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch (e) {
      return json({ error: 'Invalid URL' }, { status: 400 });
    }

    // SSRF prevention: do not fetch local/private IP addresses or loopbacks
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.')
    ) {
      let host = hostname;
      const dotIdx = host.indexOf('.');
      const derived = dotIdx > 0 ? host.substring(0, dotIdx) : host;
      return json({ title: derived.charAt(0, { status: 200 }).toUpperCase() + derived.slice(1), icon: '' });
    }

    // Fetch site title with a 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to fetch site');
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : '';

    if (title) {
      // Decode HTML entities
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    }

    if (!title) {
      // Fallback: derive friendly title from domain name
      let host = parsedUrl.hostname;
      if (host.startsWith('www.')) host = host.substring(4);
      const dotIdx = host.indexOf('.');
      const derived = dotIdx > 0 ? host.substring(0, dotIdx) : host;
      title = derived.charAt(0).toUpperCase() + derived.slice(1);
    }

    // Search for custom icon link in the fetched HTML
    let iconUrl = '';
    const linkMatches = html.match(/<link[^>]+>/gi) || [];
    for (const linkTag of linkMatches) {
      const relMatch = linkTag.match(/rel\s*=\s*["']([^"']*icon[^"']*)["']/i);
      if (relMatch) {
        const hrefMatch = linkTag.match(/href\s*=\s*["']([^"']+)["']/i);
        if (hrefMatch) {
          const href = hrefMatch[1];
          try {
            iconUrl = new URL(href, urlStr).href;
            break; // take the first icon link found
          } catch (e) {
            // Ignore resolve error
          }
        }
      }
    }

    return json({ title, icon: iconUrl }, { status: 200 });
  } catch (error) {
    // Graceful fallback to capitalized hostname on error/timeout
    try {
      const parsedUrl = new URL(url.searchParams.get('url'));
      let host = parsedUrl.hostname;
      if (host.startsWith('www.')) host = host.substring(4);
      const dotIdx = host.indexOf('.');
      const derived = dotIdx > 0 ? host.substring(0, dotIdx) : host;
      const fallbackTitle = derived.charAt(0).toUpperCase() + derived.slice(1);
      return json({ title: fallbackTitle, icon: '' }, { status: 200 });
    } catch (e) {
      return json({ title: 'External Application', icon: '' }, { status: 200 });
    }
  }
}
