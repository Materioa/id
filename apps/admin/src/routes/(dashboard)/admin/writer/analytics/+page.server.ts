import { getGeneralAnalytics } from '$lib/server/insightroom-analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const days = Number(url.searchParams.get('days')) || 30;
  try {
    const data = await getGeneralAnalytics(days);
    return {
      days,
      analytics: data
    };
  } catch (err: any) {
    console.error('[General Analytics Error]:', err);
    return {
      days,
      analytics: {
        stats: {
          totalViews: 0,
          totalDuration: 0,
          avgScrollDepth: 0,
          retainedViews: 0,
          retentionRate: 0,
          totalClaps: 0
        },
        timeline: [],
        locations: [],
        topPosts: []
      }
    };
  }
};
