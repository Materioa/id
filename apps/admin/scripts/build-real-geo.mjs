import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
}

async function run() {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch batches of user_daily_stats to get top unique IPs
  console.log('Fetching records from user_daily_stats...');
  let allIps = {};
  let page = 0;
  const pageSize = 1000;
  let totalWithIp = 0;

  // Let's sample 3000 recent records
  while (page < 3) {
    const { data, error } = await supabase
      .from('user_daily_stats')
      .select('usermeta, metrics, date')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    for (const r of data) {
      const ip = r.usermeta?.session?.ip;
      if (ip && !ip.startsWith('127.') && !ip.startsWith('192.168.')) {
        totalWithIp++;
        const readingSec = Number(r.metrics?.total_reading_sec || 0);
        if (!allIps[ip]) allIps[ip] = { count: 0, readingSec: 0, lastDate: r.date };
        allIps[ip].count++;
        allIps[ip].readingSec += readingSec;
      }
    }
    page++;
  }

  console.log(`Total sessions with valid IP: ${totalWithIp}, Unique IPs: ${Object.keys(allIps).length}`);
  const sortedIps = Object.entries(allIps).sort((a, b) => b[1].count - a[1].count);
  console.log('Top 20 IPs by session count:', sortedIps.slice(0, 20).map(x => `${x[0]}: ${x[1].count} sessions`));

  // Batch resolve top 100 IPs
  const top100Ips = sortedIps.slice(0, 100).map(x => x[0]);
  console.log(`Resolving top ${top100Ips.length} IPs...`);

  // IP-API batch allows 100 queries per request
  const res = await fetch('http://ip-api.com/batch?fields=status,country,regionName,city,lat,lon,query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(top100Ips)
  });

  const geoBatch = await res.json();
  const cityAgg = {};

  for (const item of geoBatch) {
    if (item.status === 'success' && item.city) {
      const key = `${item.city}, ${item.country}`;
      const ipStats = allIps[item.query] || { count: 1, readingSec: 0 };
      if (!cityAgg[key]) {
        cityAgg[key] = {
          city: item.city,
          region: item.regionName,
          country: item.country,
          coordinates: [item.lon, item.lat],
          users: 0,
          views: 0,
          readingHours: 0
        };
      }
      cityAgg[key].users += 1;
      cityAgg[key].views += ipStats.count;
      cityAgg[key].readingHours += Math.round(ipStats.readingSec / 3600);
    }
  }

  const finalCityList = Object.values(cityAgg).sort((a, b) => b.views - a.views);
  console.log('--- Real Cities Aggregated from Real Dataset ---');
  console.log(JSON.stringify(finalCityList.slice(0, 15), null, 2));

  // Save this real dataset to MongoDB
  if (env.MONGODB_URI) {
    const client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    await db.collection('admin_dashboard_cache').updateOne(
      { _id: 'real_geo_dataset' },
      {
        $set: {
          updated_at: new Date(),
          total_mapped_sessions: totalWithIp,
          cities: finalCityList
        }
      },
      { upsert: true }
    );
    console.log('Saved real_geo_dataset into MongoDB admin_dashboard_cache successfully!');
    await client.close();
  }
}

run().catch(console.error);
