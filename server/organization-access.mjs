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
  return Boolean(entry && entry.product === product && entry.expiresAt >= Date.now() &&
    entry.tenantId === legacyOrganizationId && entry.userId === ownerUserId &&
    activeMembership(store, entry.userId, entry.tenantId)?.role === 'owner');
}
