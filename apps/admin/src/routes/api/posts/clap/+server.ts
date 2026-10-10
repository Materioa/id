import { json, type RequestHandler } from '@sveltejs/kit';
import { getPostsCollection } from '$lib/server/insightroom-posts';
import { ObjectId } from 'mongodb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = (await request.json()) as any;
    const { postId } = data;

    if (!postId) {
      return json({ error: 'Post ID is required' }, { status: 400, headers: corsHeaders });
    }

    const collection = await getPostsCollection();

    let result = null;
    try {
      result = await collection.findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $inc: { claps: 1 } },
        { returnDocument: 'after' }
      );
    } catch {
      result = await collection.findOneAndUpdate(
        { slug: postId },
        { $inc: { claps: 1 } },
        { returnDocument: 'after' }
      );
    }

    if (!result) {
      return json({ error: 'Post not found' }, { status: 404, headers: corsHeaders });
    }

    return json({ success: true, claps: result.claps }, { headers: corsHeaders });
  } catch (error) {
    console.error('Failed to clap for post:', error);
    return json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
};
