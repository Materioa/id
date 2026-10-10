import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { env } from '$env/dynamic/private';
import { slugify, extractPostImagesList } from './insightroom-posts';
import { getInsightroomDb } from './mongo';

export type ExodusDocType = 'changelog' | 'doc' | 'legal';

export interface ExodusPost {
  id: string; // e.g. "exodus:post:2026-03-21-mcp.md" or "exodus:page:privacy.md"
  scope: 'exodus';
  docType: ExodusDocType;
  filename: string;
  title: string;
  slug: string;
  date?: string;
  category: string;
  categories?: string[];
  excerpt?: string;
  image?: string;
  images?: string[];
  draft: boolean;
  hidden: boolean;
  visibility: string;
  url: string;
  content?: string;
  metadata: Record<string, any>;
  filePath: string;
}

export function getExodusRoot(): string {
  const custom = env.EXODUS_PATH || process.env.EXODUS_PATH;
  if (custom && fs.existsSync(custom)) return path.resolve(custom);

  const candidates = [
    'D:/v4/v5/project-exodus',
    'D:\\v4\\v5\\project-exodus',
    path.resolve(process.cwd(), '../../../project-exodus'),
    path.resolve(process.cwd(), '../../project-exodus'),
    path.resolve(process.cwd(), '../project-exodus')
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'src'))) {
      return path.resolve(cand);
    }
  }

  return 'D:/v4/v5/project-exodus';
}

export function getExodusPostsDir(): string {
  return path.join(getExodusRoot(), 'src', 'posts');
}

export function getExodusPagesDir(): string {
  return path.join(getExodusRoot(), 'src', 'pages');
}

export function parseExodusFile(filePath: string, isPage: boolean, includeContent: boolean = false): ExodusPost | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: metadata, content } = matter(raw);
    const filename = path.basename(filePath);

    let slug = filename.replace(/\.md$/, '');
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    let postDate = metadata.date;

    if (dateMatch) {
      if (!postDate) postDate = dateMatch[1];
      slug = dateMatch[2];
    }

    const category = metadata.category || '';
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];

    let docType: ExodusDocType = 'doc';
    if (isPage || category === 'legal') {
      docType = 'legal';
    } else if (category === 'whats-new' || categories.includes('whats-new') || category.toLowerCase().includes('changelog')) {
      docType = 'changelog';
    }

    let url = isPage ? (metadata.permalink || `/${slug}`) : (metadata.permalink || `/posts/${slug}`);
    if (docType === 'changelog') {
      url = `/changelog#${slug}`;
    }

    const id = `exodus:${isPage ? 'page' : 'post'}:${filename}`;

    return {
      id,
      scope: 'exodus',
      docType,
      filename,
      title: metadata.title || slug,
      slug,
      date: postDate ? String(postDate).split('T')[0] : undefined,
      category: category || (isPage ? 'legal' : docType === 'changelog' ? 'whats-new' : 'docs'),
      categories,
      excerpt: metadata.excerpt || '',
      image: metadata.image || metadata.cover || '',
      images: extractPostImagesList({
        image: metadata.image || metadata.cover,
        metadata,
        content
      }),
      draft: Boolean(metadata.draft),
      hidden: Boolean(metadata.hidden),
      visibility: metadata.visibility || 'public',
      url,
      ...(includeContent ? { content } : {}),
      metadata: JSON.parse(JSON.stringify(metadata)),
      filePath
    };
  } catch (err) {
    console.error(`[Exodus Content] Failed to parse ${filePath}:`, err);
    return null;
  }
}

export async function getAllExodusPosts(options: { type?: 'all' | 'changelog' | 'doc' | 'legal'; content?: boolean } = {}): Promise<ExodusPost[]> {
  const results: ExodusPost[] = [];
  const postsDir = getExodusPostsDir();
  const pagesDir = getExodusPagesDir();

  // Read src/posts
  if (fs.existsSync(postsDir)) {
    const postFiles = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
    for (const f of postFiles) {
      const parsed = parseExodusFile(path.join(postsDir, f), false, Boolean(options.content));
      if (parsed) {
        if (!options.type || options.type === 'all' || parsed.docType === options.type) {
          results.push(parsed);
        }
      }
    }
  }

  // Read src/pages (legal, about, etc.)
  if (fs.existsSync(pagesDir)) {
    const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md'));
    for (const f of pageFiles) {
      const parsed = parseExodusFile(path.join(pagesDir, f), true, Boolean(options.content));
      if (parsed) {
        if (!options.type || options.type === 'all' || options.type === 'legal') {
          results.push(parsed);
        }
      }
    }
  }

  return results.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });
}

export function getExodusPostById(id: string, includeContent: boolean = true): ExodusPost | null {
  const parts = id.split(':');
  if (parts[0] !== 'exodus') return null;

  const kind = parts[1]; // 'post' or 'page'
  const filename = parts[2];
  if (!filename) return null;

  const dir = kind === 'page' ? getExodusPagesDir() : getExodusPostsDir();
  const filePath = path.join(dir, filename);

  return parseExodusFile(filePath, kind === 'page', includeContent);
}

export async function saveExodusPost(payload: {
  id?: string;
  docType?: ExodusDocType;
  title: string;
  slug?: string;
  content: string;
  metadata?: Record<string, any>;
  savedByName?: string;
  savedByAvatar?: string;
}): Promise<{ success: boolean; id: string; filePath: string }> {
  let { id, docType = 'doc', title, slug, content, metadata = {}, savedByName, savedByAvatar } = payload;

  if (!title) throw new Error('Title is required');
  if (!slug) slug = slugify(title);

  let isPage = docType === 'legal';
  let targetDir = isPage ? getExodusPagesDir() : getExodusPostsDir();

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let filename = '';
  let existingFilePath = '';

  if (id && id.startsWith('exodus:')) {
    const parts = id.split(':');
    isPage = parts[1] === 'page';
    targetDir = isPage ? getExodusPagesDir() : getExodusPostsDir();
    filename = parts[2];
    existingFilePath = path.join(targetDir, filename);
  }

  const dateStr = metadata.date || new Date().toISOString().split('T')[0];

  if (!filename) {
    if (isPage) {
      filename = `${slug}.md`;
    } else {
      filename = `${dateStr}-${slug}.md`;
    }
  }

  const finalFilePath = path.join(targetDir, filename);

  // Backup / save old version in mongo post_versions if updating
  if (existingFilePath && fs.existsSync(existingFilePath)) {
    try {
      const oldRaw = fs.readFileSync(existingFilePath, 'utf-8');
      const { data: oldMeta, content: oldContent } = matter(oldRaw);
      const db = await getInsightroomDb();
      await db.collection('post_versions').insertOne({
        exodus_file: filename,
        scope: 'exodus',
        title: oldMeta.title || title,
        content: oldContent,
        metadata: oldMeta,
        updated_at: new Date(),
        saved_by_name: savedByName || 'Admin',
        saved_by_avatar: savedByAvatar || '',
        version_saved_at: new Date()
      });
    } catch (e) {
      console.warn('[Exodus Post Version Backup Warning]:', e);
    }
  }

  // Construct Frontmatter
  const finalCategory =
    metadata.category || (docType === 'changelog' ? 'whats-new' : docType === 'legal' ? 'legal' : 'docs');

  const frontmatter: Record<string, any> = {
    title,
    layout: 'post',
    ...(metadata.excerpt ? { excerpt: metadata.excerpt } : {}),
    ...(metadata.image ? { image: metadata.image } : {}),
    category: finalCategory,
    ...(docType === 'changelog' ? { categories: ['whats-new'] } : {}),
    ...(isPage ? { permalink: metadata.permalink || `/${slug}` } : {}),
    date: dateStr,
    ...(metadata.draft !== undefined ? { draft: Boolean(metadata.draft) } : {}),
    ...(metadata.hidden !== undefined ? { hidden: Boolean(metadata.hidden) } : {}),
    ...(metadata.no_ads !== undefined ? { 'no-ads': Boolean(metadata.no_ads) } : {}),
    ...(metadata.hide_author !== undefined ? { hide_author: Boolean(metadata.hide_author) } : {}),
    ...metadata
  };

  delete frontmatter.categories_list;

  const fileString = matter.stringify(content || '', frontmatter);
  fs.writeFileSync(finalFilePath, fileString, 'utf-8');

  const newId = `exodus:${isPage ? 'page' : 'post'}:${filename}`;
  return { success: true, id: newId, filePath: finalFilePath };
}

export async function deleteExodusPost(id: string): Promise<{ success: boolean }> {
  const parts = id.split(':');
  if (parts[0] !== 'exodus') throw new Error('Invalid Exodus post ID');

  const kind = parts[1];
  const filename = parts[2];
  const dir = kind === 'page' ? getExodusPagesDir() : getExodusPostsDir();
  const filePath = path.join(dir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return { success: true };
}
