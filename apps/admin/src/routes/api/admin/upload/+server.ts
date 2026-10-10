import { json, type RequestHandler } from '@sveltejs/kit';
import { validateToken, getCookieToken } from '$lib/server/insightroom-auth';
import { resolveUploadInput, uploadBufferToCloudinary } from '$lib/server/insightroom-upload';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const POST: RequestHandler = async ({ request, cookies, fetch }) => {
  let token = getCookieToken(cookies);
  const authHeader = request.headers.get('Authorization');
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token) return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const { user, accessTier } = await validateToken(token, fetch);
  if (!user || accessTier !== 'super') {
    return json({ error: 'Unauthorized: Admin privileges required' }, { status: 403, headers: corsHeaders });
  }

  let buffer: Buffer;
  let fileType = 'image/png';
  let originalName = 'upload.png';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    try {
      const resolved = await resolveUploadInput(body, fetch);
      buffer = resolved.buffer;
      fileType = resolved.fileType;
      originalName = resolved.originalName;
    } catch (err: any) {
      return json({ error: err.message }, { status: 400, headers: corsHeaders });
    }
  } else {
    const data = await request.formData();
    const file = data.get('file');

    if (!file || !(file instanceof File)) {
      return json({ error: 'No file uploaded' }, { status: 400, headers: corsHeaders });
    }
    originalName = file.name;
    fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  try {
    const uploadedUrl = await uploadBufferToCloudinary(buffer, originalName);
    return json({
      success: true,
      url: uploadedUrl,
      fileName: originalName,
      fileType
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('[Admin Upload Error]:', err);
    return json({ error: err.message || 'Image upload failed' }, { status: 500, headers: corsHeaders });
  }
};
