#!/usr/bin/env node
// Read-only contract probe from the Hub container on proxy_network.
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'node:path';
import { signPlatformRequest } from '../server/platform-contract.mjs';

const products = {
  ffpro: { url:'FFPRO_BASE_URL', defaultUrl:'http://fire-finance-app:3010', health:'/api/health' },
  tiquet: { url:'TIQUET_BASE_URL', defaultUrl:'http://v79-tiquet-manager:3050', health:'/health' },
  marketing: { url:'MARKETING_BASE_URL', defaultUrl:'http://v79marketing-app:3070', health:'/api/health' },
  academy: { url:'ACADEMY_BASE_URL', defaultUrl:'http://v79_course_builder:3030', health:'/healthz' },
};
const only = process.argv.indexOf('--only');
const selected = only < 0 ? Object.keys(products) : [process.argv[only + 1]];
if (selected.some(name => !products[name]) || (only >= 0 && selected.length !== 1)) {
  console.error('Usage: node scripts/check-integrations.mjs [--only ffpro|tiquet|marketing|academy] [--require-records]');
  process.exit(2);
}
const strict = process.argv.includes('--require-records');
const secret = String(process.env.V79_PLATFORM_SHARED_SECRET || '');
if (secret.length < 32) { console.error('Platform shared secret is missing or too short.'); process.exit(1); }
const directory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(),'data'));
let db;
try {
  db = new Database(path.join(directory,'v79-hub.db'),{readonly:true,fileMustExist:true});
  const owner = db.prepare(`SELECT o.id AS organizationId,u.email FROM users u
    JOIN memberships m ON m.user_id=u.id AND m.role='owner'
    JOIN organizations o ON o.id=m.organization_id
    WHERE u.email=? LIMIT 1`).get(String(process.env.V79_HUB_ADMIN_EMAIL || '').trim().toLowerCase());
  if (!owner) throw new Error('Configured owner and organization not found in the Hub database.');
  let failed = false;
  for (const name of selected) {
    const product = products[name];
    const base = process.env[product.url] || product.defaultUrl;
    const subject = name === 'academy' ? owner.email : owner.organizationId;
    const pathname = `/api/platform/summary/${encodeURIComponent(subject)}`;
    const timestamp=String(Date.now());
    try {
      const health=await fetch(new URL(product.health,base),{signal:AbortSignal.timeout(5000)});
      if (!health.ok) throw new Error(`health HTTP ${health.status}`);
      const summary=await fetch(new URL(pathname,base),{headers:{
        'x-v79-service-id':'v79-hub','x-v79-timestamp':timestamp,
        'x-v79-signature':signPlatformRequest({method:'GET',pathname,timestamp,body:'',secret}),
      },signal:AbortSignal.timeout(5000)});
      if (summary.status!==200 && !(summary.status===404 && (!strict || name==='academy'))) {
        throw new Error(`signed summary HTTP ${summary.status}`);
      }
      console.log(`${name}: healthy; signed summary HTTP ${summary.status}${summary.status===404?' (record not yet present)':''}`);
    } catch (error) {
      failed = true;
      console.error(`${name}: FAIL ${error.message || 'unreachable'}`);
    }
  }
  if(failed) process.exitCode=1;
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode=1;
} finally {
  db?.close();
}
