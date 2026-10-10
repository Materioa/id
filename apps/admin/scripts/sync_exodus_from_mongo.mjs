import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { MongoClient } from 'mongodb';

try {
  const dns = await import('node:dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const uri = process.env.MONGODB_URI || 'mongodb+srv://jinansh:admin132@cluster0.ckjs3v9.mongodb.net/?appName=Cluster0';
const client = new MongoClient(uri);

const exodusRoot = 'D:/v4/v5/project-exodus';
const postsDir = path.join(exodusRoot, 'src', 'posts');
const pagesDir = path.join(exodusRoot, 'src', 'pages');

async function sync() {
  console.log('[sync_exodus_from_mongo] Connecting to MongoDB...');
  await client.connect();
  const db = client.db('materio');
  const collection = db.collection('exodus_posts');

  const docs = await collection.find({}).toArray();
  console.log(`[sync_exodus_from_mongo] Found ${docs.length} posts in materio.exodus_posts.`);

  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });
  if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });

  let written = 0;
  for (const doc of docs) {
    const isPage = doc.docType === 'legal';
    const targetDir = isPage ? pagesDir : postsDir;
    const filename = doc.filename || `${doc.slug}.md`;
    const filePath = path.join(targetDir, filename);

    const frontmatter = {
      ...(doc.metadata || {}),
      title: doc.title,
      layout: doc.metadata?.layout || 'post',
      date: doc.date,
      category: doc.category,
      draft: Boolean(doc.draft),
      hidden: Boolean(doc.hidden),
      visibility: doc.visibility || 'public'
    };

    if (doc.excerpt) frontmatter.excerpt = doc.excerpt;
    if (doc.image) frontmatter.image = doc.image;
    if (doc.url && isPage) frontmatter.permalink = doc.url;
    if (Array.isArray(doc.categories) && doc.categories.length > 0) frontmatter.categories = doc.categories;

    const fileContent = matter.stringify(doc.content || '', frontmatter);
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    written++;
  }

  console.log(`[sync_exodus_from_mongo] Successfully synchronized ${written} posts from MongoDB.`);
  await client.close();
}

sync().catch((err) => {
  console.error('[sync_exodus_from_mongo] Error:', err);
});
