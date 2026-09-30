# Multi-business release gates

Status: invite-only Hub onboarding enabled for closed beta. The V79 platform operator can enroll additional SMB workspaces through single-use owner invitations. Managed product tenant mappings are created in a pending state and POS, FFPRO, Tiquet and Marketing launches remain fail-closed for customer organizations until each product mapping is explicitly activated. Paid checkout remains disabled.

## 1. Organization data boundary

Implemented for the current single-instance Hub: organizations, memberships, entitlements, customer custom apps and product tenant mappings are keyed by organization ID; the existing V79 workspace was migrated with backup protection. Authenticated Hub reads, writes and realtime updates resolve their organization from the session, and platform administration is restricted to the V79 operator identity rather than customer admin role. Store writes use a temporary file plus atomic rename; a transactional database remains the required upgrade before running multiple Hub replicas.

## 2. Controlled onboarding

Implemented at the Hub layer: only the V79 platform operator can issue a single-use, expiring owner invitation tied to an approved business and email. The plaintext token is returned once in the invite URL fragment, exchanged with the Hub in a request header so it stays out of normal URL logs, and only its SHA-256 hash is persisted. Redeeming the same-origin invite creates the organization, owner membership, selected entitlements, pending managed-product tenant mappings, and audit event in one atomic store commit. Replay, revocation and expiry fail closed. Open registration remains disabled. Product-specific provisioning is deliberately separate so a partially configured downstream app cannot become launchable.

## 3. Two-business acceptance

Hub-level two-business acceptance is automated: a single identity can own two isolated SMB workspaces, workspace selection is explicit, team/catalog reads remain scoped, and replayed/revoked invites fail closed. The remaining release gate is product-level acceptance for POS, FFPRO, Tiquet and Marketing: use isolated demo owners and staff for business A and B, confirm each product's tenant data boundary, then activate that product's tenant mapping. A cross-business read or mutation must fail without returning another tenant's data.

## 4. Subscription lifecycle

Keep paid checkout off until an approved provider and merchant account are configured. Store plan, entitlement, billing customer, subscription state, grace deadline, and provider event IDs per organization. Verify webhook signatures over the raw body, process event IDs idempotently in a transaction, and audit transitions. The state policy covers trial, active, past due, grace, canceled, and recovery. Billing permissions must not grant product or operator access. Academy learner accounts remain independent.

Before enabling managed product launches for customer organizations: complete the two-business acceptance run inside each connected product and explicitly activate its tenant mapping. Before enabling paid checkout: run provider sandbox checkout, retry, cancellation, payment recovery, and duplicate/out-of-order webhook cases; confirm invoice separation for both demo businesses. Restore from backup and rerun owner launches.
