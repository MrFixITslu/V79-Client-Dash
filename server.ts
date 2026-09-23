import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { signPlatformRequest } from "./server/platform-contract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const production = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3040);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const DB_PATH = path.join(DATA_DIR, "v79-hub.db");
const SESSION_COOKIE = "v79_hub_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

process.umask(0o077);
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (production) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, organization_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS integrations (
  organization_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('ffpro','tiquet','academy')),
  external_subject_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(organization_id, product),
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
`);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^['"]|['"]$/g, "") : "";
}
function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "business";
}
function passwordDigest(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function constantEqualHex(a: string, b: string) {
  const aa = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function cookieValue(req: express.Request, name: string) {
  const hit = (req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}
function setSessionCookie(res: express.Response, token: string) {
  const pieces = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`];
  if (production) pieces.push("Secure");
  res.setHeader("Set-Cookie", pieces.join("; "));
}
function clearSessionCookie(res: express.Response) {
  const pieces = [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (production) pieces.push("Secure");
  res.setHeader("Set-Cookie", pieces.join("; "));
}
function currentUser(req: express.Request) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.email, u.name, s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=?
  `).get(hashToken(token)) as any;
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}
function membership(userId: string) {
  return db.prepare(`
    SELECT m.role, o.id AS organizationId, o.name AS organizationName, o.slug
    FROM memberships m JOIN organizations o ON o.id=m.organization_id
    WHERE m.user_id=? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1
  `).get(userId) as any;
}
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to V79 Hub." });
  (req as any).hubUser = user;
  (req as any).hubMembership = membership(user.id);
  if (!(req as any).hubMembership) return res.status(403).json({ error: "No V79 organisation is linked to this account." });
  next();
}
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const role = (req as any).hubMembership?.role;
  if (!["owner","admin"].includes(role)) return res.status(403).json({ error: "Organisation administrator access is required." });
  next();
}
function canonicalOrigin(req: express.Request) {
  const configured = clean(process.env.APP_URL);
  if (configured) return new URL(configured).origin;
  return `${req.protocol}://${req.get("host")}`;
}
app.use((req, res, next) => {
  if (["GET","HEAD","OPTIONS"].includes(req.method) || !req.path.startsWith("/api/")) return next();
  const origin = req.headers.origin;
  if (!origin) return res.status(403).json({ error: "Origin header required." });
  try {
    if (new URL(origin).origin !== canonicalOrigin(req)) return res.status(403).json({ error: "Cross-site request denied." });
  } catch {
    return res.status(403).json({ error: "Cross-site request denied." });
  }
  next();
});

const loginAttempts = new Map<string, {count:number; resetAt:number}>();
function loginLimited(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || "unknown", now = Date.now();
  let item = loginAttempts.get(key);
  if (!item || item.resetAt < now) item = { count: 0, resetAt: now + 15*60_000 };
  item.count++; loginAttempts.set(key,item);
  if (item.count > 15) {
    res.setHeader("Retry-After","900");
    return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  }
  next();
}
setInterval(() => {
  const now=Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  for (const [key,value] of loginAttempts) if(value.resetAt<now) loginAttempts.delete(key);
}, 60_000).unref();

function bootstrapOwner() {
  const count = Number((db.prepare("SELECT COUNT(*) AS count FROM users").get() as any).count || 0);
  if (count) return;
  const email = clean(process.env.V79_HUB_ADMIN_EMAIL).toLowerCase();
  const password = clean(process.env.V79_HUB_ADMIN_PASSWORD);
  const name = clean(process.env.V79_HUB_ADMIN_NAME) || "V79 Hub Owner";
  const orgName = clean(process.env.V79_HUB_ORGANIZATION_NAME) || "V79 Digital";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("V79_HUB_ADMIN_EMAIL is required on first start.");
  if (password.length < 16) throw new Error("V79_HUB_ADMIN_PASSWORD must contain at least 16 characters on first start.");
  const userId=crypto.randomUUID(), orgId=`v79org_${crypto.randomUUID()}`, salt=crypto.randomBytes(16).toString("hex"), now=new Date().toISOString();
  const tx=db.transaction(()=>{
    db.prepare("INSERT INTO users(id,email,name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)").run(userId,email,name,salt,passwordDigest(password,salt),now);
    let slug=slugify(orgName), suffix=1;
    while(db.prepare("SELECT 1 FROM organizations WHERE slug=?").get(slug)) slug=`${slugify(orgName)}-${++suffix}`;
    db.prepare("INSERT INTO organizations(id,name,slug,created_at) VALUES(?,?,?,?)").run(orgId,orgName,slug,now);
    db.prepare("INSERT INTO memberships(user_id,organization_id,role,created_at) VALUES(?,?,?,?)").run(userId,orgId,"owner",now);
  });
  tx();
  console.warn("[V79 Hub] Initial owner and organisation created. Rotate the bootstrap password after first deployment.");
}
bootstrapOwner();

const productConfig = {
  ffpro: { name:"FFPRO", url:clean(process.env.FFPRO_BASE_URL), openUrl:clean(process.env.FFPRO_PUBLIC_URL) || clean(process.env.FFPRO_BASE_URL) },
  tiquet: { name:"V79 Tiquet", url:clean(process.env.TIQUET_BASE_URL), openUrl:clean(process.env.TIQUET_PUBLIC_URL) || clean(process.env.TIQUET_BASE_URL) },
  academy: { name:"V79 Academy", url:clean(process.env.ACADEMY_BASE_URL), openUrl:clean(process.env.ACADEMY_PUBLIC_URL) || clean(process.env.ACADEMY_BASE_URL) },
} as const;
type Product = keyof typeof productConfig;

async function fetchSummary(product: Product, externalSubjectId: string) {
  const cfg=productConfig[product];
  const secret=clean(process.env.V79_PLATFORM_SHARED_SECRET);
  if(!cfg.url) return {status:"not_configured",error:"Service URL is not configured."};
  if(secret.length<32) return {status:"not_configured",error:"Platform shared secret is not configured."};
  const pathname=`/api/platform/summary/${encodeURIComponent(externalSubjectId)}`;
  const timestamp=String(Date.now());
  const signature=signPlatformRequest({method:"GET",pathname,timestamp,body:"",secret});
  try{
    const response=await fetch(new URL(pathname,cfg.url),{
      headers:{
        "x-v79-service-id":"v79-hub",
        "x-v79-timestamp":timestamp,
        "x-v79-signature":signature,
      },
      signal:AbortSignal.timeout(5000),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok) return {status:"error",error:body?.error || `Service returned HTTP ${response.status}`};
    return {status:"connected",summary:body};
  }catch(error:any){
    return {status:"offline",error:error?.name==="TimeoutError"?"Service timed out.":"Service is currently unreachable."};
  }
}

app.get("/api/health", (_req,res)=>{
  try { db.prepare("SELECT 1").get(); res.json({status:"ok"}); }
  catch { res.status(503).json({status:"storage_unavailable"}); }
});
app.post("/api/auth/login", loginLimited, (req,res)=>{
  const email=clean(req.body?.email).toLowerCase(), password=String(req.body?.password || "");
  if(!email || !password) return res.status(400).json({error:"Email and password are required."});
  const user=db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;
  const candidate=passwordDigest(password,user?.password_salt || "invalid-v79-hub-salt");
  if(!user || !constantEqualHex(candidate,user.password_hash)) return res.status(401).json({error:"Email or password is incorrect."});
  const token=crypto.randomBytes(32).toString("base64url"), now=new Date().toISOString();
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").run(hashToken(token),user.id,Date.now()+SESSION_TTL_MS,now);
  setSessionCookie(res,token);
  const m=membership(user.id);
  res.json({user:{id:user.id,email:user.email,name:user.name},organization:m?{id:m.organizationId,name:m.organizationName,slug:m.slug,role:m.role}:null});
});
app.post("/api/auth/logout", (req,res)=>{
  const token=cookieValue(req,SESSION_COOKIE);
  if(token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
  clearSessionCookie(res); res.json({success:true});
});
app.get("/api/auth/me", requireAuth, (req,res)=>{
  const user=(req as any).hubUser, m=(req as any).hubMembership;
  res.json({user,organization:{id:m.organizationId,name:m.organizationName,slug:m.slug,role:m.role}});
});
app.get("/api/integrations", requireAuth, (req,res)=>{
  const m=(req as any).hubMembership;
  const rows=db.prepare("SELECT product,external_subject_id AS externalSubjectId,enabled,updated_at AS updatedAt FROM integrations WHERE organization_id=?").all(m.organizationId) as any[];
  const byProduct=Object.fromEntries(rows.map(row=>[row.product,row]));
  res.json((Object.keys(productConfig) as Product[]).map(product=>({
    product,
    name:productConfig[product].name,
    linked:Boolean(byProduct[product]?.enabled),
    externalSubjectId:byProduct[product]?.externalSubjectId || "",
    openUrl:productConfig[product].openUrl || "",
    updatedAt:byProduct[product]?.updatedAt || null,
  })));
});
app.put("/api/integrations/:product", requireAuth, requireAdmin, (req,res)=>{
  const product=req.params.product as Product;
  if(!(product in productConfig)) return res.status(404).json({error:"Unknown V79 product."});
  const externalSubjectId=clean(req.body?.externalSubjectId);
  if(!/^[A-Za-z0-9._:@-]{1,180}$/.test(externalSubjectId)) return res.status(400).json({error:"Enter a valid product account identifier."});
  const m=(req as any).hubMembership, now=new Date().toISOString();
  db.prepare(`INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at)
    VALUES(?,?,?,?,?) ON CONFLICT(organization_id,product) DO UPDATE SET external_subject_id=excluded.external_subject_id,enabled=1,updated_at=excluded.updated_at`)
    .run(m.organizationId,product,externalSubjectId,1,now);
  res.json({success:true});
});
app.delete("/api/integrations/:product", requireAuth, requireAdmin, (req,res)=>{
  const m=(req as any).hubMembership;
  db.prepare("DELETE FROM integrations WHERE organization_id=? AND product=?").run(m.organizationId,req.params.product);
  res.json({success:true});
});
app.get("/api/platform/dashboard", requireAuth, async (req,res)=>{
  const m=(req as any).hubMembership;
  const rows=db.prepare("SELECT product,external_subject_id AS externalSubjectId FROM integrations WHERE organization_id=? AND enabled=1").all(m.organizationId) as any[];
  const integrations=Object.fromEntries(rows.map(row=>[row.product,row.externalSubjectId]));
  const products:any={};
  await Promise.all((Object.keys(productConfig) as Product[]).map(async product=>{
    const subject=integrations[product];
    products[product]=subject ? await fetchSummary(product,subject) : {status:"unlinked"};
    products[product].name=productConfig[product].name;
    products[product].openUrl=productConfig[product].openUrl || "";
  }));
  const events=db.prepare("SELECT id,type,source,occurred_at AS occurredAt FROM events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 10").all(m.organizationId);
  res.json({organization:{id:m.organizationId,name:m.organizationName,slug:m.slug},products,events});
});

if(!production){
  const vite=await createViteServer({server:{middlewareMode:true},appType:"spa"});
  app.use(vite.middlewares);
}else{
  const dist=path.join(__dirname,"dist");
  app.use("/assets",express.static(path.join(dist,"assets"),{immutable:true,maxAge:"1y"}));
  app.use(express.static(dist,{index:false,maxAge:"1d"}));
  app.get("*",(_req,res)=>res.sendFile(path.join(dist,"index.html")));
}
app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  console.error("[V79 Hub]",err?.message || err);
  if(res.headersSent) return res.end();
  res.status(500).json({error:"Request failed."});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`V79 Hub listening on ${PORT}`));
