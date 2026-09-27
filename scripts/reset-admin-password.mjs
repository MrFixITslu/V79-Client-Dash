import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Run in a stopped Hub container with its usual .env and data volume mounted.
const password = process.env.V79_HUB_ADMIN_PASSWORD || '';
const username = process.env.V79_HUB_ADMIN_USERNAME || 'admin';
if (password.length < 16) throw new Error('Set a unique V79_HUB_ADMIN_PASSWORD of at least 16 characters in the server .env first.');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const file = path.join(dataDir, 'v79_store.json');
const store = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(store.users)) throw new Error('Hub users are missing from the data file.');
const user = store.users.find(row => row.username?.toLowerCase() === username.toLowerCase() && row.role === 'admin');
if (!user) throw new Error(`The configured administrator ${username} was not found. No data was changed.`);
const backup = `${file}.before-password-reset-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
fs.chmodSync(backup, 0o600);
const salt = crypto.randomBytes(16).toString('hex');
user.password = `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const temp = `${file}.reset-${process.pid}`;
try {
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
} finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
console.log(`Password reset for ${username}. A private backup was saved beside the data file. Start Hub again to revoke old sessions.`);
