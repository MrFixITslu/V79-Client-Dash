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

Billing-provider integration remains separate from entitlement enforcement, but Hub now includes a verified hosted-checkout workflow. Subscription records move to active only after the configured provider transaction is bound to the V79 billing order and its return signature is verified.


## Customer trials and plan catalogue

Hub now carries the commercial entitlement catalogue:

- **V79 Start** — EC$149/month, 2 included users, FFPRO + V79 Tiquet.
- **V79 Business** — EC$299/month, 5 included users, FFPRO + V79 Tiquet + V79 Marketing.
- **V79 Advantage** — EC$499/month, 10 included users, FFPRO + V79 Tiquet + V79 Marketing.
- Annual catalogue prices are EC$1,639 / EC$3,289 / EC$5,489 respectively.

A trial record is real access-control state, not a simulated payment. Trial entitlements expire at `trial_ends_at`. Active subscriptions can also be bounded by `current_period_end`.

Public self-service registration is **disabled by default**. Set `V79_SELF_SERVICE_SIGNUP=1` only when you intentionally want to accept public trials. `V79_TRIAL_DAYS` defaults to 14. Until email verification and a payment workflow are connected, keeping self-service disabled is the safer production setting.


## Hosted billing and WiPay

Phase 6 adds an owner-only Billing area for prepaid monthly or annual V79 access. It does **not** store card details and it does **not** enable automatic recurring charges.

The first adapter is WiPay because V79 operates in Saint Lucia. Billing stays disabled unless all of the following are explicitly configured:

- `V79_BILLING_PROVIDER=wipay`
- `WIPAY_PAYMENT_URL`
- `WIPAY_ACCOUNT_NUMBER`
- `WIPAY_API_KEY`
- `WIPAY_COUNTRY_CODE`
- `WIPAY_CURRENCY=XCD`
- `WIPAY_ENVIRONMENT=sandbox` or `live`

Do not guess the Saint Lucia endpoint or country code from another WiPay territory. Use the values supplied for the verified merchant account. `WIPAY_ALLOWED_HOSTS` is only needed if merchant onboarding provides a hosted-checkout hostname outside the normal WiPay Financial domain.

The checkout contract deliberately requires WiPay to return a provider transaction ID before the customer leaves V79. The browser return must present that same transaction ID and a valid provider hash before Hub activates the subscription.

Mid-period plan changes are not automatically prorated in this release. Renewals of the current plan are supported; controlled plan changes during an already-paid period should be handled by V79 support until a tested proration policy is added.
