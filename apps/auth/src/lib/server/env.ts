import fs from 'node:fs';
import path from 'node:path';
import { env } from '$env/dynamic/private';

/**
 * Returns an environment variable with real-time reload from local .env in development
 * so updates take effect immediately without requiring a full dev server restart.
 */
export function getFreshEnv(key: string): string {
  try {
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'apps/auth/.env'),
      path.resolve(process.cwd(), '../auth/.env'),
      path.resolve(process.cwd(), '../../apps/auth/.env')
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.slice(0, idx).trim();
            let v = trimmed.slice(idx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            if (k === key && v && !v.includes('your-github')) {
              return v;
            }
          }
        }
      }
    }
  } catch {}
  return (env as Record<string, string | undefined>)[key] || process.env[key] || '';
}
