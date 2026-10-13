import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not found');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db('materio');

const changelogs = await db.collection('exodus_posts').find({ docType: 'changelog' }).toArray();
for (const post of changelogs) {
  const newUrl = `/changelog/${post.slug}`;
  await db.collection('exodus_posts').updateOne(
    { _id: post._id },
    { $set: { url: newUrl } }
  );
  console.log(`Updated ${post.slug} -> ${newUrl}`);
}

await client.close();
console.log('Finished updating changelog URLs');
