import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function freePort() {
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}

test('free beta signup verifies email, retains IDs and grants all available apps without billing', {timeout:30000}, async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'v79-beta-signup-'));
  const port=await freePort();
  const origin=`http://127.0.0.1:${port}`;
  const emailOut=path.join(dir,'email.json');
  const child=spawn(process.execPath,['--import','./tests/mock-resend.mjs','--import','tsx','server.ts'],{
    cwd:project,env:{...process.env,NODE_ENV:'production',PORT:String(port),APP_URL:origin,DATA_DIR:dir,
      V79_ACCESS_MODE:'beta',V79_SELF_SERVICE_SIGNUP:'1',V79_MAIL_PROVIDER:'resend',
      RESEND_API_KEY:'test-key-long-enough',V79_MAIL_FROM:'test@example.test',V79_TEST_MAIL_OUT:emailOut,
      V79_HUB_ADMIN_EMAIL:'owner@example.test',V79_HUB_ADMIN_PASSWORD:'a-valid-test-password-123',
      V79_BILLING_PROVIDER:'disabled',FFPRO_BASE_URL:'',TIQUET_BASE_URL:'',MARKETING_BASE_URL:'',ACADEMY_BASE_URL:''},
    stdio:['ignore','ignore','pipe'],
  });
  let errors=''; child.stderr.on('data',c=>{errors+=c.toString()});
  t.after(async()=>{if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve)); child.kill(); await exited;} await rm(dir,{recursive:true,force:true});});
  const request=(route,body,cookie='')=>fetch(origin+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let ready=false;
  for(let i=0;i<80;i++) { try { if((await request('/api/health')).ok){ready=true;break;} } catch {} await new Promise(resolve=>setTimeout(resolve,120)); }
  assert.ok(ready,`Hub did not start: ${errors}`);
  const plans=await (await request('/api/plans')).json();
  assert.equal(plans.accessMode,'beta');
  assert.equal(plans.selfServiceSignup,true);
  const registration=await request('/api/auth/register',{email:'tester@example.test',password:'a-strong-beta-password-123',name:'Beta Tester',organizationName:'Beta Shop'});
  assert.equal(registration.status,202);
  const sent=JSON.parse(await readFile(emailOut,'utf8'));
  const token=sent.html.match(/verify=([A-Za-z0-9_-]+)/)?.[1];
  assert.ok(token,'Verification link was absent');
  const verified=await request('/api/auth/verify-email',{token});
  assert.equal(verified.status,200);
  const cookie=verified.headers.get('set-cookie').split(';')[0];
  const dashboard=await (await request('/api/platform/dashboard',undefined,cookie)).json();
  assert.equal(dashboard.accessMode,'beta');
  assert.equal(dashboard.subscription,null);
  assert.equal(dashboard.organization.name,'Beta Shop');
  for(const product of ['ffpro','tiquet','marketing','academy','pos']) assert.equal(dashboard.products[product].entitled,true,product);
  assert.equal(dashboard.products.pos.openUrl,'');
  const billing=await (await request('/api/billing',undefined,cookie)).json();
  assert.equal(billing.accessMode,'beta');
  assert.equal(billing.orders.length,0);
  assert.equal((await request('/api/billing/checkout',{plan:'start',billingCycle:'monthly'},cookie)).status,409);

  const productionPort=await freePort();
  const productionOrigin=`http://127.0.0.1:${productionPort}`;
  const productionChild=spawn(process.execPath,['--import','tsx','server.ts'],{
    cwd:project,env:{...process.env,NODE_ENV:'production',PORT:String(productionPort),APP_URL:productionOrigin,DATA_DIR:dir,
      V79_ACCESS_MODE:'production',V79_SELF_SERVICE_SIGNUP:'0',V79_MAIL_PROVIDER:'disabled',
      V79_HUB_ADMIN_EMAIL:'owner@example.test',V79_HUB_ADMIN_PASSWORD:'a-valid-test-password-123',
      V79_BILLING_PROVIDER:'disabled',FFPRO_BASE_URL:'',TIQUET_BASE_URL:'',MARKETING_BASE_URL:'',ACADEMY_BASE_URL:''},
    stdio:'ignore',
  });
  t.after(()=>productionChild.kill());
  let productionReady=false;
  for(let i=0;i<80;i++) { try { if((await fetch(productionOrigin+'/api/health')).ok){productionReady=true;break;} } catch {} await new Promise(resolve=>setTimeout(resolve,120)); }
  assert.ok(productionReady,'Production mode Hub did not start');
  const productionDashboard=await (await fetch(productionOrigin+'/api/platform/dashboard',{headers:{Cookie:cookie}})).json();
  assert.equal(productionDashboard.organization.id,dashboard.organization.id);
  assert.equal(productionDashboard.accessMode,'production');
  assert.equal(productionDashboard.subscription,null);
  for(const product of ['ffpro','tiquet','marketing','pos']) assert.equal(productionDashboard.products[product].entitled,false,product);
});
