import { json, type RequestHandler } from '@sveltejs/kit';
import { getAllPosts } from '$lib/server/insightroom-posts';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const GET: RequestHandler = async ({ url }) => {
  const num = url.searchParams.get('num');
  const limit = num ? parseInt(num, 10) : null;
  const subject = url.searchParams.get('subject');
  const semester = url.searchParams.get('semester');

  const allPosts = await getAllPosts({ content: false });

  let filtered = allPosts.filter((post) => !post.hidden && !post.draft && post.visibility !== 'private');

  if (subject) {
    filtered = filtered.filter(
      (p) =>
        (p.metadata?.subject && String(p.metadata.subject).toLowerCase() === subject.toLowerCase()) ||
        (p.category && p.category.toLowerCase() === subject.toLowerCase())
    );
  }

  if (semester) {
    filtered = filtered.filter((p) => p.metadata?.semester && String(p.metadata.semester) === semester);
  }

  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return json(filtered, { headers: corsHeaders });
};
