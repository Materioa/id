const fs = require('fs');
const { execSync } = require('child_process');

const envContent = fs.readFileSync('.env', 'utf8');
const secrets = [
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'
];

for (const secret of secrets) {
  const match = envContent.match(new RegExp(`^${secret}=(.*)$`, 'm'));
  if (match) {
    const val = match[1].trim();
    console.log(`Uploading secret: ${secret}...`);
    try {
      execSync(`bunx wrangler secret put ${secret}`, {
        input: val,
        stdio: ['pipe', 'inherit', 'inherit']
      });
      console.log(`Successfully uploaded ${secret}.`);
    } catch (e) {
      console.error(`Failed to upload ${secret}:`, e.message);
    }
  }
}
