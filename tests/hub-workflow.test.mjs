import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signPlatformRequest } from '../server/platform-contract.mjs';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const secret = 'hub-workflow-test-secret-must-be-long-enough';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('owner onboarding, team permissions, single-use launches and account isolation', { timeout: 30000 }, async t => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'v79-hub-workflow-'));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: project,
    env: {
      ...process.env,
      NODE_ENV: 'production', PORT: String(port), APP_URL: origin, DATA_DIR: dataDir,
      V79_HUB_ADMIN_EMAIL: 'owner@example.test', V79_HUB_ADMIN_PASSWORD: 'a-valid-test-password-123',
      V79_HUB_ORGANIZATION_NAME: 'Test Business', V79_PLATFORM_SHARED_SECRET: secret,
      V79_TIQUET_LAUNCH_SECRET: secret, V79_TIQUET_PUBLIC_URL: 'https://tiquet.example.test',
      V79_BILLING_PROVIDER: 'disabled', V79_MAIL_PROVIDER: 'disabled', V79_SELF_SERVICE_SIGNUP: '0',
      FFPRO_BASE_URL: '', TIQUET_BASE_URL: '', MARKETING_BASE_URL: '', ACADEMY_BASE_URL: '',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk.toString(); });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000))]);
    }
    await rm(dataDir, { recursive: true, force: true });
  });

  async function request(route, { cookie = '', method = 'GET', body, headers = {}, redirect = 'follow' } = {}) {
    return fetch(origin + route, {
      method, redirect,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  let healthy = false;
  for (let attempt = 0; attempt < 70; attempt++) {
    if (child.exitCode !== null) throw new Error(`Hub exited during startup: ${errors}`);
    try { const r = await request('/api/health'); if (r.ok) { healthy = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(healthy, `Hub did not start: ${errors}`);

  assert.equal((await request('/api/platform/dashboard')).status, 401);
  assert.equal((await request('/api/auth/register', { method: 'POST', body: {} })).status, 403);
  const ownerLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'owner@example.test', password: 'a-valid-test-password-123' } });
  assert.equal(ownerLogin.status, 200);
  const ownerCookie = ownerLogin.headers.get('set-cookie').split(';')[0];
  const ownerDash = await (await request('/api/platform/dashboard', { cookie: ownerCookie })).json();
  assert.equal(ownerDash.subscription.status, 'active');
  assert.equal(ownerDash.products.academy.status, 'not_configured');
  assert.equal(ownerDash.seats.used, 1);
  assert.equal((await request('/api/integrations/academy', { cookie: ownerCookie, method: 'PUT', body: { externalSubjectId: 'someone-else@example.test' } })).status, 409);

  const invitationResponse = await request('/api/team/invitations', { cookie: ownerCookie, method: 'POST', body: { email: 'worker@example.test', role: 'member', products: ['tiquet'] } });
  assert.equal(invitationResponse.status, 201);
  const invite = await invitationResponse.json();
  assert.equal((await request('/api/team', { cookie: ownerCookie }).then(r => r.json())).seats.used, 2);
  const token = new URL(invite.inviteUrl).searchParams.get('invite');
  const accepted = await request(`/api/team/invitations/${token}/accept`, { method: 'POST', body: { name: 'Team Member', password: 'another-valid-password-123' } });
  assert.equal(accepted.status, 201);
  const memberCookie = accepted.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(`/api/team/invitations/${token}/accept`, { method: 'POST', body: { name: 'Team Member', password: 'another-valid-password-123' } })).status, 404);
  assert.equal((await request('/api/billing', { cookie: memberCookie })).status, 403);
  assert.equal((await request('/api/team', { cookie: memberCookie })).status, 403);
  assert.equal((await request('/api/apps/ffpro/launch', { cookie: memberCookie, redirect: 'manual' })).status, 403);
  const launch = await request('/api/apps/tiquet/launch', { cookie: memberCookie, redirect: 'manual' });
  assert.equal(launch.status, 302);
  const launchTicket = new URL(launch.headers.get('location')).searchParams.get('ticket');
  const body = JSON.stringify({ product: 'tiquet', ticket: launchTicket });
  const timestamp = String(Date.now());
  const headers = { 'x-v79-service-id': 'v79-tiquet', 'x-v79-timestamp': timestamp, 'x-v79-signature': signPlatformRequest({ method: 'POST', pathname: '/api/platform/session/consume', timestamp, body, secret }) };
  const consume = await request('/api/platform/session/consume', { method: 'POST', body: { product: 'tiquet', ticket: launchTicket }, headers });
  assert.equal(consume.status, 200);
  assert.equal((await consume.json()).user.email, 'worker@example.test');
  assert.equal((await request('/api/platform/session/consume', { method: 'POST', body: { product: 'tiquet', ticket: launchTicket }, headers })).status, 401);
  const memberDash = await (await request('/api/platform/dashboard', { cookie: memberCookie })).json();
  assert.equal(memberDash.products.ffpro.status, 'restricted');
  assert.equal(memberDash.products.tiquet.accessible, true);
});
