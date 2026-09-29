# Historical prototype tests

These tests describe earlier Hub implementations and are not current acceptance tests:

- `beta-signup.test.mjs` expects open beta signup and billing fields. Open signup is disabled until the organization and billing release gates pass.
- `hub-workflow.test.mjs` expects the older onboarding and session contract. The active single-organization boundary is covered by `hub-security.test.mjs` and `organization-access.test.mjs`.
- `recover-owner.test.mjs` requires the removed SQLite prototype and `better-sqlite3`. Current file-backed password recovery is tested in `hub-security.test.mjs`.

Keep these as historical specifications until the corresponding multi-business features are rebuilt and tested against the new storage model. The root `npm test` runs every supported top-level test file.
