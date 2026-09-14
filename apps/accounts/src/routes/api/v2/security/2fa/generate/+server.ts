import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken, generateBase32Secret } from '$lib/server/utils';

export async function POST({ request }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid token' }, { status: 401 });

    const secret = generateBase32Secret();
    const userIdentifier = decoded.email || decoded.username || 'User';
    const otpauthUrl = `otpauth://totp/Materio:${userIdentifier}?secret=${secret}&issuer=Materio&algorithm=SHA1&digits=6&period=30`;

    // Save secret to user, but don't enable it yet
    const { error } = await supabaseAdmin
      .from('users')
      .update({ two_factor_secret: secret })
      .eq('id', decoded.id);

    if (error) {
      console.error('Failed to save 2FA secret:', error);
      return json({ error: 'Database error' }, { status: 500 });
    }

    return json({ secret, otpauthUrl });
  } catch (err: any) {
    console.error('Error generating 2FA:', err);
    return json({ error: 'Internal server error', details: err.message, stack: err.stack }, { status: 500 });
  }
}
