import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyOrganization } from '../server/organization-store.mjs';

const owner = { id: 'owner-1', role: 'admin' };
const staff = { id: 'staff-1', role: 'staff' };

test('legacy migration preserves user identities and creates one explicit organization', () => {
  const source = { users: [owner, staff], workspace: { companyName: 'Existing Business' }, organizations: [], memberships: [] };
  const result = migrateLegacyOrganization(source, 'v79org_existing', owner.id);
  assert.equal(result.changed, true);
  assert.equal(result.organizations[0].id, 'v79org_existing');
  assert.equal(result.organizations[0].name, 'Existing Business');
  assert.deepEqual(result.memberships.map(member => [member.userId, member.role]), [['owner-1', 'owner'], ['staff-1', 'staff']]);
  assert.equal(source.organizations.length, 0);
  assert.equal(migrateLegacyOrganization({ ...source, ...result }, 'v79org_existing', owner.id).changed, false);
});

test('migration refuses a missing owner or inconsistent existing organization records', () => {
  const source = { users: [staff], workspace: { companyName: 'Existing Business' }, organizations: [], memberships: [] };
  assert.throws(() => migrateLegacyOrganization(source, 'v79org_existing', owner.id), /owner is missing/);
  assert.throws(() => migrateLegacyOrganization({ ...source, users: [owner], organizations: [{ id: 'another-org' }] }, 'v79org_existing', owner.id), /manual review/);
});
