export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function hasOwnerAssistantAccess({
  user,
  membership,
  organizationId,
  ownerOrganizationId,
  ownerUserId,
  ownerEmail,
}) {
  return Boolean(
    user &&
      membership &&
      user.id === ownerUserId &&
      organizationId === ownerOrganizationId &&
      membership.organizationId === organizationId &&
      membership.userId === user.id &&
      membership.status === "active" &&
      membership.role === "owner" &&
      normalizeEmail(user.email) === normalizeEmail(ownerEmail) &&
      normalizeEmail(ownerEmail) === "vision79slu@gmail.com"
  );
}