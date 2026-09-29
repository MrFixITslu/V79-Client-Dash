import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signPlatformRequest, verifyPlatformRequest } from '../server/platform-contract.mjs';

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
  let provisionedId = '';
  const posServer = createHttpServer(async (req,res) => {
    const chunks=[];
    for await (const chunk of req) chunks.push(chunk);
    const body=Buffer.concat(chunks).toString();
    const pathname=new URL(req.url,'http://localhost').pathname;
    const valid=req.headers['x-v79-service-id']==='v79-hub' && verifyPlatformRequest({method:req.method,pathname,timestamp:req.headers['x-v79-timestamp'],body,secret,signature:req.headers['x-v79-signature']});
    res.setHeader('content-type','application/json');
    if(!valid) { res.statusCode=401; return res.end('{}'); }
    if(pathname==='/api/platform/provision') { provisionedId=JSON.parse(body).organization.id; return res.end(JSON.stringify({provisioned:true})); }
    if(pathname.startsWith('/api/platform/summary/') && provisionedId) return res.end(JSON.stringify({metrics:{products:0,locations:1,sales:0}}));
    res.statusCode=404; res.end('{}');
  });
  await new Promise(resolve=>posServer.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>posServer.close(resolve)));
  const posOrigin=`http://127.0.0.1:${posServer.address().port}`;
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: project,
    env: {
      ...process.env,
      NODE_ENV: 'production', PORT: String(port), APP_URL: origin, DATA_DIR: dataDir,
      V79_HUB_ADMIN_EMAIL: 'owner@example.test', V79_HUB_ADMIN_PASSWORD: 'a-valid-test-password-123',
      V79_HUB_ORGANIZATION_NAME: 'Test Business', V79_PLATFORM_SHARED_SECRET: secret,
      V79_TIQUET_LAUNCH_SECRET: secret, V79_TIQUET_PUBLIC_URL: 'https://tiquet.example.test',
      V79_BILLING_PROVIDER: 'disabled', V79_MAIL_PROVIDER: 'disabled', V79_SELF_SERVICE_SIGNUP: '0',
      V79_ACCESS_MODE: 'beta',
      FFPRO_BASE_URL: '', TIQUET_BASE_URL: '', MARKETING_BASE_URL: '', ACADEMY_BASE_URL: '',
      POS_BASE_URL: posOrigin,
      POS_PUBLIC_URL: 'https://pos.example.test',
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
    }).catch(error => { throw new Error(`${method} ${route} failed; Hub stderr: ${errors}`, { cause: error }); });
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
  assert.equal(ownerDash.accessMode, 'beta');
  assert.equal(ownerDash.products.pos.entitled, true);
  assert.equal(ownerDash.products.ffpro.entitled, true);
  assert.equal(ownerDash.products.tiquet.entitled, true);
  assert.equal(ownerDash.products.marketing.entitled, true);
  assert.equal(ownerDash.seats.limit, 10);
  assert.equal((await request('/api/billing/checkout', { cookie: ownerCookie, method: 'POST', body: { plan: 'business', billingCycle: 'monthly' } })).status, 409);
  assert.equal(ownerDash.products.pos.openUrl, '/api/apps/pos/launch');
  const jwks=await (await request('/.well-known/jwks.json')).json();
  assert.equal(jwks.keys[0].alg,'EdDSA');
  const posTokenResponse=await request('/api/apps/pos/token',{cookie:ownerCookie,method:'POST'});
  assert.equal(posTokenResponse.status,200);
  const posToken=(await posTokenResponse.json()).token;
  const [header,claims,signature]=posToken.split('.');
  const parsed=JSON.parse(Buffer.from(claims,'base64url'));
  assert.equal(parsed.tenant_id,provisionedId);
  assert.equal(parsed.aud,'v79-commerce');
  assert.equal(verifySignature(null,Buffer.from(`${header}.${claims}`),createPublicKey({key:jwks.keys[0],format:'jwk'}),Buffer.from(signature,'base64url')),true);
  const betaJoin = await request('/api/pos/beta/join', { cookie: ownerCookie, method: 'POST' });
  assert.equal(betaJoin.status, 200);
  assert.equal((await betaJoin.json()).access.status, 'beta');
  assert.equal((await request('/api/pos/beta/join', { cookie: ownerCookie, method: 'POST' })).status, 200);
  const posDashboard = await (await request('/api/platform/dashboard', { cookie: ownerCookie })).json();
  assert.equal(posDashboard.products.pos.entitled, true);
  assert.equal(posDashboard.products.pos.status,'connected');
  assert.equal(posDashboard.products.pos.accessStatus, 'beta');
  assert.equal(posDashboard.products.pos.launchReady, true);
  assert.equal(posDashboard.products.pos.openUrl, '/api/apps/pos/launch');
  const posLaunch = await request('/api/apps/pos/launch', { cookie: ownerCookie, redirect: 'manual' });
  assert.equal(posLaunch.status, 302);
  const posLocation = new URL(posLaunch.headers.get('location'));
  assert.equal(posLocation.origin, 'https://pos.example.test');
  assert.equal(posLocation.search, '');
  const posTicket = new URLSearchParams(posLocation.hash.slice(1)).get('ticket');
  assert.ok(posTicket);
  const consumeBody = JSON.stringify({product:'pos',ticket:posTicket});
  const posTimestamp = String(Date.now());
  const posHeaders = {'x-v79-service-id':'v79-pos','x-v79-timestamp':posTimestamp,'x-v79-signature':signPlatformRequest({method:'POST',pathname:'/api/platform/session/consume',timestamp:posTimestamp,body:consumeBody,secret})};
  const posConsume = await request('/api/platform/session/consume',{method:'POST',body:{product:'pos',ticket:posTicket},headers:posHeaders});
  assert.equal(posConsume.status,200);
  const consumedPos = await posConsume.json();
  assert.equal(consumedPos.tenantId,provisionedId);
  assert.equal(JSON.parse(Buffer.from(consumedPos.token.split('.')[1],'base64url')).aud,'v79-commerce');
  assert.equal((await request('/api/platform/session/consume',{method:'POST',body:{product:'pos',ticket:posTicket},headers:posHeaders})).status,401);
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
  assert.equal((await request('/api/pos/beta/join', { cookie: memberCookie, method: 'POST' })).status, 403);
  assert.equal((await request('/api/apps/pos/token', { cookie: memberCookie, method: 'POST' })).status, 403);
  assert.equal((await request('/api/apps/ffpro/launch', { cookie: memberCookie, redirect: 'manual' })).status, 403);
  const launch = await request('/api/apps/tiquet/launch', { cookie: memberCookie, redirect: 'manual' });
  assert.equal(launch.status, 302);
  const launchTicket = new URL(launch.headers.get('location')).searchParams.get('ticket');
  const body = JSON.stringify({ product: 'tiquet', ticket: launchTicket });
  const timestamp = String(Date.now());
  const headers = { 'x-v79-service-id': 'v79-tiquet', 'x-v79-timestamp': timestamp, 'x-v79-signature': signPlatformRequest({ method: 'POST', pathname: '/api/platform/session/consume', timestamp, body, secret }) };
  const consume = await request('/api/platform/session/consume', { method: 'POST', body: { product: 'tiquet', ticket: launchTicket }, headers });
  assert.equal(consume.status, 200);
  const consumed=await consume.json();
  assert.equal(consumed.user.email, 'worker@example.test');
  assert.equal(consumed.plan, 'beta');
  assert.equal(consumed.accessMode, 'beta');
  assert.equal((await request('/api/platform/session/consume', { method: 'POST', body: { product: 'tiquet', ticket: launchTicket }, headers })).status, 401);
  const memberDash = await (await request('/api/platform/dashboard', { cookie: memberCookie })).json();
  assert.equal(memberDash.products.ffpro.status, 'restricted');
  assert.equal(memberDash.products.tiquet.accessible, true);
  assert.equal(memberDash.products.pos.accessible, false);

  const orgId=ownerDash.organization.id;
  const conversionArgs=['scripts/convert-pos-account.mjs','--organization-id',orgId,'--status','paid','--reason','Reviewed contract test reference'];
  const dryRun=execFileSync(process.execPath,conversionArgs,{cwd:project,env:{...process.env,DATA_DIR:dataDir},encoding:'utf8'});
  assert.match(dryRun,/Dry run only/);
  assert.equal((await request('/api/pos/access', { cookie: ownerCookie }).then(r=>r.json())).access.status,'beta');

  const productionPort=await freePort();
  const productionOrigin=`http://127.0.0.1:${productionPort}`;
  const productionChild=spawn(process.execPath,['--import','tsx','server.ts'],{
    cwd:project,
    env:{...process.env,NODE_ENV:'production',PORT:String(productionPort),APP_URL:productionOrigin,DATA_DIR:dataDir,
      V79_HUB_ADMIN_EMAIL:'owner@example.test',V79_HUB_ADMIN_PASSWORD:'a-valid-test-password-123',
      V79_ACCESS_MODE:'production',V79_BILLING_PROVIDER:'disabled',V79_MAIL_PROVIDER:'disabled',
      FFPRO_BASE_URL:'',TIQUET_BASE_URL:'',MARKETING_BASE_URL:'',ACADEMY_BASE_URL:''},
    stdio:'ignore',
  });
  t.after(()=>productionChild.kill());
  let productionReady=false;
  for(let i=0;i<70;i++) {
    try { if((await fetch(productionOrigin+'/api/health')).ok) { productionReady=true; break; } } catch {}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  assert.ok(productionReady,'Production mode Hub did not start');
  const productionRequest=(route,options={})=>fetch(productionOrigin+route,{...options,headers:{Cookie:ownerCookie,...options.headers}});
  let productionDashboard=await (await productionRequest('/api/platform/dashboard')).json();
  assert.equal(productionDashboard.products.pos.entitled,false);
  assert.equal(productionDashboard.accessMode,'production');
  assert.equal(productionDashboard.products.pos.betaSignupOpen,false);
  assert.equal((await productionRequest('/api/pos/beta/join',{method:'POST'})).status,403);
  execFileSync(process.execPath,[...conversionArgs,'--apply'],{cwd:project,env:{...process.env,DATA_DIR:dataDir}});
  productionDashboard=await (await productionRequest('/api/platform/dashboard')).json();
  assert.equal(productionDashboard.products.pos.entitled,true);
  assert.equal(productionDashboard.products.pos.accessStatus,'paid');
  assert.equal(productionDashboard.products.pos.openUrl,'');
});
