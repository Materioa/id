import { getInsightroomDb } from './mongo';
import { ObjectId } from 'mongodb';

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Returns the URL for a post row.
 */
export function getPostUrl(row: any): string {
  const metadata = row.metadata || {};
  if (metadata.permalink) {
    let permalink = metadata.permalink;
    permalink = permalink.replace(/:slug/gi, row.slug || '');
    permalink = permalink.replace(/:title/gi, row.slug || '');
    permalink = permalink.replace(/:category/gi, row.categorySlug || '');
    permalink = permalink.replace(/\/\/+/g, '/');
    return permalink.startsWith('/') ? permalink : `/${permalink}`;
  }
  return row.categorySlug ? `/${row.categorySlug}/${row.slug}` : `/${row.slug}`;
}

export function extractPostImagesList(row: any): string[] {
  const list: string[] = [];
  const cover = row.image || row.metadata?.image || row.metadata?.cover;
  if (cover && typeof cover === 'string') list.push(cover);

  if (Array.isArray(row.images)) {
    for (const img of row.images) {
      if (typeof img === 'string' && img && !list.includes(img)) list.push(img);
    }
  }

  if (Array.isArray(row.metadata?.images)) {
    for (const img of row.metadata.images) {
      if (typeof img === 'string' && img && !list.includes(img)) list.push(img);
    }
  }

  const content = row.content;
  if (content && typeof content === 'string') {
    const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(content)) !== null) {
      if (!list.includes(match[1])) list.push(match[1]);
    }
    const htmlRegex = /<img[^>]+src=["'](https?:\/\/[^"']+|\/[^"']+)["']/g;
    while ((match = htmlRegex.exec(content)) !== null) {
      if (!list.includes(match[1])) list.push(match[1]);
    }
  }

  return list;
}

export function toPost(row: any, options: { content?: boolean } = {}) {
  const metadata = row.metadata || {};

  return {
    id: row._id?.toString() || row.id || '',
    slug: row.slug || '',
    categorySlug: row.categorySlug || '',
    date: row.date ? String(row.date).split('T')[0] : '',
    url: getPostUrl(row),
    metadata,
    images: extractPostImagesList(row),
    ...(options.content === false ? {} : { content: row.content || '' }),
    hidden: Boolean(row.hidden),
    draft: Boolean(row.draft),
    visibility: row.visibility || 'public',
    category: row.category || '',
    categories: Array.isArray(metadata.categories) ? metadata.categories : [],
    title: row.title || '',
    excerpt: row.excerpt || metadata.excerpt || '',
    image: row.image || metadata.image || '',
    claps: Number(row.claps) || 0,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
  };
}

export async function getPostsCollection() {
  const db = await getInsightroomDb();
  return db.collection('posts');
}

export async function getAllPosts(options: { content?: boolean } = { content: false }) {
  const collection = await getPostsCollection();
  const rows = await collection
    .find({})
    .sort({ date: -1, _id: -1 })
    .toArray();

  return rows.map((row) => toPost(row, options));
}

export async function getPost(categorySlug: string, slug: string) {
  const normalizedCategory = slugify(categorySlug);
  const collection = await getPostsCollection();
  const row = await collection.findOne({ categorySlug: normalizedCategory, slug });
  if (!row) return undefined;
  return toPost(row);
}

export async function getPostById(id: string) {
  const collection = await getPostsCollection();
  let row = null;
  try {
    row = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    row = await collection.findOne({ slug: id });
  }
  if (!row) return undefined;
  return toPost(row);
}

export async function getPostByPermalink(permalink: string) {
  const collection = await getPostsCollection();
  const permalinkNoSlash = permalink.replace(/^\/+/, '');
  const permalinkWithSlash = '/' + permalinkNoSlash;

  const row = await collection.findOne({
    $or: [
      { 'metadata.permalink': permalink },
      { 'metadata.permalink': permalinkNoSlash },
      { 'metadata.permalink': permalinkWithSlash },
      { slug: permalinkNoSlash }
    ]
  });

  if (!row) return undefined;
  return toPost(row);
}
