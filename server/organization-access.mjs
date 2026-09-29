// The Hub JSON workspace currently belongs to the migrated V79 organization.
// Any other organization must fail closed until its workspace and app mappings exist.
export function activeMembership(store, userId, organizationId) {
  const organization = store.organizations.find(org => org.id === organizationId && org.status === 'active');
  if (!organization) return null;
  return store.memberships.find(member => member.userId === userId && member.organizationId === organizationId && member.status === 'active') || null;
}

export function legacyWorkspaceAccess(store, userId, organizationId, legacyOrganizationId) {
  return organizationId === legacyOrganizationId
    ? activeMembership(store, userId, organizationId)
    : null;
}

export function validLegacyLaunch(store, entry, product, legacyOrganizationId, ownerUserId) {
  const appId = { pos: 'app-v79pos', ffpro: 'app-ffpro', tiquet: 'app-tiquet', marketing: 'app-marketing' }[product];
  return Boolean(appId && entry && entry.product === product && entry.expiresAt >= Date.now() &&
    entry.tenantId === legacyOrganizationId && entry.userId === ownerUserId &&
    activeMembership(store, entry.userId, entry.tenantId)?.role === 'owner' &&
    organizationCanAccessApp(store, entry.tenantId, appId));
}


export function enabledAppIds(store, organizationId) {
  const organization = store.organizations.find(org => org.id === organizationId && org.status === 'active');
  if (!organization) return [];
  return (store.appEntitlements || [])
    .filter(entry => entry.organizationId === organizationId && entry.enabled === true)
    .map(entry => entry.appId);
}

export function organizationCanAccessApp(store, organizationId, appId) {
  return enabledAppIds(store, organizationId).includes(appId);
}
