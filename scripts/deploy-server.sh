#!/usr/bin/env bash
set -euo pipefail

# Run on the target server as the dedicated deploy user. Keep .env and data on the server.
sha="${1:?A commit SHA is required}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 1; }
root=/opt/v79/hub
archive="$HOME/v79-hub-release-${sha}.tar.gz"

for command in docker rsync tar; do
  command -v "$command" >/dev/null || { echo "Missing server dependency: $command" >&2; exit 1; }
done
test -f "$archive" || { echo 'Release bundle missing' >&2; exit 1; }
test -f "$root/.env" || { echo "Create $root/.env before deploying" >&2; exit 1; }
test -d "$root/data" || { echo "Create $root/data before deploying" >&2; exit 1; }
docker network inspect proxy_network >/dev/null || { echo 'Docker network proxy_network is missing' >&2; exit 1; }
docker compose version >/dev/null

stage=$(mktemp -d "$root/.incoming.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
tar -xzf "$archive" -C "$stage"
test -f "$stage/docker-compose.yml" && test -f "$stage/Dockerfile"

# The deployment directory is reserved for this app. Preserve production state.
rsync -a --delete --exclude='/.env' --exclude='/data/' \
  --exclude='/backups/' --exclude='/.incoming.*/' "$stage/" "$root/"
cd "$root"
docker compose --project-name v79-hub build v79-hub
docker compose --project-name v79-hub run --rm --no-deps --entrypoint node v79-hub scripts/preflight-organization.mjs
docker compose --project-name v79-hub up -d --build --wait --wait-timeout 120
container_id="$(docker compose --project-name v79-hub ps -q v79-hub)"
test -n "$container_id"
test "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" = healthy
rm -f -- "$archive"
echo "Deployed and healthy: $sha"
