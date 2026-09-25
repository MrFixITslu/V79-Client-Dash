#!/usr/bin/env node
// Trusted server operator action. This records a reviewed commercial decision;
// it does not charge a card or create a payment transaction.
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';

const args = process.argv.slice(2);
const value = flag => { const i=args.indexOf(flag); return i < 0 ? '' : String(args[i+1] || '').trim(); };
const organizationId=value('--organization-id');
const status=value('--status');
const reason=value('--reason');
const apply=args.includes('--apply');
if (!/^v79org_[0-9a-f-]{36}$/.test(organizationId) || !['paid','suspended'].includes(status) || reason.length < 10 || reason.length > 240) {
  console.error('Usage: node scripts/convert-pos-account.mjs --organization-id v79org_UUID --status paid|suspended --reason "reviewed payment/contract reference" [--apply]');
  process.exit(2);
}

const db = new Database(path.join(path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data')), 'v79-hub.db'), { fileMustExist: true });
try {
  const org=db.prepare(`SELECT o.id,o.name,p.status FROM organizations o
    LEFT JOIN pos_access p ON p.organization_id=o.id WHERE o.id=?`).get(organizationId);
  if (!org || !org.status) throw new Error('Organisation is not registered for POS. No change made.');
  console.log(JSON.stringify({ organizationId:org.id, organization:org.name, current:org.status, requested:status, reason, apply },null,2));
  if (!apply) { console.log('Dry run only. Pass --apply after reviewing the account and commercial record.'); process.exit(0); }
  if (org.status === status) { console.log('Already in requested state. No change made.'); process.exit(0); }
  const now=new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE pos_access SET status=?,updated_at=? WHERE organization_id=?').run(status,now,organizationId);
    db.prepare(`INSERT INTO audit_log(id,organization_id,actor_user_id,event_type,target_type,target_id,details_json,created_at)
      VALUES(?,?,NULL,'pos.access_changed','product','pos',?,?)`)
      .run(crypto.randomUUID(),organizationId,JSON.stringify({from:org.status,to:status,reason,operator:'server-cli'}),now);
  })();
  console.log(`POS access changed from ${org.status} to ${status}. Organisation and user IDs were preserved.`);
} catch(error) {
  console.error(error.message || String(error));
  process.exitCode=1;
} finally { db.close(); }
