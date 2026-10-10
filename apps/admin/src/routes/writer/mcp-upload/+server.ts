import { redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  const target = new URL('/admin/writer/mcp-upload', url.origin);
  for (const [key, val] of url.searchParams) {
    target.searchParams.append(key, val);
  }
  throw redirect(307, target.pathname + target.search);
};
