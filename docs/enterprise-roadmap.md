# V79 Hub enterprise roadmap

## Product model

Each SMB has one Hub organization with its own members, roles, plan, entitlements, and linked app tenants. V79 platform operators have a separate administration scope. Academy learners can retain their standalone learner accounts; linking one to a Hub identity is optional and explicit.

The first multi-workspace beta is **invite-only**. A V79 operator approves each business and issues a single-use, expiring owner invitation. Open signup and paid checkout remain off until isolation, recovery, and billing tests pass.

The current Hub has one global JSON store and one configured owner organization. This is a migration plan, not a claim that multi-tenant access is implemented.

The first code stage records the legacy V79 organization and memberships with a pre-migration store copy. It still serves only the existing V79 workspace. Do not enable invitations or new SMB logins until every Hub route and connected-app launch is scoped to the authenticated organization and isolation tests pass. A transactional database migration is still needed before general multi-tenant operation.

## Release sequence

1. **Protect existing data and access.** Keep current signed launches working. Restrict finance summaries by role, replace simulated service checks, remove tracked runtime data from Tiquet, and review historical exposure separately.
2. **Introduce organization identity.** Add durable organizations, memberships, invitations, session records, roles, and a migration of the current owner/workspace with a reversible backup. Resolve organization context from the authenticated session, never a client-supplied organization ID alone.
3. **Unify app access.** Store per-organization app tenant mappings and entitlements. Issue short-lived, single-use, audience-bound launch tickets for authorized members. Add role mapping per product and a clear return-to-Hub action.
4. **Add subscription lifecycle.** Model trial, active, past due, canceled, and grace states with signed payment webhooks and idempotent processing. Keep billing permissions separate from app usage. Academy learner access remains independent unless the owner links it.
5. **Complete platform operations.** Central Admin handles app health, tenant provisioning, subscription state, aggregate usage, audit events, support tooling, and safe rollback evidence. Customer content and finance records remain in their products.
6. **Harden the experience.** Provide workspace switching, member invitations, MFA and recovery, scoped roles, responsive navigation, useful empty/error states, accessible forms, and clear indicators for live versus unavailable integrations.

## Acceptance journeys

- Migrated V79 owner signs in and sees the same app records and linked tenants after migration; rollback restores the prior data.
- Two unrelated SMB owners and their staff cannot view or change each other's Hub data, app tenants, invoices, or launch tickets.
- An uninvited visitor cannot create an organization; an expired or already used owner invitation cannot be redeemed.
- A staff member without finance permission receives no FFPRO figures from Hub APIs or cached responses.
- A permitted member launches each entitled app, returns to the same Hub organization, and cannot reuse the ticket.
- Revoked membership, expired entitlement, suspended tenant, and canceled subscription deny new launches according to documented policy.
- Service checks report actual response status and do not claim that liveness proves account access or full feature health.
- Payment webhook retries do not create duplicate subscription changes, and platform actions appear in an audit log without secrets or private content.
- Automated tests exercise these journeys against each connected app, followed by a private beta with representative SMB accounts and a measured accessibility review.
