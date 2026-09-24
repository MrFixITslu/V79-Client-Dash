# V79 Hub

V79 Hub is the control plane for the V79 Digital ecosystem. It gives one organisation a secure starting point for V79 Tiquet, FFPRO and V79 Academy while keeping each product as the system of record for its own data.

## Phase 1 scope

Phase 1 is intentionally read-only across product boundaries.

- **V79 Hub** owns organisation membership and business-app access. Academy summaries use the signed-in member's verified email.
- **V79 Tiquet** owns clients, jobs, service operations and its workspace.
- **FFPRO** owns financial transactions, budgets, goals and forecasts.
- **V79 Academy** owns learners, courses, assessments and certificates.
- Product summaries are requested server-to-server with an HMAC-SHA256 signature and a five-minute timestamp window. Product APIs must still enforce their own subject authorization.
- The Hub never receives raw FFPRO transaction descriptions, Tiquet ticket content or Academy assessment answers.

The next platform phases can add single sign-on, universal organisation IDs, a durable event outbox and controlled cross-product actions after these contracts are proven.

## Current readiness boundary

The Hub validates identity, membership, subscription and app launch before it redirects a customer. A complete deployed journey also depends on each product consuming the signed launch ticket and applying the Hub organisation ID consistently. Verify live FFPRO, Tiquet, Marketing and Academy endpoints, mail delivery, reverse proxy, backups and restoration on the target server before inviting paying customers. Hosted payment configuration is unchanged by the current workflow pass.

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
8. Sign in and check **Connections**. Tiquet, FFPRO and Marketing use the Hub organisation ID. Academy is independently accessible and the Hub requests only the signed-in member's own verified email for a learner summary. No administrator-entered learner identifier is accepted.

Existing Academy mappings remain in the database for migration purposes but are ignored when requesting learner summaries or showing the Connections screen. Historic Academy organisation events are excluded from the shared timeline until a verified learner-to-organisation consent flow exists. The Hub database is stored at `data/v79-hub.db`.

## Automatic deployment after a merge

Every push to `main` (including a merged pull request) runs validation, publishes the container image, then transfers the tested source bundle over SSH and starts the Hub on your server. A failing test, image publish, server preflight, or container health check fails the workflow. Pull requests only run validation; they do not deploy. The Actions run is visible under **Actions → V79 CI/CD**. The container publication alone does not update the server.

One-time server setup (run as an administrator on the server):

1. Install Docker Engine with the Compose plugin and `rsync`. Create a dedicated `v79deploy` user with permission to run Docker. Docker access is privileged: use a dedicated account and limit who can change the `production` environment in GitHub.
2. Give that user ownership of `/opt/v79/hub`; create `/opt/v79/hub/data`, and place `/opt/v79/hub/.env` there using `.env.example` as a guide. Keep `.env`, the SQLite database and its WAL files on the server. Back up and test restoring `data` and `.env` before enabling deployments.
3. Create the shared Docker network: `docker network inspect proxy_network >/dev/null 2>&1 || docker network create proxy_network`. Keep the reverse proxy routing `hub.v79sl.com` to `v79-hub:3040` on that network and configure its TLS certificate.
4. Generate a dedicated SSH key pair for GitHub Actions (for example `ssh-keygen -t ed25519 -f ./v79-hub-deploy-key -C v79-hub-actions`). Add the **public** key to the deploy user's `~/.ssh/authorized_keys`. Put the **private** key in GitHub only as the secret described below; never commit it or paste it into a ticket.
5. From a trusted machine, obtain and verify the server's SSH host key fingerprint with your server provider or the server console. Save its `known_hosts` line for the production secret. `ssh-keyscan -p 22 your-host` collects a line but does not independently verify it.

In **Repository → Settings → Environments**, create `production`. Add these **environment secrets** (the workflow uses this environment):

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Public DNS name or IP of the SSH server (no scheme or port) |
| `DEPLOY_USER` | Dedicated deploy user, such as `v79deploy` |
| `DEPLOY_SSH_KEY` | Full private key including BEGIN/END lines |
| `DEPLOY_KNOWN_HOSTS` | Verified OpenSSH `known_hosts` line for that host and port |

If SSH uses a port other than 22, add `DEPLOY_SSH_PORT` under **production → Environment variables** and use the matching `[host]:port` format in `DEPLOY_KNOWN_HOSTS`. Restrict the production environment to `main` and trusted reviewers as appropriate. Do not put application secrets in GitHub Actions: the deployment reads `/opt/v79/hub/.env` on the server. First populate that file with strong, stable values and test the proxy, product endpoints and backups. On an empty server, the workflow deliberately fails until `.env`, `data`, and `proxy_network` exist.

After setup, merge a PR into `main` or push to `main`. The deployment replaces only the app files in `/opt/v79/hub`, preserves `.env`, `data` and `backups`, builds the image there, and waits for a healthy Hub container. A failed health check needs investigation in the Actions log and `docker compose --project-name v79-hub -f /opt/v79/hub/docker-compose.yml logs --tail=100` on the server; the workflow does not roll back database migrations automatically. Manual **Run workflow** currently validates and does not deploy.

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

The workflow test starts a temporary Hub with its own database and covers owner login, an invitation, member permissions, a single-use Tiquet launch ticket, and isolation of Academy learner identifiers. It does not replace acceptance testing against deployed FFPRO, Tiquet, Marketing, Academy, email, or a payment provider.

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

Public self-service registration is **disabled by default**. `V79_SELF_SERVICE_SIGNUP=1` is only effective when verified transactional email delivery is also configured. `V79_TRIAL_DAYS` defaults to 14. The trial clock starts when the owner explicitly verifies the email address, not when the registration form is submitted.


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


## Verified accounts and recovery

Phase 7 makes email ownership part of Hub identity instead of treating an email string as trusted account data.

Existing Hub accounts are migrated as verified so deployment does not lock out current customers. New public self-service accounts are created in a pending state and cannot sign in or use product entitlements until the owner confirms the verification message. Opening the link alone does not verify the account: the customer must press the confirmation button, which protects trial activation from automated email-link scanners.

Account tokens are random, stored only as SHA-256 hashes, short-lived and single-use:
- email verification: 24 hours
- password reset: 30 minutes

A successful password reset invalidates all existing Hub sessions. Forgot-password and resend-verification responses are deliberately generic so the API does not disclose whether an email address has an account.

Team invitations are still seven-day, single-use links. When transactional email is configured, Hub emails the invitation automatically; the owner can still copy the secure invitation link as a fallback.

### Transactional email

Account email is disabled by default. The first adapter uses the Resend HTTPS email API through Node's native `fetch`; Hub does not require an additional mail package.

Configure:

```env
V79_MAIL_PROVIDER=resend
RESEND_API_KEY=<verified provider API key>
V79_MAIL_FROM=V79 Digital <no-reply@v79sl.com>
```

The `V79_MAIL_FROM` domain must be verified with the email provider before public signup is enabled. Keep `V79_SELF_SERVICE_SIGNUP=0` until a real verification email has been received successfully from the production Hub domain.

Trial and paid-period lifecycle is also persisted: an expired trial moves to `suspended`; an expired paid period moves to `past_due`. Payment can reactivate the subscription through the verified billing flow.


## Security and resilience hardening

V79 Hub is the identity and access control plane for the paid business applications, so production deployments should configure the hardening controls below before inviting customer teams.

### Multi-factor authentication

Hub supports TOTP authenticator applications and eight one-time recovery codes per enrolment.

1. Generate a stable encryption key:
   ```bash
   openssl rand -hex 32
   ```
2. Set that value as `V79_HUB_MFA_KEY`.
3. Keep the value in protected backups. Do not rotate or regenerate it casually: existing encrypted MFA secrets depend on it.
4. Users can enable MFA from **Security** after confirming their current password.

Recovery codes are only displayed at enablement time. Hub stores hashes of those codes, not the plaintext codes.

### Security audit trail

Owners and administrators can review recent authentication, MFA, invitation, role, product-access and app-launch events from **Security**. Configure a separate stable `V79_AUDIT_HASH_KEY` (32+ characters recommended) so source IP addresses are represented by consistent privacy-preserving fingerprints rather than stored as raw addresses.

### Durable transactional email

Verification, recovery and team-invitation messages are written to a SQLite outbox before delivery. Temporary provider failures are retried with bounded exponential backoff instead of losing the message after one failed HTTP request. `/api/health` reports pending and terminally failed outbox counts without making an external email outage fail Hub liveness.

### Product outage fallback

Successful signed product summaries are cached locally. If FFPRO, Tiquet, Marketing or Academy times out, is rate-limited, or returns a temporary server error, Hub can show the last verified summary as **Live data delayed** instead of turning the whole command centre blank. The fallback is bounded by `V79_SUMMARY_CACHE_MAX_AGE_MINUTES` (default 1440 minutes / 24 hours). Authentication or authorization errors are never hidden by the cache.

### Durable abuse controls

Authentication throttles are stored in the Hub database rather than process memory, so restarting the container does not reset an active rate-limit window.

Back up the complete `data` directory and deployment secrets together. The SQLite database now also contains the email outbox, audit records, MFA recovery-code hashes, rate-limit state and product-summary cache.
