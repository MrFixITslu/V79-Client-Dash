import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPublicKey, verify } from 'node:crypto';
import { verifyPlatformRequest, signPlatformRequest } from '../server/platform-contract.mjs';

const secret='test-shared-secret-long-enough-for-platform';
async function listen(server) { await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); return `http://127.0.0.1:${server.address().port}`; }

test('private data, roles, checkout integrity and one-time POS launch', {timeout:30000}, async t => {
  const dir=await mkdtemp(join(tmpdir(),'v79-hub-security-'));
  let provision;
  const pos=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    const ok=verifyPlatformRequest({method:req.method,pathname:req.url,timestamp:req.headers['x-v79-timestamp'],signature:req.headers['x-v79-signature'],body,secret});
    if(!ok){res.writeHead(401).end('{}');return;}
    provision=JSON.parse(body);
    res.setHeader('content-type','application/json');res.end('{"provisioned":true}');
  });
  const posOrigin=await listen(pos);
  const probe=createServer();const origin=await listen(probe);await new Promise(resolve=>probe.close(resolve));
  const server=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',DATA_DIR:dir,PORT:new URL(origin).port,APP_URL:origin,V79_HUB_ADMIN_PASSWORD:'a-unique-admin-password-1234',V79_PLATFORM_SHARED_SECRET:secret,POS_BASE_URL:posOrigin,POS_PUBLIC_URL:'https://pos.example.test'},stdio:['ignore','pipe','pipe']});
  let errors='';server.stderr.on('data',c=>errors+=c);
  server.stdout.on('data',c=>errors+=c);
  t.after(async()=>{
    if(server.exitCode===null){const exit=new Promise(resolve=>server.once('exit',resolve));server.kill();await Promise.race([exit,new Promise(resolve=>setTimeout(resolve,1500))]);}
    pos.closeAllConnections();await new Promise(resolve=>pos.close(resolve));
    await rm(dir,{recursive:true,force:true});
  });
  const request=(path,options={})=>fetch(origin+path,{redirect:'manual',...options});
  for(let i=0;i<60;i++){try{if((await request('/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  let health;try{health=await request('/api/health');}catch{throw new Error(`Hub failed to start: ${errors}`);}
  assert.equal(health.status,200,errors);
  assert.equal((await request('/api/inventory')).status,401);
  assert.equal((await request('/api/users')).status,401);
  assert.equal((await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'password123'})})).status,401);
  const login=await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'a-unique-admin-password-1234'})});
  assert.equal(login.status,200,errors);
  assert.equal('token' in (await login.clone().json()),false);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const headers={Cookie:cookie,Origin:origin,'content-type':'application/json'};
  assert.equal((await request('/api/users',{headers})).status,200);
  assert.equal((await request('/api/users',{method:'POST',headers:{Cookie:cookie,'content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await request('/api/settings/reset',{method:'POST',headers})).status,403);
  const create=await request('/api/users',{method:'POST',headers,body:JSON.stringify({username:'viewer',password:'viewer-password-1234',role:'viewer'})});
  assert.equal(create.status,201);
  const viewerLogin=await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'viewer',password:'viewer-password-1234'})});
  const viewerCookie=viewerLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/users',{headers:{Cookie:viewerCookie}})).status,403);
  assert.equal((await request('/api/pos/checkout',{method:'POST',headers:{...headers,Cookie:viewerCookie},body:'{}'})).status,403);
  assert.equal((await request('/api/apps/pos/launch',{headers:{Cookie:viewerCookie}})).status,403);
  const item=await request('/api/inventory',{method:'POST',headers,body:JSON.stringify({name:'Test item',sku:'T1',quantity:1,price:10,costPrice:4})});
  const created=await item.json();
  const cart=[{item:{id:created.id,price:0.01},quantity:2}];
  assert.equal((await request('/api/pos/checkout',{method:'POST',headers,body:JSON.stringify({cart})})).status,409);
  cart[0].quantity=1;
  const sale=await request('/api/pos/checkout',{method:'POST',headers,body:JSON.stringify({cart})});
  assert.equal(sale.status,201);
  assert.equal((await sale.json()).transaction.subtotal,10);
  assert.equal((await request('/api/pos/checkout',{method:'POST',headers,body:JSON.stringify({cart})})).status,409);
  const launch=await request('/api/apps/pos/launch',{headers:{Cookie:cookie}});
  assert.equal(launch.status,302);
  assert.equal(provision.role,'owner');
  const url=new URL(launch.headers.get('location'));
  assert.equal(url.origin,'https://pos.example.test');
  assert.equal(url.search,'');
  const ticket=new URLSearchParams(url.hash.slice(1)).get('ticket');
  const body=JSON.stringify({product:'pos',ticket});const timestamp=String(Date.now());
  const serviceHeaders={'content-type':'application/json','x-v79-service-id':'v79-pos','x-v79-timestamp':timestamp,'x-v79-signature':signPlatformRequest({method:'POST',pathname:'/api/platform/session/consume',timestamp,body,secret})};
  const consume=await request('/api/platform/session/consume',{method:'POST',headers:serviceHeaders,body});
  assert.equal(consume.status,200);
  const {token,tenantId}=await consume.json();
  assert.equal(tenantId,provision.organization.id);
  const jwks=await (await request('/.well-known/jwks.json')).json();
  const [h,p,s]=token.split('.');
  assert.equal(verify(null,Buffer.from(`${h}.${p}`),createPublicKey({format:'jwk',key:jwks.keys[0]}),Buffer.from(s,'base64url')),true);
  assert.equal((await request('/api/platform/session/consume',{method:'POST',headers:serviceHeaders,body})).status,401);
});
