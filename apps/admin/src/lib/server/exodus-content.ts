import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { env } from '$env/dynamic/private';
import { slugify, extractPostImagesList } from './insightroom-posts';
import { getDb, getInsightroomDb } from './mongo';

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
  filePath?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getExodusCollection() {
  const db = await getDb('materio');
  return db.collection('exodus_posts');
}

export function getExodusRoot(): string {
  const custom = env.EXODUS_PATH || process.env.EXODUS_PATH;
  if (custom && fs?.existsSync && fs.existsSync(custom)) return path.resolve(custom);

  const candidates = [
    'D:/v4/v5/project-exodus',
    'D:\\v4\\v5\\project-exodus',
    path.resolve(process.cwd(), '../../../project-exodus'),
    path.resolve(process.cwd(), '../../project-exodus'),
    path.resolve(process.cwd(), '../project-exodus')
  ];

  for (const cand of candidates) {
    try {
      if (fs?.existsSync && fs.existsSync(cand) && fs.existsSync(path.join(cand, 'src'))) {
        return path.resolve(cand);
      }
    } catch {}
  }

  return 'D:/v4/v5/project-exodus';
}

export function getExodusPostsDir(): string {
  return path.join(getExodusRoot(), 'src', 'posts');
}

export function getExodusPagesDir(): string {
  return path.join(getExodusRoot(), 'src', 'pages');
}

function mapDocToExodusPost(doc: any, includeContent: boolean = false): ExodusPost {
  const isPage = doc.docType === 'legal';
  const filename = doc.filename || `${doc.slug}.md`;
  const id = doc.id || `exodus:${isPage ? 'page' : 'post'}:${filename}`;
  const metadata = doc.metadata || {};

  return {
    id,
    scope: 'exodus',
    docType: (doc.docType as ExodusDocType) || 'doc',
    filename,
    title: doc.title || metadata.title || doc.slug,
    slug: doc.slug,
    date: doc.date ? String(doc.date).split('T')[0] : undefined,
    category: doc.category || (isPage ? 'legal' : doc.docType === 'changelog' ? 'whats-new' : 'docs'),
    categories: Array.isArray(doc.categories) ? doc.categories : metadata.categories || [],
    excerpt: doc.excerpt || metadata.excerpt || '',
    image: doc.image || metadata.image || metadata.cover || '',
    images: extractPostImagesList({
      image: doc.image || metadata.image || metadata.cover,
      metadata,
      content: doc.content
    }),
    draft: Boolean(doc.draft ?? metadata.draft),
    hidden: Boolean(doc.hidden ?? metadata.hidden),
    visibility: doc.visibility || metadata.visibility || 'public',
    url: doc.url || (isPage ? `/${doc.slug}` : doc.docType === 'changelog' ? `/changelog#${doc.slug}` : `/posts/${doc.slug}`),
    ...(includeContent ? { content: doc.content || '' } : {}),
    metadata,
    filePath: doc.filePath || filename,
    created_at: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
    updated_at: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined
  };
}

export async function getAllExodusPosts(options: { type?: 'all' | 'changelog' | 'doc' | 'legal'; content?: boolean } = {}): Promise<ExodusPost[]> {
  try {
    const col = await getExodusCollection();
    const query: Record<string, any> = {};
    if (options.type && options.type !== 'all') {
      query.docType = options.type;
    }

    const projection: Record<string, any> = {};
    if (!options.content) {
      projection.content = 0;
    }

    const docs = await col.find(query, { projection }).sort({ date: -1, _id: -1 }).toArray();

    return docs.map((doc) => mapDocToExodusPost(doc, Boolean(options.content)));
  } catch (err) {
    console.error('[Exodus Content] Error in getAllExodusPosts from Mongo:', err);
    return [];
  }
}

export async function getExodusPostById(id: string, includeContent: boolean = true): Promise<ExodusPost | null> {
  if (!id) return null;

  try {
    const col = await getExodusCollection();
    let query: Record<string, any>;

    if (id.startsWith('exodus:')) {
      const parts = id.split(':');
      const filename = parts[2];
      query = { $or: [{ id }, { filename }] };
    } else {
      query = { $or: [{ id }, { filename: id }, { slug: id }] };
    }

    const doc = await col.findOne(query);
    if (!doc) return null;

    return mapDocToExodusPost(doc, includeContent);
  } catch (err) {
    console.error(`[Exodus Content] Error in getExodusPostById for ${id}:`, err);
    return null;
  }
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
  let filename = '';

  if (id && id.startsWith('exodus:')) {
    const parts = id.split(':');
    isPage = parts[1] === 'page';
    filename = parts[2];
  }

  const dateStr = metadata.date || new Date().toISOString().split('T')[0];

  if (!filename) {
    if (isPage) {
      filename = `${slug}.md`;
    } else {
      filename = `${dateStr}-${slug}.md`;
    }
  }

  const newId = `exodus:${isPage ? 'page' : 'post'}:${filename}`;

  // 1. Save version snapshot to Mongo post_versions
  try {
    const prevPost = id ? await getExodusPostById(id, true) : null;
    if (prevPost) {
      const insightroomDb = await getInsightroomDb();
      await insightroomDb.collection('post_versions').insertOne({
        exodus_file: filename,
        scope: 'exodus',
        title: prevPost.title || title,
        content: prevPost.content || '',
        metadata: prevPost.metadata || {},
        updated_at: new Date(),
        saved_by_name: savedByName || 'Admin',
        saved_by_avatar: savedByAvatar || '',
        version_saved_at: new Date()
      });
    }
  } catch (backupErr) {
    console.warn('[Exodus Post Version Backup Warning]:', backupErr);
  }

  // 2. Construct clean frontmatter and URL
  const finalCategory =
    metadata.category || (docType === 'changelog' ? 'whats-new' : docType === 'legal' ? 'legal' : 'docs');

  const categories = docType === 'changelog' ? ['whats-new'] : Array.isArray(metadata.categories) ? metadata.categories : [];

  let url = isPage
    ? (metadata.permalink || `/${slug}`)
    : docType === 'changelog'
    ? `/changelog#${slug}`
    : (metadata.permalink || `/docs/${slug}`);

  const frontmatter: Record<string, any> = {
    title,
    layout: 'post',
    ...(metadata.excerpt ? { excerpt: metadata.excerpt } : {}),
    ...(metadata.image ? { image: metadata.image } : {}),
    category: finalCategory,
    ...(categories.length > 0 ? { categories } : {}),
    ...(isPage ? { permalink: metadata.permalink || `/${slug}` } : {}),
    date: dateStr,
    visibility: metadata.visibility || 'public',
    ...(metadata.draft !== undefined ? { draft: Boolean(metadata.draft) } : {}),
    ...(metadata.hidden !== undefined ? { hidden: Boolean(metadata.hidden) } : {}),
    ...(metadata.no_ads !== undefined ? { 'no-ads': Boolean(metadata.no_ads) } : {}),
    ...(metadata.hide_author !== undefined ? { hide_author: Boolean(metadata.hide_author) } : {}),
    ...metadata
  };

  delete frontmatter.categories_list;

  const coverImage = metadata.image || metadata.cover || '';
  const images = extractPostImagesList({
    image: coverImage,
    metadata: frontmatter,
    content
  });

  // 3. Upsert into MongoDB materio.exodus_posts
  const col = await getExodusCollection();
  const mongoDoc = {
    id: newId,
    scope: 'exodus',
    docType,
    filename,
    title,
    slug,
    date: dateStr,
    category: finalCategory,
    categories,
    excerpt: metadata.excerpt || '',
    image: coverImage,
    images,
    draft: Boolean(metadata.draft),
    hidden: Boolean(metadata.hidden),
    visibility: metadata.visibility || 'public',
    url,
    content: content || '',
    metadata: JSON.parse(JSON.stringify(frontmatter)),
    updated_at: new Date()
  };

  await col.updateOne(
    { filename },
    {
      $set: mongoDoc,
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true }
  );

  // 4. If running locally with local filesystem present, also update local file so git stays in sync
  try {
    const root = getExodusRoot();
    if (fs?.existsSync && fs.existsSync(root)) {
      const targetDir = isPage ? getExodusPagesDir() : getExodusPostsDir();
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const finalFilePath = path.join(targetDir, filename);
      const fileString = matter.stringify(content || '', frontmatter);
      fs.writeFileSync(finalFilePath, fileString, 'utf-8');
    }
  } catch (fsErr) {
    // Expected on Cloudflare Workers / serverless edge environments
  }

  return { success: true, id: newId, filePath: filename };
}

export async function deleteExodusPost(id: string): Promise<{ success: boolean }> {
  if (!id) throw new Error('Invalid Exodus post ID');

  const parts = id.split(':');
  const filename = parts.length >= 3 ? parts[2] : id;

  // 1. Delete from MongoDB
  const col = await getExodusCollection();
  await col.deleteOne({
    $or: [{ id }, { filename }, { slug: id }]
  });

  // 2. If running locally with local disk present, remove file
  try {
    const root = getExodusRoot();
    if (fs?.existsSync && fs.existsSync(root)) {
      const isPage = parts[1] === 'page';
      const dir = isPage ? getExodusPagesDir() : getExodusPostsDir();
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (fsErr) {
    // Expected in Cloudflare Workers
  }

  return { success: true };
}
