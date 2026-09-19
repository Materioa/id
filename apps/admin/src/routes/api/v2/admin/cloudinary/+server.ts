import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import fs from 'node:fs';
import path from 'node:path';

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

// Dynamically read .env files for local dev server in case dev server was started before .env changed
function readEnvFileFallback(key: string): string {
  try {
    if (typeof process !== 'undefined' && process.cwd) {
      const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'apps/admin/.env'),
        path.resolve(process.cwd(), '../admin/.env'),
        path.resolve(process.cwd(), '../../apps/admin/.env'),
        path.resolve(process.cwd(), '../../.env')
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const fileData = fs.readFileSync(filePath, 'utf-8');
          const match = fileData.match(new RegExp(`^${key}=(.*)$`, 'm'));
          if (match && match[1]) {
            return match[1].trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  } catch {
    // Non-filesystem runtime (e.g. Cloudflare Workers in production)
  }
  return '';
}

function getEnvVar(event: RequestEvent, key: string): string {
  // 1. Cloudflare Workers platform bindings (production deployment)
  const cfEnv = event.platform?.env as Record<string, any> | undefined;
  if (cfEnv && cfEnv[key]) {
    return String(cfEnv[key]);
  }

  // 2. SvelteKit dynamic private env
  const kitVal = (env as Record<string, any>)?.[key];
  if (kitVal) {
    return String(kitVal);
  }

  // 3. process.env (Node / Bun dev server)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return String(process.env[key]);
  }

  // 4. File-based fallback for long-running dev instances
  const fileVal = readEnvFileFallback(key);
  if (fileVal) {
    return fileVal;
  }

  return '';
}

function resolveCloudinaryConfig(event: RequestEvent) {
  let cloudName = getEnvVar(event, 'CLOUDINARY_CLOUD_NAME');
  let apiKey = getEnvVar(event, 'CLOUDINARY_API_KEY');
  let apiSecret = getEnvVar(event, 'CLOUDINARY_API_SECRET');
  const cloudinaryUrl = getEnvVar(event, 'CLOUDINARY_URL');

  if ((!cloudName || !apiKey || !apiSecret) && cloudinaryUrl) {
    const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (match) {
      if (!apiKey) apiKey = match[1];
      if (!apiSecret) apiSecret = match[2];
      if (!cloudName) cloudName = match[3];
    }
  }

  if (!cloudName) cloudName = 'dvsdsl7iw';

  return { cloudName, apiKey, apiSecret };
}

async function sha1Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(event: RequestEvent) {
  const { request } = event;
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'insightroom';

    if (!file) {
      return json({ error: 'No file provided' }, { status: 400 });
    }

    const { cloudName, apiKey, apiSecret } = resolveCloudinaryConfig(event);

    if (!apiKey || !apiSecret) {
      console.error('Cloudinary credentials missing:', { cloudName, hasApiKey: !!apiKey, hasApiSecret: !!apiSecret });
      return json({
        error: 'Cloudinary credentials (CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or not configured.'
      }, { status: 500 });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1Hex(paramsToSign);

    const cData = new FormData();
    cData.append('file', file);
    cData.append('api_key', apiKey);
    cData.append('timestamp', String(timestamp));
    cData.append('signature', signature);
    cData.append('folder', folder);

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: cData
    });

    const resJson = (await cRes.json()) as any;
    if (!cRes.ok || resJson.error) {
      console.error('Cloudinary upload error:', resJson.error);
      return json({ error: resJson.error?.message || 'Cloudinary upload failed' }, { status: cRes.status >= 400 ? cRes.status : 400 });
    }

    return json({
      success: true,
      url: resJson.secure_url,
      format: resJson.format,
      resource_type: resJson.resource_type,
      public_id: resJson.public_id
    });

  } catch (error: any) {
    console.error('Cloudinary API route error:', error);
    return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
