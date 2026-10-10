import { json, type RequestHandler } from '@sveltejs/kit';
import { getAnalyticsCollection } from '$lib/server/insightroom-analytics';
import { isBot } from '$lib/server/insightroom-botDetect';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  try {
    if (isBot(request)) {
      return json({ success: true, message: 'Ignored bot request' }, { headers: corsHeaders });
    }

    const payload = (await request.json()) as any;
    const {
      postId,
      slug,
      title,
      sessionId,
      duration,
      scrollDepth,
      lastLeftOff,
      claps,
      clicks,
      settingsChanges
    } = payload;

    if (!postId || !sessionId) {
      return json({ error: 'postId and sessionId are required' }, { status: 400, headers: corsHeaders });
    }

    let ip = '127.0.0.1';
    try {
      ip = getClientAddress();
    } catch {
      ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    }

    const country =
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-vercel-ip-country') ||
      'Unknown';
    const region = request.headers.get('x-vercel-ip-country-region') || 'Unknown';
    const city = request.headers.get('x-vercel-ip-city') || 'Unknown';

    const collection = await getAnalyticsCollection();

    const result = await collection.findOneAndUpdate(
      { postId, sessionId },
      {
        $set: {
          slug: slug || '',
          title: title || '',
          ip,
          country,
          region,
          city,
          duration: Math.round(Number(duration || 0)),
          scrollDepth: Math.min(100, Math.max(0, Math.round(Number(scrollDepth || 0)))),
          lastLeftOff: lastLeftOff || '',
          claps: Math.round(Number(claps || 0)),
          clicks: clicks || [],
          settingsChanges: settingsChanges || [],
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return json({ success: true, sessionId: result?.sessionId || sessionId }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Analytics Tracking Error]:', error);
    return json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
};
