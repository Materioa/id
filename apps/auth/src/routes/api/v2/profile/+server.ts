import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { 
  supabaseAdmin, 
  hashPassword, 
  comparePassword, 
  verifyToken, 
  generateRecoveryKey 
} from '$lib/server/utils';

const PROFILE_PICTURE_RETENTION_DAYS = 14;
const PROFILE_PICTURES_PUBLIC_SEGMENT = '/storage/v1/object/public/profile-pictures/';

function extractProfilePicturePath(publicUrl: string) {
  if (!publicUrl || typeof publicUrl !== 'string' || publicUrl.startsWith('data:')) return null;
  const markerIndex = publicUrl.indexOf(PROFILE_PICTURES_PUBLIC_SEGMENT);
  if (markerIndex === -1) return null;
  const rawPath = publicUrl
    .slice(markerIndex + PROFILE_PICTURES_PUBLIC_SEGMENT.length)
    .split('?')[0];
  return decodeURIComponent(rawPath);
}

async function cleanupExpiredProfilePictures(userId: string, activeProfilePictureUrl: string) {
  try {
    const retentionMs = PROFILE_PICTURE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const activePath = extractProfilePicturePath(activeProfilePictureUrl);
    const activeFileName = activePath && activePath.startsWith(`${userId}/`)
      ? activePath.slice(`${userId}/`.length)
      : null;

    const { data: files, error: listError } = await supabaseAdmin
      .storage
      .from('profile-pictures')
      .list(userId);

    if (listError || !Array.isArray(files) || files.length === 0) return;

    const removableFiles = files
      .filter((file) => {
        if (!file || !file.name) return false;
        if (activeFileName && file.name === activeFileName) return false;
        const fileDate = Date.parse(file.updated_at || file.created_at || '');
        if (Number.isNaN(fileDate)) return false;
        return now - fileDate >= retentionMs;
      })
      .map((file) => `${userId}/${file.name}`);

    if (removableFiles.length === 0) return;

    await supabaseAdmin.storage.from('profile-pictures').remove(removableFiles);
  } catch (error) {
    console.error('Profile picture retention cleanup error:', error);
  }
}

function getToken(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export async function GET({ request }: RequestEvent) {
  try {
    const token = getToken(request);
    if (!token) return json({ error: 'Authentication token required' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, profile_picture, created_at, updated_at, recovery_key, has_admin_privileges, is_plus_user, is_lite_user, lite_expiry, branch, specialization, two_factor_enabled, two_factor_enabled_at')
      .eq('id', decoded.id)
      .single();

    if (error) return json({ error: 'Database error', details: error.message }, { status: 500 });
    if (!user) return json({ error: 'User not found' }, { status: 404 });

    await cleanupExpiredProfilePictures(user.id, user.profile_picture);

    return json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        profilePicture: user.profile_picture,
        recoveryKey: user.recovery_key,
        hasAdminPrivileges: user.has_admin_privileges,
        isPlusUser: user.is_plus_user,
        isLiteUser: user.is_lite_user,
        plusExpiry: user.lite_expiry,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        branch: user.branch,
        specialization: user.specialization,
        twoFactorEnabled: user.two_factor_enabled,
        twoFactorEnabledAt: user.two_factor_enabled_at
      }
    }, { status: 200 });
  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT({ request }: RequestEvent) {
  try {
    const token = getToken(request);
    if (!token) return json({ error: 'Authentication token required' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const body: any = await request.json().catch(() => ({}));
    const { username, displayName, currentPassword, newPassword, generateNewRecoveryKey, profilePicture, branch, specialization, disable2FA } = body;

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (userError || !user) return json({ error: 'User not found' }, { status: 404 });

    const updateData: any = {};
    let recoveryKey = null;

    if (disable2FA) {
      updateData.two_factor_enabled = false;
      updateData.two_factor_secret = null;
    }

    if (username && username !== user.username) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', decoded.id)
        .single();
      if (existingUser) return json({ error: 'Username already taken' }, { status: 400 });
      updateData.username = username;
    }

    if (displayName && displayName !== user.display_name) {
      updateData.display_name = displayName;
    }

    if (branch !== undefined && branch !== user.branch) {
      updateData.branch = branch;
    }

    if (specialization !== undefined && specialization !== user.specialization) {
      updateData.specialization = specialization;
    }

    if (newPassword && currentPassword) {
      const isPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isPasswordValid) return json({ error: 'Current password is incorrect' }, { status: 401 });
      updateData.password = await hashPassword(newPassword);
    }

    if (generateNewRecoveryKey) {
      if (!currentPassword) return json({ error: 'Current password required' }, { status: 400 });
      const isPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isPasswordValid) return json({ error: 'Current password is incorrect' }, { status: 401 });
      recoveryKey = generateRecoveryKey();
      updateData.recovery_key = recoveryKey;
    }

    const isProfilePictureUpdateRequest = typeof profilePicture === 'string' && profilePicture.length > 0 && profilePicture !== user.profile_picture;

    if (isProfilePictureUpdateRequest) {
      if (!profilePicture.startsWith('data:image')) {
        return json({ error: 'Invalid profile picture format' }, { status: 400 });
      }
      try {
        const mimeTypeMatch = profilePicture.match(/data:(.*?);/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
        
        let buffer: Buffer;
        if (profilePicture.includes(';base64,')) {
          const base64Data = profilePicture.split(';base64,')[1];
          if (!base64Data) return json({ error: 'Invalid profile picture payload' }, { status: 400 });
          buffer = Buffer.from(base64Data, 'base64');
        } else if (profilePicture.includes('utf8,')) {
          // Dicebear SVG is often utf8 encoded in the data URI
          const rawData = decodeURIComponent(profilePicture.split('utf8,')[1]);
          buffer = Buffer.from(rawData, 'utf-8');
        } else {
          // Fallback for other data URIs without base64 or utf8 keyword
          const rawData = decodeURIComponent(profilePicture.split(',')[1]);
          buffer = Buffer.from(rawData, 'utf-8');
        }

        let extension = 'jpg';
        if (mimeType.includes('svg')) extension = 'svg';
        else if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('webp')) extension = 'webp';

        const fileName = `profile-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabaseAdmin
          .storage
          .from('profile-pictures')
          .upload(`${decoded.id}/${fileName}`, buffer, { contentType: mimeType, upsert: false });

        if (uploadError) return json({ error: 'Failed to upload profile picture' }, { status: 500 });
        
        const { data: { publicUrl } } = supabaseAdmin
          .storage
          .from('profile-pictures')
          .getPublicUrl(`${decoded.id}/${fileName}`);
        updateData.profile_picture = publicUrl;
      } catch (error: any) {
        return json({ error: 'Profile picture processing failed', details: error.message }, { status: 500 });
      }
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', decoded.id);
      if (updateError) return json({ error: 'Failed to update profile', details: updateError }, { status: 500 });
    }

    const { data: updatedUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, profile_picture, created_at, updated_at, recovery_key, has_admin_privileges, is_plus_user, is_lite_user, lite_expiry, branch, specialization')
      .eq('id', decoded.id)
      .single();

    if (fetchError) return json({ error: 'Failed to fetch updated profile' }, { status: 500 });

    await cleanupExpiredProfilePictures(decoded.id, updatedUser.profile_picture);

    return json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
        profilePicture: updatedUser.profile_picture,
        recoveryKey: updatedUser.recovery_key,
        hasAdminPrivileges: updatedUser.has_admin_privileges,
        isPlusUser: updatedUser.is_plus_user,
        isLiteUser: updatedUser.is_lite_user,
        plusExpiry: updatedUser.lite_expiry,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
        branch: updatedUser.branch,
        specialization: updatedUser.specialization
      },
      recoveryKey
    }, { status: 200 });

  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE({ request }: RequestEvent) {
  try {
    const token = getToken(request);
    if (!token) return json({ error: 'Authentication token required' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const body: any = await request.json().catch(() => ({}));
    if (!body.password) return json({ error: 'Password confirmation required' }, { status: 400 });

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('password')
      .eq('id', decoded.id)
      .single();

    if (userError || !user) return json({ error: 'User not found' }, { status: 404 });

    const isPasswordValid = await comparePassword(body.password, user.password);
    if (!isPasswordValid) return json({ error: 'Invalid password' }, { status: 401 });

    try {
      const { data: files } = await supabaseAdmin.storage.from('profile-pictures').list(decoded.id);
      if (files && files.length > 0) {
        await supabaseAdmin.storage.from('profile-pictures').remove(files.map(f => `${decoded.id}/${f.name}`));
      }
    } catch (e) {}

    const { error: deleteError } = await supabaseAdmin.from('users').delete().eq('id', decoded.id);
    if (deleteError) return json({ error: 'Failed to delete account', details: deleteError.message }, { status: 500 });

    return json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
