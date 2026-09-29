# Multi-business release gates

Status: closed beta preparation. The Hub still serves the migrated V79 workspace only. This branch binds sessions to that organization and rejects tickets for any other tenant; it does not enroll another business.

## 1. Organization data boundary

Move global workspace, app catalog settings, and product tenant mappings to records keyed by organization ID in a transactional store. Migrate the existing V79 records with a verified backup and rollback. Every Hub read and mutation must use the organization resolved from the authenticated session. Platform administration needs a separate operator identity, not customer admin role.

## 2. Controlled onboarding

Only a platform operator can issue a single-use, expiring owner invitation tied to an approved business and verified email. Redeeming it creates the organization, owner membership, tenant mappings, and audit event in one transaction. Never expose open registration while the global workspace remains. Revoke invitation on replay or expiry; recover a partial provision through an idempotent operation.

## 3. Two-business acceptance

Use isolated demo owners and staff for business A and B. Check Hub profiles, users, catalog, finance summaries, Admin Console, and every POS, FFPRO, Tiquet, Marketing launch. A cross-business read or mutation must fail without returning another tenant's data. Repeat with revoked membership, suspended tenant, expired entitlement, replayed ticket, and rollback. Keep demo records for review; remove only after explicit approval.

## 4. Subscription lifecycle

Keep paid checkout off until an approved provider and merchant account are configured. Store plan, entitlement, billing customer, subscription state, grace deadline, and provider event IDs per organization. Verify webhook signatures over the raw body, process event IDs idempotently in a transaction, and audit transitions. The state policy covers trial, active, past due, grace, canceled, and recovery. Billing permissions must not grant product or operator access. Academy learner accounts remain independent.

Before beta: run provider sandbox checkout, retry, cancellation, payment recovery, and duplicate/out-of-order webhook cases; confirm invoice separation for both demo businesses. Restore from backup and rerun owner launches. Enable invitations only after the end-to-end isolation run passes; enable paid checkout only after billing and recovery pass.
