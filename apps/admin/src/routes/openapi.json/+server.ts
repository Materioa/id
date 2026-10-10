import { json, type RequestHandler } from '@sveltejs/kit';
import openapi from '$lib/openapi.json';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=3600'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const GET: RequestHandler = async () => {
  return json(openapi, { headers: corsHeaders });
};
