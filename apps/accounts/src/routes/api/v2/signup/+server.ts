import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { 
  supabaseAdmin, 
  hashPassword, 
  generateToken, 
  generateRecoveryKey 
} from '$lib/server/utils';
import { parseProfilePictureDataUri, generateDicebearAvatarUrl, detectGender } from '$lib/avatar';
import {
  normalizeName,
  validateName,
  normalizeUsername,
  validateUsername,
  sanitizeField
} from '@materio/utils/sanitizer';

export async function POST({ request }: RequestEvent) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const { 
      username, 
      displayName, 
      email, 
      password, 
      profilePicture, 
      otp,
      avatarVariant = 'shape',
      inviteCode,
      branch = 'Computer Science and Engineering',
      currentYear,
      passoutYear,
      specialization
    } = body;

    if (!username || !displayName || !email || !password || !otp) {
      return json({ error: 'Missing required fields including verification code' }, { status: 400 });
    }

    const cleanDisplayName = normalizeName(displayName);
    const nameCheck = validateName(cleanDisplayName);
    if (!nameCheck.valid) {
      return json({ error: nameCheck.error || 'Invalid name' }, { status: 400 });
    }

    const cleanUsername = normalizeUsername(username);
    const userCheck = validateUsername(cleanUsername);
    if (!userCheck.valid) {
      return json({ error: userCheck.error || 'Invalid username' }, { status: 400 });
    }

    const cleanBranch = sanitizeField(branch);
    const cleanSpecialization = sanitizeField(specialization);
    const cleanPassoutYear = passoutYear ? parseInt(sanitizeField(String(passoutYear))) : null;
    const cleanCurrentYear = currentYear ? parseInt(sanitizeField(String(currentYear))) : null;

    const normalizedEmail = sanitizeField(email).toLowerCase();

    if (!normalizedEmail.endsWith('@paruluniversity.ac.in') && !normalizedEmail.endsWith('@getmaterio.app')) {
      return json({ error: 'Only Parul University emails are allowed (@paruluniversity.ac.in)' }, { status: 400 });
    }

    // STEP 1: Verify OTP
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('otp', otp)
      .eq('type', 'signup')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // STEP 1.5: Validate Optional Invite Code (Gift Code)
    let isPlusUser = false;
    let validInvite = null;

    if (inviteCode) {
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('invites')
        .select('*')
        .eq('code', inviteCode.trim())
        .eq('redeemed', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (inviteError || !invite) {
        return json({ error: 'Invalid or expired gift code' }, { status: 400 });
      }
      
      validInvite = invite;
      isPlusUser = !!invite.contains_plus_perks;
    }

    // STEP 2: Check if user already exists
    const { data: existingUserByEmail } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUserByEmail) return json({ error: 'Email already exists' }, { status: 409 });

    const { data: existingUserByUsername } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUserByUsername) return json({ error: 'Username already taken' }, { status: 409 });

    // STEP 3: Create user
    const recoveryKey = generateRecoveryKey();
    const hashedPassword = await hashPassword(password);
    
    const userGender = detectGender(cleanDisplayName);
    const fallbackDicebearUrl = generateDicebearAvatarUrl({
      seed: cleanUsername || cleanDisplayName || 'User',
      gender: userGender,
      size: 128
    });

    const isRemoteUrl = typeof profilePicture === 'string' && (profilePicture.startsWith('http://') || profilePicture.startsWith('https://'));
    const isInlineUpload = typeof profilePicture === 'string' && profilePicture.startsWith('data:image');

    // Prioritize Dicebear CDN URL (or remote URL) directly
    const effectiveProfilePic = isRemoteUrl ? profilePicture : fallbackDicebearUrl;
    
    const userData = {
      username: cleanUsername,
      display_name: cleanDisplayName,
      email: normalizedEmail,
      password: hashedPassword,
      recovery_key: recoveryKey,
      has_admin_privileges: false,
      is_plus_user: isPlusUser,
      branch: cleanBranch,
      current_year: cleanCurrentYear,
      passout_year: cleanPassoutYear,
      specialization: cleanSpecialization,
      university_roll_no: normalizedEmail.split('@')[0],
      profile_picture: effectiveProfilePic,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (userError) return json({ error: 'Failed to create user', details: userError }, { status: 500 });

    if (validInvite) {
      await supabaseAdmin
        .from('invites')
        .update({
          redeemed: true,
          redeemed_by: newUser.id,
          redeemed_date: new Date().toISOString()
        })
        .eq('id', validInvite.id);
    }

    // STEP 4: Only upload to Supabase storage if user provided an inline device file upload (data:image)
    let finalProfilePic = userData.profile_picture;
    if (isInlineUpload) {
      const parsedImage = parseProfilePictureDataUri(profilePicture);
      if (parsedImage) {
        try {
          const fileName = `${newUser.id}/profile.${parsedImage.extension}`;
          
          const { error: uploadError } = await supabaseAdmin
            .storage
            .from('profile-pictures')
            .upload(fileName, parsedImage.buffer, {
              contentType: parsedImage.mimeType,
              upsert: true
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabaseAdmin
              .storage
              .from('profile-pictures')
              .getPublicUrl(fileName);

            finalProfilePic = publicUrl;
            await supabaseAdmin
              .from('users')
              .update({ profile_picture: finalProfilePic })
              .eq('id', newUser.id);
          } else {
            console.error('Profile picture storage upload error:', uploadError);
          }
        } catch (error) {
          console.error('Profile picture upload error:', error);
        }
      }
    }

    // STEP 5: Clean up OTP
    await supabaseAdmin.from('otps').delete().eq('id', otpRecord.id);

    // STEP 6: Generate JWT token
    const token = generateToken({ 
      id: newUser.id, 
      email: newUser.email, 
      username: newUser.username 
    });

    // STEP 7: Return success
    return json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.display_name,
        email: newUser.email,
        hasAdminPrivileges: newUser.has_admin_privileges,
        isPlusUser: newUser.is_plus_user,
        profilePicture: finalProfilePic,
        recoveryKey
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Signup error:', error);
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
