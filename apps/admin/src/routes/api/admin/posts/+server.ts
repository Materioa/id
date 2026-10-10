import { json, type RequestHandler } from '@sveltejs/kit';
import { getPostsCollection, slugify, getAllPosts, getPostById } from '$lib/server/insightroom-posts';
import { getAllExodusPosts, getExodusPostById, saveExodusPost, deleteExodusPost } from '$lib/server/exodus-content';
import { getInsightroomDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';
import { validateToken, getCookieToken } from '$lib/server/insightroom-auth';
import { resolveAttribution } from '$lib/server/insightroom-attribution';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const GET: RequestHandler = async ({ url, cookies, request, fetch }) => {
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

  const id = url.searchParams.get('id');
  const scope = url.searchParams.get('scope') || (id?.startsWith('exodus:') ? 'exodus' : 'room');
  const docType = url.searchParams.get('docType') as any;

  if (id) {
    if (id.startsWith('exodus:')) {
      const post = getExodusPostById(id, true);
      if (!post) return json({ error: 'Exodus post not found' }, { status: 404, headers: corsHeaders });
      return json({ post }, { headers: corsHeaders });
    }
    const post = await getPostById(id);
    if (!post) return json({ error: 'Post not found' }, { status: 404, headers: corsHeaders });
    return json({ post }, { headers: corsHeaders });
  }

  if (scope === 'exodus') {
    const posts = await getAllExodusPosts({ type: docType || 'all', content: false });
    return json({ posts }, { headers: corsHeaders });
  }

  const posts = await getAllPosts({ content: false });
  return json({ posts }, { headers: corsHeaders });
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

  try {
    const body = (await request.json()) as any;
    let { id, title, slug, content, metadata, saved_by_name, saved_by_display_name, saved_by_avatar, scope = 'room', docType = 'doc' } = body;

    if (!title) return json({ error: 'Title is required' }, { status: 400, headers: corsHeaders });
    if (!slug) slug = slugify(title);

    metadata = metadata || {};
    const attribution = resolveAttribution(
      {
        saved_by_name: saved_by_name || user.displayName || user.username,
        saved_by_display_name: saved_by_display_name || user.displayName,
        saved_by_avatar: saved_by_avatar || user.profilePicture,
        author_name: metadata.author_name,
        author_avatar: metadata.author_avatar
      },
      request.headers
    );

    // If target scope is Exodus (getmaterio.app - changelog, docs, legal)
    if (scope === 'exodus' || id?.startsWith('exodus:')) {
      const result = await saveExodusPost({
        id,
        docType: docType || metadata.docType || (metadata.category === 'legal' ? 'legal' : metadata.category === 'whats-new' ? 'changelog' : 'doc'),
        title,
        slug,
        content,
        metadata,
        savedByName: attribution.displayName || attribution.name,
        savedByAvatar: attribution.avatar
      });
      return json({ success: true, id: result.id, scope: 'exodus', filePath: result.filePath }, { headers: corsHeaders });
    }

    // Default Scope: Room (room.getmaterio.app - MongoDB)
    const draft = Boolean(metadata.draft);
    const category = draft ? 'draft' : (metadata.category || '').trim();
    const categorySlug = draft ? 'draft' : slugify(category);
    metadata.category = category;
    const date = metadata.date || new Date().toISOString().split('T')[0];
    const excerpt = metadata.excerpt || '';
    const image = metadata.image || '';
    const hidden = Boolean(metadata.hidden);
    const visibility = metadata.visibility || 'public';

    const collection = await getPostsCollection();
    const db = await getInsightroomDb();
    const versionsCollection = db.collection('post_versions');

    if (id && id !== 'new') {
      const oldPost = await collection.findOne({ _id: new ObjectId(id) });
      if (oldPost) {
        await versionsCollection.insertOne({
          post_id: oldPost._id,
          title: oldPost.title,
          content: oldPost.content,
          metadata: oldPost.metadata,
          updated_at: oldPost.updated_at || oldPost.created_at || new Date(),
          saved_by_name: attribution.name,
          saved_by_display_name: attribution.displayName,
          saved_by_avatar: attribution.avatar,
          version_saved_at: new Date()
        });
      }

      await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            title,
            slug,
            content,
            metadata,
            category,
            categorySlug,
            date,
            excerpt,
            image,
            hidden,
            draft,
            visibility,
            updated_at: new Date()
          }
        }
      );
      return json({ success: true, id, scope: 'room' }, { headers: corsHeaders });
    } else {
      const result = await collection.insertOne({
        title,
        slug,
        content,
        metadata,
        category,
        categorySlug,
        date,
        excerpt,
        image,
        hidden,
        draft,
        visibility,
        created_at: new Date(),
        updated_at: new Date()
      });
      return json({ success: true, id: result.insertedId.toString(), scope: 'room' }, { headers: corsHeaders });
    }
  } catch (err: any) {
    console.error('[Admin Posts API Error]:', err);
    return json({ error: err.message || 'Failed to save post' }, { status: 500, headers: corsHeaders });
  }
};

export const DELETE: RequestHandler = async ({ request, cookies, url, fetch }) => {
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

  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Post ID is required' }, { status: 400, headers: corsHeaders });

    if (id.startsWith('exodus:')) {
      await deleteExodusPost(id);
      return json({ success: true, message: 'Exodus post deleted successfully' }, { headers: corsHeaders });
    }

    const collection = await getPostsCollection();
    const db = await getInsightroomDb();
    const versionsCollection = db.collection('post_versions');

    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return json({ error: 'Post not found' }, { status: 404, headers: corsHeaders });
    }

    await versionsCollection.deleteMany({ post_id: new ObjectId(id) });
    return json({ success: true, message: 'Post deleted successfully' }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('[Admin Posts Delete Error]:', err);
    return json({ error: err.message || 'Failed to delete post' }, { status: 500, headers: corsHeaders });
  }
};
