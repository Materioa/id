import { error } from '@sveltejs/kit';
import { getPostsCollection, getAllPosts } from '$lib/server/insightroom-posts';
import { getExodusPostById, getAllExodusPosts } from '$lib/server/exodus-content';
import { ObjectId } from 'mongodb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const id = url.searchParams.get('id');

  if (!id) {
    // If no ID is provided, return recent posts for selection
    const [recentRoom, recentExodus] = await Promise.all([
      getAllPosts({ content: false }),
      getAllExodusPosts({ content: false })
    ]);

    return {
      post: null,
      recentPosts: [
        ...recentRoom.slice(0, 10).map((p) => ({ id: p.id, title: p.title || p.slug, scope: 'room' })),
        ...recentExodus.slice(0, 10).map((p) => ({ id: p.id, title: p.title || p.filename, scope: 'exodus' }))
      ]
    };
  }

  // Handle Exodus ID
  if (id.startsWith('exodus:')) {
    const exodusPost = getExodusPostById(id, true);
    if (!exodusPost) throw error(404, 'Exodus document not found');
    return {
      post: {
        id: exodusPost.id,
        title: exodusPost.title || exodusPost.filename,
        slug: exodusPost.slug,
        content: exodusPost.content || '',
        metadata: exodusPost.metadata || {},
        scope: 'exodus'
      },
      recentPosts: []
    };
  }

  // Handle MongoDB Room post ID
  const collection = await getPostsCollection();
  let row;
  try {
    row = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    throw error(400, 'Invalid Post ID');
  }

  if (!row) throw error(404, 'Post not found');

  return {
    post: {
      id: row._id.toString(),
      title: row.title || '',
      slug: row.slug || '',
      content: row.content || '',
      metadata: row.metadata || {},
      scope: 'room'
    },
    recentPosts: []
  };
};
