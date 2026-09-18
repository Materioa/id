import { redirect, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getFreshEnv } from '$lib/server/env';

export async function GET({ params, url }: RequestEvent) {
  const provider = params.provider.toLowerCase();
  const callback = url.searchParams.get('callback') || '';
  const origin = url.origin;

  // Build state with random nonce + encoded callback
  const stateData = JSON.stringify({
    nonce: Math.random().toString(36).substring(2),
    callback
  });
  const state = Buffer.from(stateData).toString('base64url');

  if (provider === 'google') {
    const clientId = getFreshEnv('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw redirect(302, `/login?error=${encodeURIComponent('Google OAuth is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env')}&provider=google`);
    }

    const redirectUri = `${origin}/api/v2/oauth/google/callback`;
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('hd', 'paruluniversity.ac.in');
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    throw redirect(302, googleAuthUrl.toString());
  }

  if (provider === 'github') {
    const clientId = getFreshEnv('GITHUB_CLIENT_ID');
    if (!clientId) {
      throw redirect(302, `/login?error=${encodeURIComponent('GitHub OAuth is not configured yet. Please add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env')}&provider=github`);
    }

    const redirectUri = `${origin}/api/v2/oauth/github/callback`;
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', 'read:user user:email');
    githubAuthUrl.searchParams.set('state', state);

    throw redirect(302, githubAuthUrl.toString());
  }

  return json({ error: 'Unsupported provider' }, { status: 400 });
}
