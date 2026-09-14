import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { 
  supabaseAdmin, 
  hashPassword, 
  generateToken, 
  generateRecoveryKey 
} from '$lib/server/utils';

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

    const hasInlineProfilePicture = typeof profilePicture === 'string' && profilePicture.startsWith('data:image');

    if (!username || !displayName || !email || !password || !otp) {
      return json({ error: 'Missing required fields including verification code' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

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
      .eq('username', username)
      .maybeSingle();

    if (existingUserByUsername) return json({ error: 'Username already taken' }, { status: 409 });

    // STEP 3: Create user
    const recoveryKey = generateRecoveryKey();
    const hashedPassword = await hashPassword(password);
    
    const fallbackAvatarUrl = "https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&size=128&bold=true";
    
    const userData = {
      username,
      display_name: displayName,
      email: normalizedEmail,
      password: hashedPassword,
      recovery_key: recoveryKey,
      has_admin_privileges: false,
      is_plus_user: isPlusUser,
      branch: branch,
      current_year: currentYear,
      passout_year: passoutYear,
      specialization: specialization,
      university_roll_no: normalizedEmail.split('@')[0],
      profile_picture: hasInlineProfilePicture ? profilePicture : fallbackAvatarUrl.replace('"', '').replace('"', ''),
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

    // STEP 4: Handle profile picture upload if provided
    let finalProfilePic = userData.profile_picture;
    if (hasInlineProfilePicture) {
      try {
        const base64Data = profilePicture.split(',')[1];
        const mimeType = profilePicture.match(/data:(.*?);base64/)?.[1] || 'image/png';
        let fileExt = 'png';
        if (mimeType.includes('svg')) fileExt = 'svg';
        else if (mimeType.includes('jpeg')) fileExt = 'jpeg';
        else if (mimeType.includes('jpg')) fileExt = 'jpg';
        else if (mimeType.includes('webp')) fileExt = 'webp';
        
        const fileName = "${newUser.id}/profile.${fileExt}".replace('"', '').replace('"', '');
        const bufferData = Buffer.from(base64Data, 'base64');
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin
          .storage
          .from('profile-pictures')
          .upload(fileName, bufferData, {
            contentType: mimeType,
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
        }
      } catch (error) {
        console.error('Profile picture upload error:', error);
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
