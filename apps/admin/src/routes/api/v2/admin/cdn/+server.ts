import { json } from '@sveltejs/kit';
import { verifyToken, supabaseAdmin } from '$lib/server/utils';
import { Octokit } from '@octokit/rest';
import { env } from '$env/dynamic/private';

const GITHUB_OWNER = 'Materioa';
const GITHUB_REPO = 'cdn-materio';

function getOctokit() {
  return new Octokit({ auth: env.GITHUB_TOKEN || '' });
}

async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  const user = await verifyToken(token);
  if (!user || !user.id) return false;
  const { data } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', user.id).single();
  return data?.has_admin_privileges === true;
}

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  const path = url.searchParams.get('path') || '';
  try {
    const { data } = await getOctokit().repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
    if (Array.isArray(data)) {
      return json(data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'directory' : 'file',
        size: item.size,
        download_url: item.download_url
      })));
    } else {
      return json({ 
        name: data.name, 
        path: data.path, 
        type: 'file', 
        size: data.size, 
        download_url: data.download_url,
        content: (data as any).content,
        encoding: (data as any).encoding 
      });
    }
  } catch (error: any) {
    console.error('CDN GET error:', error);
    return json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const isCommit = url.searchParams.get('commit') === 'true';
    if (isCommit) {
      const body = await request.json() as any;
      const { stagedFiles, stagedJsonFiles, autoPushNotify, commitMessage } = body;
      const octokit = getOctokit();

      // 1. Get the current commit and tree of the main branch
      const { data: refData } = await octokit.git.getRef({ owner: GITHUB_OWNER, repo: GITHUB_REPO, ref: 'heads/main' });
      const currentCommitSha = refData.object.sha;
      const { data: commitData } = await octokit.git.getCommit({ owner: GITHUB_OWNER, repo: GITHUB_REPO, commit_sha: currentCommitSha });
      const baseTreeSha = commitData.tree.sha;

      // 2. Prepare the tree array
      const tree: any[] = [];
      let notificationAdded = false;

      // Add all binary/PDF files
      if (stagedFiles && Array.isArray(stagedFiles)) {
        for (const file of stagedFiles) {
          try {
            // First create a blob for the base64 content
            const blobData = await octokit.git.createBlob({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              content: file.content,
              encoding: 'base64'
            });

            tree.push({
              path: file.path,
              mode: '100644',
              type: 'blob',
              sha: blobData.data.sha
            });
          } catch (err: any) {
            console.error(`Failed to create blob for ${file.path}:`, err);
            throw new Error(`Failed to upload ${file.path}`);
          }
        }
      }

      // Add all JSON files (or text files)
      if (stagedJsonFiles && Array.isArray(stagedJsonFiles)) {
        for (const file of stagedJsonFiles) {
          tree.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            content: file.content // Assuming frontend sends text content
          });
          if (file.path === 'notifications.json') {
            notificationAdded = true;
          }
        }
      }

      // Handle autoPushNotify if not already updated in stagedJsonFiles
      if (autoPushNotify && !notificationAdded && stagedFiles && stagedFiles.length > 0) {
        // Find unique subjects & categories uploaded
        const subjects = [...new Set(stagedFiles.map((f: any) => f.path.split('/')[2]))].filter(Boolean);
        const categories = [...new Set(stagedFiles.map((f: any) => f.path.split('/')[3]))].filter(Boolean);
        
        let notifications: any[] = [];
        try {
          const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: 'notifications.json' });
          if (!Array.isArray(data) && (data as any).content) {
            notifications = JSON.parse(Buffer.from((data as any).content, 'base64').toString('utf8'));
          }
        } catch (e) {
          // Doesn't exist, ignore
        }

        const notification = {
          title: "New Materials Uploaded!",
          message: `New materials have been added in ${categories.join(', ')} category of ${subjects.join(', ')}.`,
          date: new Date().toISOString(),
          links: []
        };
        
        notifications.unshift(notification);
        
        tree.push({
          path: 'notifications.json',
          mode: '100644',
          type: 'blob',
          content: JSON.stringify(notifications, null, 2)
        });
      }

      // Update resource.lib.json automatically if there are staged files
      if (stagedFiles && stagedFiles.length > 0) {
        let resourceLib: any = {};
        try {
          const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: 'databases/beta/resource.lib.json' });
          if (!Array.isArray(data) && (data as any).content) {
            resourceLib = JSON.parse(Buffer.from((data as any).content, 'base64').toString('utf8'));
          }
        } catch (e) {
          // Ignore, start fresh
        }
        
        let isResourceLibModified = false;
        for (const file of stagedFiles) {
          const parts = file.path.split('/');
          if (parts[0] !== 'pdfs' || parts.length < 5) continue;
          
          const sem = parts[1];
          const subject = parts[2];
          const category = parts[3];
          const filename = parts.pop().replace(/\.[^/.]+$/, "");
          
          if (!resourceLib[sem]) resourceLib[sem] = {};
          if (!resourceLib[sem][subject]) resourceLib[sem][subject] = [];
          
          let catObj = resourceLib[sem][subject].find((c: any) => c.type === category);
          if (!catObj) {
            catObj = { type: category, content: [] };
            resourceLib[sem][subject].push(catObj);
          }
          
          if (!catObj.content.includes(filename)) {
            catObj.content.push(filename);
            isResourceLibModified = true;
          }
        }
        
        if (isResourceLibModified) {
          tree.push({
            path: 'databases/beta/resource.lib.json',
            mode: '100644',
            type: 'blob',
            content: JSON.stringify(resourceLib, null, 2)
          });
        }
      }

      if (tree.length === 0) {
        return json({ error: 'No files to commit' }, { status: 400 });
      }

      // 3. Create a new tree
      const { data: newTree } = await octokit.git.createTree({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        base_tree: baseTreeSha,
        tree: tree
      });

      // 4. Create a new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        message: commitMessage || `Bulk upload of ${tree.length} files via Materio CMS`,
        tree: newTree.sha,
        parents: [currentCommitSha]
      });

      // 5. Update the reference
      await octokit.git.updateRef({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        ref: 'heads/main',
        sha: newCommit.sha
      });

      return json({ success: true, commit: newCommit.sha });
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const path = formData.get('path') as string;
      const file = formData.get('file') as File;
      if (!file || !path) return json({ error: 'Missing file or path' }, { status: 400 });

      const buffer = await file.arrayBuffer();
      const base64Content = Buffer.from(buffer).toString('base64');
      const octokit = getOctokit();

      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
        if (!Array.isArray(data)) sha = data.sha;
      } catch (e) {}

      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER, repo: GITHUB_REPO, path,
        message: `Update ${path} via Materio CMS`,
        content: base64Content, sha
      });
      return json({ success: true, path });
    } else {
      const body = await request.json().catch(() => ({})) as any;
      if (body.type === 'directory') {
        const folderPath = body.path ? `${body.path}/.gitkeep` : '.gitkeep';
        await getOctokit().repos.createOrUpdateFileContents({
          owner: GITHUB_OWNER, repo: GITHUB_REPO,
          path: folderPath, message: `Create directory ${(body as any).path} via Materio CMS`,
          content: Buffer.from('').toString('base64'),
        });
        return json({ success: true, path: (body as any).path });
      }
      return json({ error: 'Invalid request' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('CDN POST error:', error);
    return json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PUT({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as any;
    const { oldPath, newPath } = body;
    if (!oldPath || !newPath) return json({ error: 'Missing oldPath or newPath' }, { status: 400 });
    const octokit = getOctokit();
    const { data: fileData } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path: oldPath });
    if (Array.isArray(fileData)) return json({ error: 'Cannot rename directories' }, { status: 400 });
    if (!(fileData as any).content) return json({ error: 'File too large to rename via API' }, { status: 400 });

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: newPath,
      message: `Rename ${oldPath} -> ${newPath} via Materio CMS`,
      content: (fileData as any).content,
    });
    await octokit.repos.deleteFile({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: oldPath,
      message: `Delete ${oldPath} after rename`, sha: fileData.sha
    });
    return json({ success: true, oldPath, newPath });
  } catch (error: any) {
    console.error('CDN PUT error:', error);
    return json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'Path is required' }, { status: 400 });
  try {
    const octokit = getOctokit();
    const { data } = await octokit.repos.getContent({ owner: GITHUB_OWNER, repo: GITHUB_REPO, path });
    if (Array.isArray(data)) return json({ error: 'Cannot delete non-empty directories directly' }, { status: 400 });
    await octokit.repos.deleteFile({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path,
      message: `Remove ${path} via Materio CMS`, sha: data.sha
    });
    return json({ success: true, path });
  } catch (error: any) {
    console.error('CDN DELETE error:', error);
    return json({ error: error.message }, { status: error.status || 500 });
  }
}
