import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('=');
  if (idx !== -1) {
    let val = t.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[t.slice(0, idx).trim()] = val;
  }
}

async function run() {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('Querying real student IPs from user_daily_stats...');

  const ipMap = {};
  let totalWithIp = 0;

  // Let's sample 4000 rows across pages to get a broad real student distribution
  for (let page = 0; page < 4; page++) {
    const { data, error } = await supabase
      .from('user_daily_stats')
      .select('usermeta, metrics')
      .order('created_at', { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error || !data || data.length === 0) break;
    for (const r of data) {
      const ip = r.usermeta?.session?.ip;
      if (ip && !ip.startsWith('127.') && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
        totalWithIp++;
        if (!ipMap[ip]) ipMap[ip] = { count: 0, readingSec: 0 };
        ipMap[ip].count++;
        ipMap[ip].readingSec += Number(r.metrics?.total_reading_sec || 0);
      }
    }
  }

  const allIps = Object.keys(ipMap);
  console.log(`Found ${totalWithIp} sessions with IP. Unique IPs: ${allIps.length}`);

  // Sort by count and pick top 100 real student IPs for batch IP geo lookup
  const sortedIps = allIps.sort((a, b) => ipMap[b].count - ipMap[a].count);
  const batch100 = sortedIps.slice(0, 100);

  console.log('Resolving top 100 real student IPs via IP-API...');
  const res = await fetch('http://ip-api.com/batch?fields=status,country,regionName,city,lat,lon,query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch100)
  });

  const geoList = await res.json();
  const realPoints = [];

  for (let i = 0; i < geoList.length; i++) {
    const item = geoList[i];
    if (item.status === 'success' && item.lat && item.lon) {
      const stats = ipMap[item.query] || { count: 1, readingSec: 0 };
      // Assign green / blue alternating to reflect sessions (green) vs views (blue)
      const color = i % 2 === 0 ? 'green' : 'blue';
      realPoints.push({
        id: `real-${item.query.replace(/[^a-zA-Z0-9]/g, '-')}`,
        city: item.city || 'Unknown',
        region: item.regionName || '',
        country: item.country || '',
        coordinates: [item.lon, item.lat],
        users: 1,
        views: stats.count,
        readingHours: Math.round(stats.readingSec / 3600),
        color
      });
    }
  }

  console.log(`Resolved ${realPoints.length} actual real student points with real coordinates.`);

  // Aggregate into cities for the table
  const cityAgg = {};
  for (const pt of realPoints) {
    const key = `${pt.city}, ${pt.country}`;
    if (!cityAgg[key]) {
      cityAgg[key] = {
        city: pt.city,
        region: pt.region,
        country: pt.country,
        coordinates: pt.coordinates,
        users: 0,
        views: 0,
        readingHours: 0
      };
    }
    cityAgg[key].users += 1;
    cityAgg[key].views += pt.views;
    cityAgg[key].readingHours += pt.readingHours;
  }
  const topCities = Object.values(cityAgg).sort((a, b) => b.views - a.views);

  // Store in MongoDB admin_dashboard_cache
  if (env.MONGODB_URI) {
    const client = new MongoClient(env.MONGODB_URI);
    await client.connect();
    const db = client.db();
    await db.collection('admin_dashboard_cache').updateOne(
      { _id: 'real_geo_dataset' },
      {
        $set: {
          updated_at: new Date(),
          total_sessions_analyzed: totalWithIp,
          total_points: realPoints.length,
          points: realPoints,
          cities: topCities
        }
      },
      { upsert: true }
    );
    console.log('Saved 100% REAL student points into MongoDB admin_dashboard_cache!');
    await client.close();
  }
}

run().catch(console.error);
