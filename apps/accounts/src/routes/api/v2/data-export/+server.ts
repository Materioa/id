import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { sendAlertEmail } from '$lib/server/mailer';
import { getExportStartedTemplate, getExportReadyTemplate } from '$lib/server/export_email_templates';
import { MongoClient } from 'mongodb';
import { env } from '$env/dynamic/private';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';

function getToken(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

function getStickerAttachment() {
  const stickerPath = path.join(process.cwd(), 'assets', 'img', 'sticker.png');
  const stickerSource = fs.existsSync(stickerPath) ? stickerPath : 'https://materioa.vercel.app/assets/img/sticker.png';
  return [
    {
      filename: 'sticker.png',
      path: stickerSource,
      cid: 'sticker'
    }
  ];
}

/**
 * POST /api/v2/data-export
 * Initiates a data export for the authenticated user.
 * Sends a "started" email immediately, then processes in background.
 */
export async function POST({ request, platform }: RequestEvent) {
  try {
    const token = getToken(request);
    if (!token) return json({ error: 'Authentication token required' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const userId = decoded.id;

    // Fetch the user's profile to get email and display name
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, username')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Check cooldown: prevent re-export within 24 hours
    const { data: recentExports } = await supabaseAdmin
      .from('data_export_requests')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentExports && recentExports.length > 0) {
      const lastExport = new Date(recentExports[0].created_at);
      const hoursSince = (Date.now() - lastExport.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSince);
        return json({
          error: `You can request another export in ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`,
          cooldownUntil: new Date(lastExport.getTime() + 24 * 60 * 60 * 1000).toISOString()
        }, { status: 429 });
      }
    }

    // Record the export request
    await supabaseAdmin
      .from('data_export_requests')
      .insert({
        user_id: userId,
        status: 'processing',
        created_at: new Date().toISOString()
      });

    // Send the "Export Started" email immediately
    const startedHtml = getExportStartedTemplate(user.email, user.display_name || user.username);
    await sendAlertEmail({
      to: user.email,
      subject: '📦 Your Data Export Has Started — Materio',
      html: startedHtml,
      text: `Hi ${user.display_name || user.username}, your data export has started. You'll receive a download link within 24 hours.`,
      attachments: getStickerAttachment()
    });

    // Start background export process
    const exportPromise = processExportInBackground(userId, user.email, user.display_name || user.username);

    // Use Cloudflare waitUntil if available, otherwise let it run
    if (platform?.ctx?.waitUntil) {
      platform.ctx.waitUntil(exportPromise);
    } else {
      // In dev mode, just fire and forget
      exportPromise.catch((err) => {
        console.error('[DataExport] Background export failed:', err);
      });
    }

    return json({
      success: true,
      message: 'Data export started. You will receive an email with a download link when it\'s ready.'
    });

  } catch (error: any) {
    console.error('[DataExport] POST error:', error);
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

/**
 * GET /api/v2/data-export
 * Returns the latest export request status for the authenticated user.
 */
export async function GET({ request }: RequestEvent) {
  try {
    const token = getToken(request);
    if (!token) return json({ error: 'Authentication token required' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const { data: exports } = await supabaseAdmin
      .from('data_export_requests')
      .select('id, status, created_at')
      .eq('user_id', decoded.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!exports || exports.length === 0) {
      return json({ lastExport: null });
    }

    const lastExport = exports[0];
    const createdAt = new Date(lastExport.created_at);
    const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    return json({
      lastExport: {
        status: lastExport.status,
        createdAt: lastExport.created_at,
        canRequestNew: hoursSince >= 24,
        cooldownUntil: hoursSince < 24
          ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : null
      }
    });

  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// ─── Background Export Process ──────────────────────────────────────────────

async function processExportInBackground(userId: string, email: string, displayName: string) {
  try {
    const zip = new JSZip();

    // 1. Profile data
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, profile_picture, created_at, updated_at, recovery_key, has_admin_privileges, is_plus_user, is_lite_user, lite_expiry, branch, specialization, two_factor_enabled, two_factor_enabled_at')
      .eq('id', userId)
      .single();

    if (profile) {
      zip.file('account_profile.json', JSON.stringify(profile, null, 2));
    }

    // 2. Daily stats
    const { data: dailyStats } = await supabaseAdmin
      .from('user_daily_stats')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    zip.file('activity_stats.json', JSON.stringify(dailyStats || [], null, 2));

    // 3. Sessions
    const { data: sessions } = await supabaseAdmin
      .from('user_sessions')
      .select('id, user_agent, ip_address, created_at, last_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    zip.file('login_sessions.json', JSON.stringify(sessions || [], null, 2));

    // 4. Main App Data (Generic grouping)
    const appData: any[] = [];
    try {
      const db = await getDb();
      const collections = await db.listCollections().toArray();

      for (const col of collections) {
        const collection = db.collection(col.name);
        const docs = await collection.find({
          $or: [{ user_id: userId }, { userId: userId }, { user: userId }]
        }).toArray();

        if (docs.length > 0) {
          appData.push(...docs);
        }
      }
      if (appData.length > 0) {
        zip.file('app_data.json', JSON.stringify(appData, null, 2));
      }
    } catch (err) {
      console.error('[DataExport] Error fetching main app data:', err);
    }

    // 5. Conversations Data (Generic grouping)
    const chatData: any[] = [];
    try {
      const mongoUri = env.MONGODB_URI;
      if (mongoUri) {
        const chatClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
        await chatClient.connect();
        const chatDb = chatClient.db('materio_chat');
        const chatCollections = await chatDb.listCollections().toArray();

        for (const col of chatCollections) {
          const collection = chatDb.collection(col.name);
          const docs = await collection.find({
            $or: [{ user_id: userId }, { userId: userId }, { user: userId }]
          }).toArray();

          if (docs.length > 0) {
            chatData.push(...docs);
          }
        }
        await chatClient.close();

        if (chatData.length > 0) {
          zip.file('thinklet/conversations.json', JSON.stringify(chatData, null, 2));
        }
      }
    } catch (err) {
      console.error('[DataExport] Error fetching conversations data:', err);
    }

    // 6. Add export metadata
    zip.file('export_summary.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      userId: userId,
      email: email,
      format: 'JSON',
      includedSources: ['Account Profile', 'Activity Stats', 'Login Sessions', 'App Data', 'Thinklet Conversations']
    }, null, 2));

    // 7. Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    // 8. Upload to Supabase Storage
    const timestamp = Date.now();
    const filePath = `${userId}/export-${timestamp}.zip`;

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('data-exports')
      .upload(filePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      console.error('[DataExport] Upload error:', uploadError);
      throw new Error(`Failed to upload export: ${uploadError.message}`);
    }

    // 9. Generate signed URL (24 hour expiry)
    const { data: signedData, error: signedError } = await supabaseAdmin
      .storage
      .from('data-exports')
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours in seconds

    if (signedError || !signedData?.signedUrl) {
      console.error('[DataExport] Signed URL error:', signedError);
      throw new Error('Failed to generate download link');
    }

    const downloadUrl = signedData.signedUrl;

    // 10. Send "Export Ready" email with download link
    const readyHtml = getExportReadyTemplate(email, displayName, downloadUrl);
    await sendAlertEmail({
      to: email,
      subject: '✅ Your Data Export is Ready — Materio',
      html: readyHtml,
      text: `Hi ${displayName}, your data export is ready! Download it here (link expires in 24 hours): ${downloadUrl}`,
      attachments: getStickerAttachment()
    });

    // 11. Update export status
    await supabaseAdmin
      .from('data_export_requests')
      .update({ status: 'completed' })
      .eq('user_id', userId)
      .eq('status', 'processing');

    console.log(`[DataExport] Export completed for user ${userId}`);

  } catch (err) {
    console.error('[DataExport] Background export error:', err);

    // Update status to failed
    await supabaseAdmin
      .from('data_export_requests')
      .update({ status: 'failed' })
      .eq('user_id', userId)
      .eq('status', 'processing');

    // Notify the user via email about the failure
    try {
      await sendAlertEmail({
        to: email,
        subject: '❌ Data Export Failed — Materio',
        text: `Hi ${displayName}, unfortunately your data export failed. Please try again later or contact support.`,
        attachments: getStickerAttachment()
      });
    } catch (_) {
      // Swallow email failure
    }
  }
}
