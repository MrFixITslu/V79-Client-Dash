import test from 'node:test';
import assert from 'node:assert/strict';
import { activeMembership, legacyWorkspaceAccess, validLegacyLaunch } from '../server/organization-access.mjs';

const store = {
  organizations: [{ id: 'v79', status: 'active' }, { id: 'business-b', status: 'active' }],
  memberships: [
    { organizationId: 'v79', userId: 'owner-a', role: 'owner', status: 'active' },
    { organizationId: 'business-b', userId: 'owner-b', role: 'owner', status: 'active' },
    { organizationId: 'v79', userId: 'revoked', role: 'staff', status: 'revoked' },
  ],
};

test('a second business cannot enter the legacy global workspace', () => {
  assert.equal(legacyWorkspaceAccess(store, 'owner-a', 'v79', 'v79')?.role, 'owner');
  assert.equal(legacyWorkspaceAccess(store, 'owner-b', 'business-b', 'v79'), null);
  assert.equal(legacyWorkspaceAccess(store, 'owner-b', 'v79', 'v79'), null);
  assert.equal(legacyWorkspaceAccess(store, 'revoked', 'v79', 'v79'), null);
});

test('launch tickets require the active owner and exact legacy tenant', () => {
  const entry = (userId, tenantId) => ({ userId, tenantId, product: 'pos', expiresAt: Date.now() + 60000 });
  assert.equal(validLegacyLaunch(store, entry('owner-a', 'v79'), 'pos', 'v79', 'owner-a'), true);
  assert.equal(validLegacyLaunch(store, entry('owner-b', 'business-b'), 'pos', 'v79', 'owner-a'), false);
  assert.equal(validLegacyLaunch(store, entry('owner-a', 'business-b'), 'pos', 'v79', 'owner-a'), false);
  assert.equal(validLegacyLaunch(store, entry('owner-a', 'v79'), 'tiquet', 'v79', 'owner-a'), false);
  assert.equal(activeMembership(store, 'revoked', 'v79'), null);
  store.organizations[0].status = 'suspended';
  assert.equal(validLegacyLaunch(store, entry('owner-a', 'v79'), 'pos', 'v79', 'owner-a'), false);
});

import { enabledAppIds, organizationCanAccessApp } from "../server/organization-access.mjs";

test("organization app entitlements fail closed and expose only enabled apps", () => {
  const entitledStore = {
    ...store,
    organizations: [{ id: "v79", status: "active" }, { id: "business-b", status: "active" }],
    appEntitlements: [
      { organizationId: "v79", appId: "app-pos", enabled: true },
      { organizationId: "v79", appId: "app-marketing", enabled: false },
      { organizationId: "business-b", appId: "app-tiquet", enabled: true },
    ],
  };
  assert.deepEqual(enabledAppIds(entitledStore, "v79"), ["app-pos"]);
  assert.equal(organizationCanAccessApp(entitledStore, "v79", "app-pos"), true);
  assert.equal(organizationCanAccessApp(entitledStore, "v79", "app-tiquet"), false);
  assert.deepEqual(enabledAppIds({ ...entitledStore, appEntitlements: [] }, "v79"), []);
});