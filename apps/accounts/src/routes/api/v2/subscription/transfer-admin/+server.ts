import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { sendAlertEmail } from '$lib/server/mailer';

export async function POST({ request }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    // Verify current user is a super user (has_admin_privileges)
    const { data: currentUser, error: currentErr } = await supabaseAdmin
      .from('users')
      .select('id, username, email, has_admin_privileges, is_plus_user, is_lite_user')
      .eq('id', (decoded as any).id)
      .single();

    if (currentErr || !currentUser) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    if (!currentUser.has_admin_privileges) {
      return json({ error: 'Only super users can transfer admin privileges' }, { status: 403 });
    }

    const body = await request.json() as any;
    const successorUsername = (body.successorUsername || '').trim();

    if (!successorUsername) {
      return json({ error: 'Successor username is required' }, { status: 400 });
    }

    if (successorUsername.toLowerCase() === currentUser.username?.toLowerCase()) {
      return json({ error: 'You cannot transfer admin privileges to yourself' }, { status: 400 });
    }

    // Find the successor
    const { data: successor, error: successorErr } = await supabaseAdmin
      .from('users')
      .select('id, username, email, has_admin_privileges')
      .eq('username', successorUsername)
      .single();

    if (successorErr || !successor) {
      return json({ error: `User "${successorUsername}" not found` }, { status: 404 });
    }

    if (successor.has_admin_privileges) {
      return json({ error: `${successorUsername} already has admin privileges` }, { status: 409 });
    }

    // Transfer: Grant admin to successor
    const { error: grantErr } = await supabaseAdmin
      .from('users')
      .update({ has_admin_privileges: true })
      .eq('id', successor.id);

    if (grantErr) {
      return json({ error: 'Failed to grant admin privileges to successor' }, { status: 500 });
    }

    // Revoke current user's admin + subscription
    const { error: revokeErr } = await supabaseAdmin
      .from('users')
      .update({
        has_admin_privileges: false,
        is_plus_user: false,
        is_lite_user: false,
        lite_expiry: null
      })
      .eq('id', currentUser.id);

    if (revokeErr) {
      // Attempt to rollback successor grant
      await supabaseAdmin
        .from('users')
        .update({ has_admin_privileges: false })
        .eq('id', successor.id);

      return json({ error: 'Failed to revoke your privileges. Transfer rolled back.' }, { status: 500 });
    }

    // Send notification email to successor
    if (successor.email) {
      const LOGO_URL = 'https://materioa.vercel.app/assets/img/materio.png';
      const formattedDate = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) + ' IST';

      await sendAlertEmail({
        to: successor.email,
        subject: '🎉 You\'ve been promoted to Super Admin — Materio',
        text: `Hi ${successor.username},\n\n${currentUser.username} has transferred Super Admin privileges to you on Materio.\n\nYou now have full admin access to the platform.\n\nDate: ${formattedDate}\n\n— Materio Team`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"><style>body { margin: 0; padding: 20px; background: #ffffff; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }</style></head>
<body>
  <div style="max-width:600px;margin:24px auto;">
    <div style="margin-bottom:24px;"><img src="${LOGO_URL}" alt="materio." width="180" height="38" style="display:block;" /></div>
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:24px;">
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:rgba(34,197,94,0.1);padding:16px 20px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.4;color:#1f2937;">🎉 You've been promoted!</h2>
          <div style="font-size:13px;"><span style="color:#16a34a;font-weight:600;">Super Admin Promotion</span><span style="color:#6b7280;margin-left:12px;">${formattedDate}</span></div>
        </div>
        <div style="padding:16px 20px;font-size:14px;line-height:1.8;color:#1f2937;background:#fff;">
          <p style="margin:0 0 12px;">Hi <strong>${successor.username}</strong>,</p>
          <p style="margin:0 0 12px;"><strong>${currentUser.username}</strong> has transferred Super Admin privileges to you on Materio.</p>
          <p style="margin:0;">You now have full admin access to the platform, including user management, content moderation, and system settings.</p>
        </div>
      </div>
      <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:16px;">This is an automated notification from Materio.</div>
    </div>
  </div>
</body>
</html>`
      });
    }

    return json({
      success: true,
      message: `Admin privileges transferred to ${successor.username}. Your subscription has been cancelled.`
    });
  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
