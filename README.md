# V79 Client Hub

The Hub provides an operations workspace and links to the V79 ecosystem. This version uses a single local organisation with file-backed storage. Its inventory, Tiquet, FFPRO and Marketing panels are local Hub records; they are **not live synchronisation** with those products. An authenticated owner can launch FFPRO, Tiquet and Marketing with signed, single-use tickets, and POS with signed provisioning and its own ticket. Academy remains a public learner site.

## Deploy on the shared reverse-proxy network

1. Back up the current `data/` directory and `.env`. Keep the `data/` directory across updates: it contains Hub records, the POS signing key and tenant identity.
2. Copy `.env.example` to `.env`. Set a unique `V79_HUB_ADMIN_PASSWORD` of at least 16 characters, `V79_HUB_ADMIN_EMAIL` to the owner's verified email, and the same 32+ character `V79_PLATFORM_SHARED_SECRET` as the POS container. Set three separate launch secrets matching FFPRO, Tiquet and Marketing. Do not use the old demo passwords. Set `APP_URL` to the public Hub HTTPS origin. If linking an existing POS tenant and owner, set `V79_POS_ORG_ID` and `V79_POS_OWNER_USER_ID` to their verified existing IDs **before first boot**; otherwise a new POS tenant will be created.
3. Ensure Docker network `proxy_network` exists. Run `docker compose up -d --build` and route `hub.v79sl.com` in Nginx Proxy Manager to `v79-hub:3040` over that network. The Hub container exposes no host port.
4. On POS, use `JWT_ISSUER=https://hub.v79sl.com`, `HUB_INTERNAL_URL=http://v79-hub:3040`, `HUB_JWKS_URL=http://v79-hub:3040/.well-known/jwks.json`, `POS_PUBLIC_URL=https://pos.v79sl.com` and the matching service secret. Recreate POS after changing its environment.
5. Sign in at `https://hub.v79sl.com` with the configured admin **username** (default `admin`) and password. Launch FFPRO, Tiquet, Marketing or POS from their Hub card. Each product consumes the one-time ticket and establishes its own session. Direct visits to POS show the read-only demo until launched from Hub. Relaunch from Hub when its five-minute POS session expires.

The three existing product servers must each have `V79_HUB_INTERNAL_URL=http://v79-hub:3040` and the matching `V79_*_LAUNCH_SECRET`. An existing FFPRO or Tiquet account with the same email is deliberately **not** silently linked to Hub: back up the product database, verify ownership and use that product's documented `V79_ALLOW_EMAIL_ACCOUNT_LINK=1` for one reviewed launch, then switch it off again. The current Hub supports an operator-configured owner email; staff launch, verified self-service signup and paid conversion are not implemented in this file-backed edition.

### Recover a failed administrator password

The password in `.env` only bootstraps a new admin record. Editing it later does not change the saved hash. Back up `/opt/v79/hub/data` and `.env`, set a new unique `V79_HUB_ADMIN_PASSWORD` in the server `.env`, then from `/opt/v79/hub` run:

```sh
docker compose --project-name v79-hub stop v79-hub
docker compose --project-name v79-hub run --rm --no-deps v79-hub node scripts/reset-admin-password.mjs
docker compose --project-name v79-hub up -d --no-build v79-hub
```

The command changes only the configured administrator's hash, makes a private backup beside `v79_store.json`, and the restart revokes previous in-memory sessions. Use the username from `V79_HUB_ADMIN_USERNAME`, not an email address, on the login screen. Do not paste the password into a shell command or chat.

Legacy demo passwords are disabled on startup and plaintext passwords in existing `data/v79_store.json` are converted to salted scrypt hashes. The configured admin password replaces the old seeded admin password. Other accounts with known demo passwords must be given new passwords by the administrator. Inspect existing Hub data before treating previously seeded inventory, transactions or integration metrics as real. Fresh production stores start without sample business records; existing records are preserved. Production reset is disabled.

## Development and verification

```sh
npm ci
npm run lint
npm run build
npm test
```

The tests cover private API access, role boundaries, checkout pricing/stock, password recovery and signed, single-use launches. Additional deployed browser, existing-account linking, device, payment and cross-product acceptance testing is required before real merchant transactions. The local Hub checkout is separate from the V79 POS register and should not be used as a payment processor.
