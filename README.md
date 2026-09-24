# V79 Hub

V79 Hub is the control plane for the V79 Digital ecosystem. It gives one organisation a secure starting point for V79 Tiquet, FFPRO and V79 Academy while keeping each product as the system of record for its own data.

## Phase 1 scope

Phase 1 is intentionally read-only across product boundaries.

- **V79 Hub** owns organisation membership and product-account mappings.
- **V79 Tiquet** owns clients, jobs, service operations and its workspace.
- **FFPRO** owns financial transactions, budgets, goals and forecasts.
- **V79 Academy** owns learners, courses, assessments and certificates.
- Product summaries are requested server-to-server with an HMAC-SHA256 signature and a five-minute replay window.
- The Hub never receives raw FFPRO transaction descriptions, Tiquet ticket content or Academy assessment answers.

The next platform phases can add single sign-on, universal organisation IDs, a durable event outbox and controlled cross-product actions after these contracts are proven.

## First deployment

1. Copy `.env.example` to `.env`.
2. Generate the platform secret once:
   ```bash
   openssl rand -hex 32
   ```
3. Put that exact `V79_PLATFORM_SHARED_SECRET` value in the Hub, FFPRO, Tiquet and Academy environments.
4. Set `V79_HUB_ADMIN_EMAIL` and a unique `V79_HUB_ADMIN_PASSWORD` of at least 16 characters.
5. Confirm the shared Docker network exists:
   ```bash
   docker network inspect proxy_network >/dev/null 2>&1 || docker network create proxy_network
   ```
6. Start the Hub:
   ```bash
   docker compose up -d --build
   ```
7. In Nginx Proxy Manager, proxy `hub.v79sl.com` to `v79-hub:3040`, enable Web Exploit protection and SSL.
8. Sign in, open **Connections**, and enter the matching product identifiers:
   - Tiquet: workspace/account ID
   - FFPRO: user UUID
   - Academy: learner UUID or learner email

The mappings are stored only in the Hub database at `data/v79-hub.db`.

## Product service URLs

When all applications share `proxy_network`, the recommended internal URLs are:

- FFPRO: `http://fire-finance-app:3010`
- Tiquet: `http://v79-tiquet-manager:3050`
- Academy: `http://v79_course_builder:3030`

These URLs never need to be exposed publicly for Hub-to-product traffic.

## Validation

```bash
npm ci
npm run lint
npm test
npm run build
docker build -t v79-hub:test .
```

The Hub database and SQLite WAL files are ignored by Git and must be included in server backups.


## V79 Marketing and subscription entitlements

V79 Hub is the paid access control plane for the business applications. Academy remains independently accessible to public learners.

Current entitlement model:
- **Start**: FFPRO + V79 Tiquet
- **Business**: FFPRO + V79 Tiquet + V79 Marketing
- **Advantage**: FFPRO + V79 Tiquet + V79 Marketing

Marketing uses a Hub-managed organisation mapping; customers do not manually attach or detach it. Hub issues a two-minute, single-use launch ticket after checking authentication and entitlement. Marketing consumes that ticket over a separately signed service-to-service contract.

The Hub dashboard also includes an Action Centre that derives practical next actions from connected product summaries without copying specialist product databases into Hub.

Billing-provider integration is deliberately separate from entitlement enforcement. Subscription records must only be moved to active/trialing by trusted platform administration or a verified payment workflow.
