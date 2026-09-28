import fs from 'node:fs';
import path from 'node:path';
import { migrateLegacyOrganization } from '../server/organization-store.mjs';

const directory = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const storePath = path.join(directory, 'v79_store.json');
const identityPath = path.join(directory, 'pos-identity.json');

try {
  if (!fs.existsSync(storePath)) throw new Error('Hub store is missing.');
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  if (!Array.isArray(store.users)) throw new Error('Hub users are malformed.');
  if (store.organizations !== undefined && !Array.isArray(store.organizations)) throw new Error('Hub organizations are malformed.');
  if (store.memberships !== undefined && !Array.isArray(store.memberships)) throw new Error('Hub memberships are malformed.');

  const username = process.env.V79_HUB_ADMIN_USERNAME || 'admin';
  const configuredOwner = store.users.find(user => user.username?.toLowerCase() === username.toLowerCase() && user.role === 'admin');
  if (!configuredOwner) throw new Error('Configured Hub owner is missing from the store.');
  const identity = fs.existsSync(identityPath) ? JSON.parse(fs.readFileSync(identityPath, 'utf8')) : {
    organizationId: process.env.V79_POS_ORG_ID,
    ownerUserId: configuredOwner.id,
  };
  if (!identity.organizationId || !identity.ownerUserId) throw new Error('POS organization identity is missing.');
  if (identity.ownerUserId !== configuredOwner.id) throw new Error('POS owner differs from the configured Hub owner.');
  const result = migrateLegacyOrganization({ ...store, workspace: store.workspace || { companyName: store.settings?.companyName || 'V79 Digital' } }, identity.organizationId, identity.ownerUserId);
  console.log(`Organization preflight passed; migration ${result.changed ? 'required' : 'already present'}; users ${store.users.length}.`);
} catch (error) {
  console.error(`Organization preflight failed: ${error.message}`);
  process.exitCode = 1;
}
