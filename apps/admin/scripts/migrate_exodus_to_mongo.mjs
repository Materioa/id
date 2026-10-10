import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { MongoClient } from 'mongodb';

try {
  const dns = await import('node:dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const uri = 'mongodb+srv://jinansh:admin132@cluster0.ckjs3v9.mongodb.net/?appName=Cluster0';
const client = new MongoClient(uri);

function extractImages(content, cover, metadata) {
  const list = [];
  if (cover) list.push(cover);
  if (metadata?.cover && !list.includes(metadata.cover)) list.push(metadata.cover);
  if (metadata?.image && !list.includes(metadata.image)) list.push(metadata.image);
  if (Array.isArray(metadata?.images)) {
    for (const img of metadata.images) {
      if (typeof img === 'string' && img && !list.includes(img)) list.push(img);
    }
  }
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

async function migrate() {
  await client.connect();
  const db = client.db('materio');
  const collection = db.collection('exodus_posts');

  await collection.createIndex({ filename: 1 }, { unique: true });
  await collection.createIndex({ slug: 1 });
  await collection.createIndex({ docType: 1 });
  await collection.createIndex({ date: -1 });

  const postsDir = 'D:/v4/v5/project-exodus/src/posts';
  const pagesDir = 'D:/v4/v5/project-exodus/src/pages';

  const allFiles = [];

  if (fs.existsSync(postsDir)) {
    for (const f of fs.readdirSync(postsDir).filter(x => x.endsWith('.md'))) {
      allFiles.push({ filePath: path.join(postsDir, f), isPage: false, filename: f });
    }
  }

  if (fs.existsSync(pagesDir)) {
    for (const f of fs.readdirSync(pagesDir).filter(x => x.endsWith('.md'))) {
      allFiles.push({ filePath: path.join(pagesDir, f), isPage: true, filename: f });
    }
  }

  console.log(`Found ${allFiles.length} Exodus markdown files to migrate.`);

  let inserted = 0;
  let updated = 0;

  for (const { filePath, isPage, filename } of allFiles) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: metadata, content } = matter(raw);

    let slug = filename.replace(/\.md$/, '');
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    let postDate = metadata.date;

    if (dateMatch) {
      if (!postDate) postDate = dateMatch[1];
      slug = dateMatch[2];
    }

    const category = metadata.category || '';
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];

    let docType = 'doc';
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
    const coverImage = metadata.image || metadata.cover || '';
    const images = extractImages(content, coverImage, metadata);

    const doc = {
      id,
      scope: 'exodus',
      docType,
      filename,
      title: metadata.title || slug,
      slug,
      date: postDate ? String(postDate).split('T')[0] : new Date().toISOString().split('T')[0],
      category: category || (isPage ? 'legal' : docType === 'changelog' ? 'whats-new' : 'docs'),
      categories,
      excerpt: metadata.excerpt || '',
      image: coverImage,
      images,
      draft: Boolean(metadata.draft),
      hidden: Boolean(metadata.hidden),
      visibility: metadata.visibility || 'public',
      url,
      content,
      metadata: JSON.parse(JSON.stringify(metadata)),
      updated_at: new Date(),
      migrated_at: new Date()
    };

    const res = await collection.updateOne(
      { filename },
      {
        $set: doc,
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true }
    );

    if (res.upsertedCount > 0) {
      inserted++;
      console.log(`[Inserted] ${filename} (${docType}) -> "${doc.title}"`);
    } else {
      updated++;
      console.log(`[Updated]  ${filename} (${docType}) -> "${doc.title}"`);
    }
  }

  const total = await collection.countDocuments();
  console.log(`\nMigration complete! Inserted: ${inserted}, Updated: ${updated}, Total in DB: ${total}`);

  await client.close();
}

migrate().catch(console.error);
