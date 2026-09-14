import { json } from '@sveltejs/kit';
import { verifyToken, supabaseAdmin } from '$lib/server/utils';

async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  const user = await verifyToken(token);
  if (!user || !user.id) return false;
  const { data } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', user.id).single();
  return data?.has_admin_privileges === true;
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    
    if (!file) return json({ error: 'Missing file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = path || `upload-${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('attachments')
      .upload(fileName, buffer, { 
        contentType: file.type,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('attachments')
      .getPublicUrl(fileName);

    return json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Upload POST error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}
