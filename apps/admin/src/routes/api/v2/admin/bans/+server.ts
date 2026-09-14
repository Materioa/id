import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';

async function getAdminUser(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, email, has_admin_privileges')
    .eq('id', decoded.id)
    .single();
    
  if (user?.has_admin_privileges === true) {
    return user;
  }
  return null;
}

export async function GET({ request }) {
  const admin = await getAdminUser(request);
  if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const db = await getDb();
    const rules = await db.collection('abuse_moderation_rules')
      .find({})
      .sort({ createdAt: -1, created_at: -1 })
      .toArray();

    const mapped = rules.map(r => ({
      ...r,
      id: r._id.toString(),
      // Normalize fields for easy rendering in frontend
      target_type: r.target_type || (r.user_id || r.username ? 'account' : 'anonymous'),
      reason: r.body || r.reason || '',
      ip: r.ip_address || r.ip || null,
      fingerprint: r.fingerprint || null,
      anon_id: r.anon_id || null,
      active: r.active !== false,
      created_at: r.createdAt || r.created_at || new Date().toISOString()
    }));

    return json({ bans: mapped });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  const admin = await getAdminUser(request);
  if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await request.json() as any;
    const db = await getDb();

    const isAccountBan = body.target_type === 'account' || Boolean(body.user_id || body.username);
    const now = new Date().toISOString();

    const reason = (body.reason || body.body || '').trim();
    if (!reason) {
      return json({ error: 'A reason for the ban is required' }, { status: 400 });
    }

    if (isAccountBan) {
      if (!body.user_id && !body.username) {
        return json({ error: 'User ID or Username is required for account bans' }, { status: 400 });
      }

      // Look up user details in Supabase if needed
      let userRecord = null;
      if (body.user_id) {
        const { data } = await supabaseAdmin.from('users').select('*').eq('id', body.user_id).maybeSingle();
        userRecord = data;
      } else if (body.username) {
        const cleanUser = body.username.replace(/^@/, '').trim();
        const { data } = await supabaseAdmin.from('users').select('*').ilike('username', cleanUser).maybeSingle();
        userRecord = data;
      }

      const ruleDoc = {
        action: 'ban',
        preset: 'ban',
        active: true,
        target_type: 'account',
        user_id: userRecord?.id || body.user_id || null,
        username: userRecord?.username || (body.username ? body.username.replace(/^@/, '') : null),
        display_name: userRecord?.display_name || body.display_name || null,
        email: userRecord?.email || body.email || null,
        profile_picture: userRecord?.profile_picture || body.profile_picture || null,
        title: body.title || `Account ban: @${userRecord?.username || body.username || 'user'}`,
        body: reason,
        reason: reason,
        createdAt: now,
        createdBy: admin.id,
        updatedAt: now,
        updatedBy: admin.id
      };

      const result = await db.collection('abuse_moderation_rules').insertOne(ruleDoc);
      return json({ success: true, id: result.insertedId.toString(), rule: { ...ruleDoc, id: result.insertedId.toString() } });

    } else {
      // Anonymous / device / IP ban
      const anonId = (body.anon_id || '').trim();
      const fingerprint = (body.fingerprint || '').trim();
      const ip = (body.ip || body.ip_address || '').trim();

      if (!anonId && !fingerprint && !ip) {
        return json({ error: 'At least one identifier (Anon ID, Fingerprint, or IP Address) is required' }, { status: 400 });
      }

      const ruleDoc = {
        action: 'ban',
        preset: 'ban',
        active: true,
        target_type: 'anonymous',
        anon_id: anonId || null,
        fingerprint: fingerprint || null,
        ip_address: ip || null,
        title: body.title || `Device/Anon Ban: ${anonId || fingerprint || ip}`,
        body: reason,
        reason: reason,
        createdAt: now,
        createdBy: admin.id,
        updatedAt: now,
        updatedBy: admin.id
      };

      const result = await db.collection('abuse_moderation_rules').insertOne(ruleDoc);
      return json({ success: true, id: result.insertedId.toString(), rule: { ...ruleDoc, id: result.insertedId.toString() } });
    }

  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH({ request }) {
  const admin = await getAdminUser(request);
  if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as any;
    const { id, active, reason, body: reasonBody } = body;
    if (!id) return json({ error: 'ID is required' }, { status: 400 });

    const db = await getDb();
    const updateFields: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: admin.id
    };

    if (typeof active === 'boolean') {
      updateFields.active = active;
    }
    if (reason || reasonBody) {
      updateFields.body = reason || reasonBody;
      updateFields.reason = reason || reasonBody;
    }

    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await db.collection('abuse_moderation_rules').updateOne(filter, { $set: updateFields });

    return json({ success: true, modified: result.modifiedCount });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ request, url, params }) {
  const admin = await getAdminUser(request);
  if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const id = url.searchParams.get('id') || (params as any)?.id;
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    await db.collection('abuse_moderation_rules').deleteOne(filter);

    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
