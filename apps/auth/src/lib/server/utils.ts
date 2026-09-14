import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import crypto from 'node:crypto';

const SUPABASE_URL = env.SUPABASE_URL || publicEnv.PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || publicEnv.PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ADMIN_KEY || '';
const JWT_SECRET = env.JWT_SECRET || 'secret';
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || '24h';

// Initialize Supabase clients
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Hash password function
export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare password with hashed password
export const comparePassword = async (password: string, hashedPassword: string) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT access token
export const generateToken = (user: any, options: any = {}) => {
  const subject = String(user.id || user.sub || '');
  const payload: any = {
    id: subject,
    sub: subject,
    email: user.email,
    username: user.username,
    jti: options.jti || uuidv4(),
    token_use: options.tokenUse || 'access'
  };

  if (options.issuer) payload.iss = options.issuer;
  if (options.audience) payload.aud = options.audience;
  if (options.clientId) payload.client_id = options.clientId;
  if (options.scope) payload.scope = options.scope;

  return jwt.sign(payload, JWT_SECRET, { expiresIn: options.expiresIn || JWT_EXPIRES_IN });
};

const getOidcSigningKey = () => {
  if (env.OIDC_PRIVATE_KEY_B64) return Buffer.from(env.OIDC_PRIVATE_KEY_B64, 'base64').toString('utf8');
  if (env.OIDC_PRIVATE_KEY) return env.OIDC_PRIVATE_KEY.replace(/\\n/g, '\n');
  return JWT_SECRET;
};

const getOidcSigningAlg = () => {
  return env.OIDC_PRIVATE_KEY || env.OIDC_PRIVATE_KEY_B64 ? 'RS256' : 'HS256';
};

export const getOidcHash = (value: string, alg: string = 'RS256') => {
  let hashAlg = 'sha256';
  if (alg === 'RS384' || alg === 'HS384') hashAlg = 'sha384';
  if (alg === 'RS512' || alg === 'HS512') hashAlg = 'sha512';
  const hash = crypto.createHash(hashAlg).update(value).digest();
  const leftHalf = hash.subarray(0, hash.length / 2);
  return leftHalf.toString('base64url');
};

export const generateIdToken = (user: any, options: any = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const authTime = options.authTime ? Math.floor(new Date(options.authTime).getTime() / 1000) : now;
  const subject = String(user.id || user.sub || '');
  const alg = getOidcSigningAlg();
  
  const payload: any = {
    iss: options.issuer,
    sub: subject,
    aud: options.clientId,
    exp: now + (options.expiresInSeconds || 3600),
    iat: now,
    auth_time: authTime,
    email: user.email,
    email_verified: Boolean(user.email_verified || user.emailVerified || user.email),
    preferred_username: user.username,
    name: user.display_name || user.displayName || user.username,
    picture: user.profile_picture || user.profilePicture || undefined
  };

  if (options.nonce) payload.nonce = options.nonce;
  if (options.accessToken) payload.at_hash = getOidcHash(options.accessToken, alg);
  if (options.code) payload.c_hash = getOidcHash(options.code, alg);

  const signOptions = { algorithm: alg as jwt.Algorithm, keyid: env.OIDC_KEY_ID || 'materio-default' };
  return jwt.sign(payload, getOidcSigningKey(), signOptions);
};

const getOidcPublicKey = () => {
  if (env.OIDC_PUBLIC_KEY_B64) return Buffer.from(env.OIDC_PUBLIC_KEY_B64, 'base64').toString('utf8');
  if (env.OIDC_PUBLIC_KEY) return env.OIDC_PUBLIC_KEY.replace(/\\n/g, '\n');
  return null;
};

export const getJwks = () => {
  if (env.OIDC_JWKS) {
    try {
      const jwks = JSON.parse(env.OIDC_JWKS);
      if (jwks && Array.isArray(jwks.keys)) return jwks;
    } catch (e: any) {
      console.error('Invalid OIDC_JWKS JSON:', e.message);
    }
  }

  const publicKey = getOidcPublicKey();
  if (publicKey) {
    try {
      const jwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' }) as any;
      jwk.use = 'sig';
      jwk.alg = getOidcSigningAlg();
      jwk.kid = env.OIDC_KEY_ID || 'materio-default';
      return { keys: [jwk] };
    } catch (e: any) {
      console.error('Invalid OIDC public key:', e.message);
    }
  }
  return { keys: [] };
};

export const generateOpaqueToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const hashToken = (token: string) => crypto.createHash('sha256').update(String(token)).digest('hex');

export const verifyToken = async (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if session exists in DB for proper revocation
    if (decoded.jti && decoded.token_use !== '2fa_temp') {
      const { data: session } = await supabaseAdmin
        .from('user_sessions')
        .select('id')
        .eq('id', decoded.jti)
        .single();
        
      if (!session) return null; // Session was revoked
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

// Generate unique recovery key
export const generateRecoveryKey = () => {
  return uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
};

export const generateHandoffCode = () => {
  return crypto.randomBytes(16).toString('hex');
};

export const storeHandoffCode = async (code: string, token: string, userId: string, userAgent?: string, ip?: string) => {
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60 seconds

  const { error } = await supabaseAdmin
    .from('handoff_codes')
    .insert({
      code,
      token,
      user_id: userId,
      user_agent: userAgent || null,
      ip_address: ip || null,
      expires_at: expiresAt,
      used: false
    });

  if (error) {
    console.error('Failed to store handoff code:', error);
    return false;
  }
  return true;
};

export const consumeHandoffCode = async (code: string, userAgent?: string, ip?: string) => {
  const { data: handoff, error: findError } = await supabaseAdmin
    .from('handoff_codes')
    .select('*')
    .eq('code', code)
    .eq('used', false)
    .single();

  if (findError || !handoff) {
    return { valid: false, error: 'Invalid or expired handoff code' };
  }

  if (new Date(handoff.expires_at) < new Date()) {
    await supabaseAdmin.from('handoff_codes').delete().eq('code', code);
    return { valid: false, error: 'Handoff code has expired' };
  }

  const { error: updateError } = await supabaseAdmin
    .from('handoff_codes')
    .delete()
    .eq('code', code);

  if (updateError) {
    console.error('Failed to consume handoff code:', updateError);
    return { valid: false, error: 'Failed to process handoff' };
  }

  return { valid: true, token: handoff.token, userId: handoff.user_id };
};

const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const generateBase32Secret = (byteLength = 20) => {
  const raw = crypto.randomBytes(byteLength);
  let secret = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < raw.length; i++) {
    value = (value << 8) | raw[i];
    bits += 8;
    while (bits >= 5) {
      secret += base32chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    secret += base32chars[(value << (5 - bits)) & 31];
  }
  return secret;
};

const decodeBase32 = (encoded: string) => {
  let bits = 0;
  let value = 0;
  const decoded = [];
  
  for (let i = 0; i < encoded.length; i++) {
    const val = base32chars.indexOf(encoded[i].toUpperCase());
    if (val === -1) continue;
    
    value = (value << 5) | val;
    bits += 5;
    
    if (bits >= 8) {
      decoded.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(decoded);
};

const generateTOTP = (secret: string, window = 0) => {
  const decodedSecret = decodeBase32(secret);
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(time / 0x100000000), 0);
  buffer.writeUInt32BE(time & 0xffffffff, 4);
  
  const hmac = crypto.createHmac('sha1', decodedSecret);
  hmac.update(buffer);
  const hmacResult = hmac.digest();
  
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code = (hmacResult.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  
  return code.toString().padStart(6, '0');
};

export const verifyTOTP = (token: string, secret: string) => {
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, i) === token) return true;
  }
  return false;
};
