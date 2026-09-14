import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { supabaseAdmin } from '$lib/server/utils';
import { sendOTPEmail } from '$lib/server/mailer';
import { getOTPTemplate } from '$lib/server/otp_template';

export async function POST({ request }: RequestEvent) {
  try {
    const body = await request.json().catch(() => ({})) as any;
    const email = body.email;

    if (!email) {
      return json({ error: 'Email is required' }, { status: 400 });
    }

    // 1. Verify user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (userError || !user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Set expiration (e.g., 10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // 4. Save to `otps` table
    const { error: insertError } = await supabaseAdmin
      .from('otps')
      .insert({
        email: user.email,
        otp: otp,
        type: 'login',
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Failed to insert OTP:', insertError);
      return json({ error: 'Failed to generate OTP' }, { status: 500 });
    }

    // 5. Send email via Nodemailer
    const html = getOTPTemplate(otp, 'login', user.email);
    const emailResult = await sendOTPEmail({
      to: user.email,
      otp,
      type: 'login',
      html
    });

    if (!emailResult.success) {
      if (emailResult.error === 'SMTP not configured') {
        console.log(`\n[DEV MODE - OTP GENERATED] Send this code to ${user.email}: ${otp}\n`);
        return json({ message: 'OTP sent successfully (Simulated in Console)' });
      }
      console.error('OTP Email Delivery Error:', emailResult.error);
      return json({ error: 'Failed to send verification email' }, { status: 500 });
    }

    return json({ message: 'OTP sent successfully' });

  } catch (err: any) {
    console.error('OTP send error:', err);
    return json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
