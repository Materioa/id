import { json } from '@sveltejs/kit';
import { verifyToken, supabaseAdmin } from '$lib/server/utils';
import { Octokit } from '@octokit/rest';
import { env } from '$env/dynamic/private';

const GITHUB_OWNER = 'Materioa';
const GITHUB_REPO = 'cdn-materio';

function getOctokit(platform?: any) {
  let token = platform?.env?.GITHUB_TOKEN || (env as any)?.GITHUB_TOKEN;
  if (!token && typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) {
    token = process.env.GITHUB_TOKEN;
  }
  return new Octokit({ auth: token || '' });
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
        const categories = [...new Set(stagedFiles.map((f: any) => f.category).filter(Boolean))];
        
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
          // Path is now pdfs/sem/subject/filename.pdf (no category folder)
          if (parts[0] !== 'pdfs' || parts.length < 4) continue;
          
          const sem = parts[1];
          const subject = parts[2];
          const category = file.category; // Category comes from metadata, not path
          const filename = parts[parts.length - 1].replace(/\.[^/.]+$/, "");
          
          if (!category) continue; // Skip if no category metadata
          
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

export async function DELETE({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  const rawPath = url.searchParams.get('path');
  if (!rawPath) return json({ error: 'Path is required' }, { status: 400 });

  const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
  if (!cleanPath) return json({ error: 'Cannot delete root repository' }, { status: 400 });

  try {
    const octokit = getOctokit(platform);

    // 1. Fetch current commit & full recursive tree
    const { data: refData } = await octokit.git.getRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: 'heads/main'
    });
    const currentCommitSha = refData.object.sha;

    const { data: currentCommit } = await octokit.git.getCommit({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      commit_sha: currentCommitSha
    });

    const { data: fullTree } = await octokit.git.getTree({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      tree_sha: currentCommit.tree.sha,
      recursive: 'true'
    });

    // 2. Identify items to delete (exact path match or within directory path)
    const isTarget = (p: string) => p === cleanPath || p.startsWith(cleanPath + '/');
    const targetItems = fullTree.tree.filter((item) => item.path && isTarget(item.path));

    if (targetItems.length === 0) {
      return json({ error: `Path "${cleanPath}" does not exist` }, { status: 404 });
    }

    const targetBlobs = targetItems.filter((item) => item.type === 'blob');

    // 3. Clean up references in databases/beta/resource.lib.json
    const pathParts = cleanPath.split('/');
    const targetSem = pathParts[0] === 'pdfs' && pathParts.length >= 2 ? pathParts[1] : undefined;
    const targetSub = pathParts[0] === 'pdfs' && pathParts.length >= 3 ? pathParts[2] : undefined;
    const targetCat = pathParts[0] === 'pdfs' && pathParts.length === 4 ? pathParts[3] : undefined;

    const deletedFilesInfo: { filename: string; rawFilename: string }[] = [];
    for (const blob of targetBlobs) {
      if (!blob.path) continue;
      const parts = blob.path.split('/');
      if (parts[0] !== 'pdfs') continue;
      const rawFilename = parts[parts.length - 1];
      if (rawFilename === '.gitkeep') continue;
      const filename = rawFilename.replace(/\.[^/.]+$/, '');
      deletedFilesInfo.push({ filename, rawFilename });
    }

    let isResourceLibModified = false;
    let resourceLib: any = null;
    const resourceLibBlobItem = fullTree.tree.find((item) => item.path === 'databases/beta/resource.lib.json');

    if (resourceLibBlobItem && resourceLibBlobItem.sha) {
      try {
        const { data: blobData } = await octokit.git.getBlob({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          file_sha: resourceLibBlobItem.sha
        });
        const contentStr = Buffer.from(blobData.content, 'base64').toString('utf8');
        resourceLib = JSON.parse(contentStr);
      } catch (err) {
        console.error('Failed to parse databases/beta/resource.lib.json:', err);
      }
    }

    if (resourceLib && typeof resourceLib === 'object') {
      for (const semKey of Object.keys(resourceLib)) {
        if (targetSem && semKey.toLowerCase() !== targetSem.toLowerCase()) continue;
        const semObj = resourceLib[semKey];
        if (!semObj || typeof semObj !== 'object') continue;

        for (const subKey of Object.keys(semObj)) {
          if (targetSub && subKey.toLowerCase() !== targetSub.toLowerCase()) continue;
          const categories = semObj[subKey];
          if (!Array.isArray(categories)) continue;

          const updatedCategories: any[] = [];
          for (const cat of categories) {
            if (!cat) continue;

            // If entire category folder was targeted (e.g. pdfs/{sem}/{subject}/{category})
            if (targetCat && cat.type && cat.type.trim().toLowerCase() === targetCat.trim().toLowerCase()) {
              isResourceLibModified = true;
              continue; // Drop entire category
            }

            // Otherwise filter content if files inside were deleted
            if (!Array.isArray(cat.content)) continue;

            const newContent = cat.content.filter((item: string) => {
              if (typeof item !== 'string') return true;
              const itemClean = item.trim().toLowerCase();
              const shouldDelete = deletedFilesInfo.some((df) => {
                return (
                  itemClean === df.filename.trim().toLowerCase() ||
                  itemClean === df.rawFilename.trim().toLowerCase()
                );
              });
              return !shouldDelete;
            });

            if (newContent.length !== cat.content.length) {
              isResourceLibModified = true;
            }

            // If category content becomes empty, delete the category
            if (newContent.length > 0) {
              updatedCategories.push({
                ...cat,
                content: newContent
              });
            } else {
              isResourceLibModified = true;
            }
          }

          if (updatedCategories.length > 0) {
            semObj[subKey] = updatedCategories;
          } else {
            // Subject has no categories left -> remove subject
            delete semObj[subKey];
            isResourceLibModified = true;
          }
        }

        // If semester has no subjects left -> remove semester
        if (Object.keys(semObj).length === 0) {
          delete resourceLib[semKey];
          isResourceLibModified = true;
        }
      }
    }

    // 4. Build atomic tree mutation using base_tree and sha: null
    const treeEntries: any[] = [];

    // Check if cleanPath is explicitly a tree or blob in Git
    const exactTree = fullTree.tree.find((item) => item.path === cleanPath && item.type === 'tree');
    const exactBlob = fullTree.tree.find((item) => item.path === cleanPath && item.type === 'blob');

    if (exactTree) {
      treeEntries.push({
        path: cleanPath,
        mode: '040000',
        type: 'tree',
        sha: null
      });
    } else if (exactBlob) {
      treeEntries.push({
        path: cleanPath,
        mode: exactBlob.mode || '100644',
        type: 'blob',
        sha: null
      });
    } else {
      // Multiple items or folder without explicit intermediate tree entry
      for (const item of targetItems) {
        if (item.path) {
          treeEntries.push({
            path: item.path,
            mode: item.mode || (item.type === 'tree' ? '040000' : '100644'),
            type: item.type as any,
            sha: null
          });
        }
      }
    }

    // Include updated resource.lib.json if modified
    if (isResourceLibModified && resourceLib) {
      const { data: newResourceBlob } = await octokit.git.createBlob({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        content: JSON.stringify(resourceLib, null, 2),
        encoding: 'utf-8'
      });
      treeEntries.push({
        path: 'databases/beta/resource.lib.json',
        mode: '100644',
        type: 'blob',
        sha: newResourceBlob.sha
      });
    }

    // 5. Create new tree using base_tree
    const { data: newTree } = await octokit.git.createTree({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      base_tree: currentCommit.tree.sha,
      tree: treeEntries
    });

    // 6. Create commit
    const commitMsg = targetItems.length === 1
      ? `Remove ${cleanPath} via Materio CMS`
      : `Remove ${cleanPath} (${targetItems.length} items) via Materio CMS`;

    const { data: newCommit } = await octokit.git.createCommit({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      message: commitMsg,
      tree: newTree.sha,
      parents: [currentCommitSha]
    });

    // 7. Update ref
    await octokit.git.updateRef({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: 'heads/main',
      sha: newCommit.sha
    });

    return json({
      success: true,
      path: cleanPath,
      deletedCount: targetItems.length,
      resourceLibUpdated: isResourceLibModified
    });
  } catch (error: any) {
    console.error('CDN DELETE error:', error);
    return json({ error: error.message }, { status: error.status || 500 });
  }
}
