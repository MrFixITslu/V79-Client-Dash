import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

test('offline owner recovery revokes active access without changing MFA or another account', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'v79-owner-recovery-'));
  try {
    const db = new Database(path.join(directory, 'v79-hub.db'));
    db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,password_salt TEXT,password_hash TEXT);
      CREATE TABLE memberships(user_id TEXT,role TEXT);
      CREATE TABLE sessions(user_id TEXT);
      CREATE TABLE account_tokens(user_id TEXT);
      CREATE TABLE mfa_challenges(user_id TEXT);
      CREATE TABLE app_launch_tickets(user_id TEXT);
      CREATE TABLE mfa_totp(user_id TEXT,secret TEXT);`);
    const old = crypto.scryptSync('previous-password-123', 'oldsalt', 64).toString('hex');
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('owner','owner@example.test','oldsalt',old);
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('other','other@example.test','oldsalt',old);
    db.prepare('INSERT INTO memberships VALUES(?,?)').run('owner','owner');
    db.prepare('INSERT INTO memberships VALUES(?,?)').run('other','member');
    for (const table of ['sessions','account_tokens','mfa_challenges','app_launch_tickets']) db.prepare(`INSERT INTO ${table} VALUES(?)`).run('owner');
    db.prepare('INSERT INTO mfa_totp VALUES(?,?)').run('owner','encrypted-value');
    const result = spawnSync(process.execPath, ['scripts/recover-owner.mjs'], {
      cwd: path.resolve('.'),
      env: { ...process.env, DATA_DIR: directory, V79_HUB_ADMIN_EMAIL:'owner@example.test' },
      input: 'new-safe-password-123\n', encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /new-safe-password-123/);
    const updated = db.prepare('SELECT password_salt,password_hash FROM users WHERE id=?').get('owner');
    assert.equal(updated.password_hash, crypto.scryptSync('new-safe-password-123',updated.password_salt,64).toString('hex'));
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=?').get('other').password_hash, old);
    for (const table of ['sessions','account_tokens','mfa_challenges','app_launch_tickets']) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
    assert.equal(db.prepare('SELECT secret FROM mfa_totp WHERE user_id=?').get('owner').secret, 'encrypted-value');
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
