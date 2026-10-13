import { createClient } from '@supabase/supabase-js';
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
  const { data: rows } = await supabase
    .from('user_daily_stats')
    .select('usermeta')
    .order('created_at', { ascending: false })
    .limit(500);

  const ipCounts = {};
  for (const r of rows || []) {
    const ip = r.usermeta?.session?.ip;
    if (ip) {
      ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    }
  }

  const uniqueIps = Object.keys(ipCounts);
  console.log(`Found ${uniqueIps.length} unique IPs in recent 500 records`);
  console.log('Top IPs sample:', Object.entries(ipCounts).slice(0, 10));

  // Let's test resolving 5 IPs using a public free IP geo service (e.g. ip-api.com batch or geoip-lite if present)
  const sampleBatch = uniqueIps.slice(0, 5);
  try {
    const res = await fetch('http://ip-api.com/batch?fields=status,country,city,lat,lon,query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleBatch)
    });
    const geoResults = await res.json();
    console.log('Geo results from real IPs:', JSON.stringify(geoResults, null, 2));
  } catch (err) {
    console.log('IP geo lookup notice:', err.message);
  }
}

run();
