import { error } from '@sveltejs/kit';
import { getPostsCollection } from '$lib/server/insightroom-posts';
import { getExodusPostById, type ExodusDocType } from '$lib/server/exodus-content';
import { getInsightroomDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const { id } = params;
  const reqScope = url.searchParams.get('scope') || (id.startsWith('exodus:') ? 'exodus' : 'room');
  const reqDocType = (url.searchParams.get('docType') as ExodusDocType) || 'doc';

  if (id === 'new') {
    return {
      post: null,
      versions: [],
      scope: reqScope,
      docType: reqDocType
    };
  }

  // Check if it's an Exodus post
  if (id.startsWith('exodus:') || reqScope === 'exodus') {
    const post = await getExodusPostById(id, true);
    if (!post) {
      throw error(404, 'Exodus document not found');
    }
    return {
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        content: post.content || '',
        scope: 'exodus',
        docType: post.docType,
        filename: post.filename,
        filePath: post.filePath,
        url: post.url,
        metadata: {
          ...post.metadata,
          category: post.category,
          date: post.date,
          excerpt: post.excerpt,
          image: post.image,
          visibility: post.visibility,
          draft: post.draft,
          hidden: post.hidden
        },
        hidden: post.hidden,
        draft: post.draft,
        visibility: post.visibility || 'public'
      },
      versions: [],
      scope: 'exodus',
      docType: post.docType
    };
  }

  // Room post in MongoDB
  const collection = await getPostsCollection();
  let row;
  try {
    row = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    throw error(400, 'Invalid Post ID');
  }

  if (!row) throw error(404, 'Post not found');

  const db = await getInsightroomDb();
  const versionsCollection = db.collection('post_versions');
  let versions: any[] = [];
  try {
    const rawVersions = await versionsCollection
      .find({ post_id: row._id })
      .sort({ version_saved_at: -1 })
      .limit(10)
      .toArray();

    versions = rawVersions.map((v) => ({
      _id: v._id.toString(),
      title: v.title,
      content: v.content,
      metadata: v.metadata || {},
      updated_at: v.updated_at,
      version_saved_at: v.version_saved_at,
      saved_by_name: v.saved_by_name,
      saved_by_display_name: v.saved_by_display_name,
      saved_by_avatar: v.saved_by_avatar
    }));
  } catch (err) {
    console.warn('[Editor Load] Failed to fetch versions:', err);
  }

  const metadata = row.metadata || {};

  return {
    post: {
      id: row._id.toString(),
      title: row.title || '',
      slug: row.slug || '',
      content: row.content || '',
      scope: 'room',
      metadata,
      hidden: Boolean(row.hidden),
      draft: Boolean(row.draft),
      category: row.category || '',
      date: row.date || '',
      excerpt: row.excerpt || '',
      image: row.image || '',
      visibility: row.visibility || 'public',
      claps: row.claps || 0
    },
    versions,
    scope: 'room',
    docType: 'doc' as ExodusDocType
  };
};
