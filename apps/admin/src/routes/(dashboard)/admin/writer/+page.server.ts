import { getAllPosts } from '$lib/server/insightroom-posts';
import { getAllExodusPosts } from '$lib/server/exodus-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  try {
    const [roomPosts, exodusPosts] = await Promise.all([
      getAllPosts({ content: false }),
      getAllExodusPosts({ content: false })
    ]);

    return {
      posts: roomPosts,
      exodusPosts
    };
  } catch (error: any) {
    console.error('[Writer Load Error]:', error);
    return {
      posts: [],
      exodusPosts: []
    };
  }
};

