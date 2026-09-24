#!/usr/bin/env node
// Run inside the Hub container as a trusted server operator. Never pass a password on the command line.
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import { stdin, stdout } from 'node:process';

const email = String(process.env.V79_HUB_ADMIN_EMAIL || '').trim().toLowerCase();
if (!email) {
  console.error('Set V79_HUB_ADMIN_EMAIL to the existing owner email before recovery.');
  process.exit(1);
}

async function readPassword() {
  if (!stdin.isTTY) {
    let value = '';
    for await (const chunk of stdin) {
      value += chunk;
      if (value.length > 257) throw new Error('Password is too long.');
    }
    return value.replace(/\r?\n$/, '');
  }
  stdout.write('New owner password (input hidden): ');
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    const done = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    };
    const onData = (chunk) => {
      for (const char of String(chunk)) {
        if (char === '\u0003') return done(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return done();
        if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
        else if (char >= ' ' && password.length <= 256) password += char;
      }
    };
    stdin.on('data', onData);
  });
}

try {
  const password = await readPassword();
  if (password.length < 16 || password.length > 256) throw new Error('Use a password of 16–256 characters.');
  const db = new Database(path.join(path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data')), 'v79-hub.db'), { fileMustExist: true });
  try {
    const owner = db.prepare(`SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id
      WHERE u.email=? AND m.role='owner' LIMIT 1`).get(email);
    if (!owner) throw new Error('The configured email does not belong to an existing Hub owner. No account was changed.');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    db.transaction(() => {
      db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').run(salt, hash, owner.id);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(owner.id);
      db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(owner.id);
      db.prepare('DELETE FROM mfa_challenges WHERE user_id=?').run(owner.id);
      db.prepare('DELETE FROM app_launch_tickets WHERE user_id=?').run(owner.id);
    })();
    console.log(`Owner password reset for ${email}; existing sessions and pending login links were revoked.`);
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
