import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { signPlatformRequest, verifyPlatformRequest } from "./server/platform-contract.mjs";

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
app.use(express.json({
  limit: "256kb",
  verify: (req: any, _res, buf) => { req.rawBody = Buffer.from(buf); },
}));
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
  product TEXT NOT NULL CHECK(product IN ('ffpro','tiquet','academy','marketing')),
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
CREATE TABLE IF NOT EXISTS subscriptions (
  organization_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK(plan IN ('start','business','advantage')),
  status TEXT NOT NULL CHECK(status IN ('trialing','active','past_due','cancelled','suspended')),
  trial_ends_at TEXT,
  current_period_end TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS app_launch_tickets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('marketing')),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
`);

function migrateIntegrationsForMarketing() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='integrations'").get() as any;
  const sql = String(row?.sql || "");
  if (!sql || sql.includes("'marketing'")) return;
  db.pragma("foreign_keys = OFF");
  try {
    db.exec(`
      ALTER TABLE integrations RENAME TO integrations_legacy;
      CREATE TABLE integrations (
        organization_id TEXT NOT NULL,
        product TEXT NOT NULL CHECK(product IN ('ffpro','tiquet','academy','marketing')),
        external_subject_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(organization_id, product),
        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      );
      INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at)
        SELECT organization_id,product,external_subject_id,enabled,updated_at FROM integrations_legacy;
      DROP TABLE integrations_legacy;
    `);
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
migrateIntegrationsForMarketing();

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^['"]|['"]$/g, "") : "";
}
const PLAN_CATALOG = {
  start: {
    name:"V79 Start",
    monthlyXcd:149,
    annualXcd:1639,
    includedUsers:2,
    products:["ffpro","tiquet"],
  },
  business: {
    name:"V79 Business",
    monthlyXcd:299,
    annualXcd:3289,
    includedUsers:5,
    products:["ffpro","tiquet","marketing"],
  },
  advantage: {
    name:"V79 Advantage",
    monthlyXcd:499,
    annualXcd:5489,
    includedUsers:10,
    products:["ffpro","tiquet","marketing"],
  },
} as const;
type PlanName = keyof typeof PLAN_CATALOG;
const TRIAL_DAYS = Math.min(30, Math.max(0, Number(process.env.V79_TRIAL_DAYS || 14)));
const SELF_SERVICE_SIGNUP = process.env.V79_SELF_SERVICE_SIGNUP === "1";

function validPlan(value: unknown): value is PlanName {
  return typeof value === "string" && value in PLAN_CATALOG;
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
  if (["GET","HEAD","OPTIONS"].includes(req.method) || !req.path.startsWith("/api/") || ["/api/platform/events","/api/platform/session/consume"].includes(req.path)) return next();
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
  db.prepare("DELETE FROM app_launch_tickets WHERE expires_at <= ?").run(now);
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
    db.prepare("INSERT INTO subscriptions(organization_id,plan,status,trial_ends_at,current_period_end,updated_at) VALUES(?,?,?,?,?,?)")
      .run(orgId,"advantage","active",null,null,now);
    db.prepare("INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at) VALUES(?,?,?,?,?)")
      .run(orgId,"marketing",orgId,1,now);
  });
  tx();
  console.warn("[V79 Hub] Initial owner and organisation created. Rotate the bootstrap password after first deployment.");
}
bootstrapOwner();

function ensureBootstrapAccess() {
  const email = clean(process.env.V79_HUB_ADMIN_EMAIL).toLowerCase();
  if (!email) return;
  const row = db.prepare(`
    SELECT o.id AS organizationId
    FROM users u
    JOIN memberships m ON m.user_id=u.id
    JOIN organizations o ON o.id=m.organization_id
    WHERE u.email=? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1
  `).get(email) as any;
  if (!row) return;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO subscriptions(organization_id,plan,status,trial_ends_at,current_period_end,updated_at)
    VALUES(?, 'advantage','active',NULL,NULL,?)
    ON CONFLICT(organization_id) DO NOTHING
  `).run(row.organizationId,now);
  db.prepare(`
    INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at)
    VALUES(?, 'marketing', ?, 1, ?)
    ON CONFLICT(organization_id,product) DO UPDATE SET external_subject_id=excluded.external_subject_id,enabled=1,updated_at=excluded.updated_at
  `).run(row.organizationId,row.organizationId,now);
}
ensureBootstrapAccess();

function subscriptionFor(organizationId: string) {
  return db.prepare("SELECT plan,status,trial_ends_at AS trialEndsAt,current_period_end AS currentPeriodEnd,updated_at AS updatedAt FROM subscriptions WHERE organization_id=?").get(organizationId) as any;
}

function productEntitled(organizationId: string, product: string) {
  if (product === "academy") return true;
  const subscription = subscriptionFor(organizationId);
  if (!subscription || !["active","trialing"].includes(subscription.status)) return false;
  if (subscription.status === "trialing") {
    const trialEnd = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() : 0;
    if (!Number.isFinite(trialEnd) || trialEnd <= Date.now()) return false;
  }
  if (subscription.status === "active" && subscription.currentPeriodEnd) {
    const periodEnd = new Date(subscription.currentPeriodEnd).getTime();
    if (Number.isFinite(periodEnd) && periodEnd <= Date.now()) return false;
  }
  const plan = PLAN_CATALOG[subscription.plan as PlanName];
  return Boolean(plan?.products.includes(product as any));
}

function ensureManagedIntegrations(organizationId: string) {
  if (!productEntitled(organizationId,"marketing")) return;
  const now=new Date().toISOString();
  db.prepare(`
    INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at)
    VALUES(?, 'marketing', ?, 1, ?)
    ON CONFLICT(organization_id,product) DO UPDATE SET external_subject_id=excluded.external_subject_id,enabled=1,updated_at=excluded.updated_at
  `).run(organizationId,organizationId,now);
}

const productConfig = {
  ffpro: { name:"FFPRO", url:clean(process.env.FFPRO_BASE_URL), openUrl:clean(process.env.FFPRO_PUBLIC_URL) || clean(process.env.FFPRO_BASE_URL) },
  tiquet: { name:"V79 Tiquet", url:clean(process.env.TIQUET_BASE_URL), openUrl:clean(process.env.TIQUET_PUBLIC_URL) || clean(process.env.TIQUET_BASE_URL) },
  academy: { name:"V79 Academy", url:clean(process.env.ACADEMY_BASE_URL), openUrl:clean(process.env.ACADEMY_PUBLIC_URL) || clean(process.env.ACADEMY_BASE_URL) },
  marketing: {
    name:"V79 Marketing",
    url:clean(process.env.MARKETING_BASE_URL),
    openUrl:"/api/apps/marketing/launch",
    publicUrl:clean(process.env.MARKETING_PUBLIC_URL) || "https://marketing.v79sl.com",
  },
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


const EVENT_SOURCE_PRODUCTS: Record<string, Product | null> = {
  website: null,
  tiquet: "tiquet",
  ffpro: "ffpro",
  academy: "academy",
  marketing: "marketing",
};

function eventSecretFor(source: string) {
  const names: Record<string, string> = {
    website: "V79_WEBSITE_EVENT_SECRET",
    tiquet: "V79_TIQUET_EVENT_SECRET",
    ffpro: "V79_FFPRO_EVENT_SECRET",
    academy: "V79_ACADEMY_EVENT_SECRET",
    marketing: "V79_MARKETING_EVENT_SECRET",
  };
  return clean(process.env[names[source] || ""]);
}

function validateIncomingEvent(body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Invalid event.";
  if (typeof body.id !== "string" || !/^[A-Za-z0-9._:-]{8,160}$/.test(body.id)) return "Invalid event id.";
  if (typeof body.type !== "string" || !/^[a-z0-9][a-z0-9._-]{2,100}$/.test(body.type)) return "Invalid event type.";
  if (body.version !== 1) return "Unsupported event version.";
  if (typeof body.occurredAt !== "string" || !Number.isFinite(Date.parse(body.occurredAt))) return "Invalid event timestamp.";
  if (typeof body.organizationRef !== "string" || body.organizationRef.length < 1 || body.organizationRef.length > 254) return "Invalid organisation reference.";
  if (body.subjectId != null && (typeof body.subjectId !== "string" || body.subjectId.length > 254)) return "Invalid subject id.";
  if (body.correlationId != null && (typeof body.correlationId !== "string" || body.correlationId.length > 160)) return "Invalid correlation id.";
  if (body.payload != null && (typeof body.payload !== "object" || Array.isArray(body.payload))) return "Event payload must be an object.";
  if (Buffer.byteLength(JSON.stringify(body.payload || {}), "utf8") > 24 * 1024) return "Event payload is too large.";
  return "";
}

function resolveEventOrganization(source: string, organizationRef: string) {
  if (source === "website") {
    return db.prepare("SELECT id,name,slug FROM organizations WHERE slug=?").get(organizationRef) as any;
  }
  const product = EVENT_SOURCE_PRODUCTS[source];
  if (!product) return null;
  return db.prepare(`
    SELECT o.id,o.name,o.slug
    FROM integrations i JOIN organizations o ON o.id=i.organization_id
    WHERE i.product=? AND i.external_subject_id=? AND i.enabled=1
    LIMIT 1
  `).get(product, organizationRef) as any;
}

app.post("/api/platform/events", (req: any, res) => {
  const source = clean(req.get("x-v79-service-id")).toLowerCase();
  if (!(source in EVENT_SOURCE_PRODUCTS)) return res.status(401).json({ error: "Unknown V79 event source." });

  const secret = eventSecretFor(source);
  if (secret.length < 32) return res.status(503).json({ error: `Event ingestion is not configured for ${source}.` });

  const timestamp = clean(req.get("x-v79-timestamp"));
  const signature = clean(req.get("x-v79-signature"));
  const bodyText = req.rawBody ? Buffer.from(req.rawBody).toString("utf8") : JSON.stringify(req.body || {});
  const verified = verifyPlatformRequest({
    method: req.method,
    pathname: "/api/platform/events",
    timestamp,
    body: bodyText,
    secret,
    signature,
  });
  if (!verified) return res.status(401).json({ error: "Invalid or expired V79 event signature." });

  const validationError = validateIncomingEvent(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const event = req.body;
  const organization = resolveEventOrganization(source, event.organizationRef);
  if (!organization) return res.status(409).json({ error: "No Hub organisation is linked to this source reference.", code: "ORGANIZATION_NOT_LINKED" });

  const existing = db.prepare("SELECT id FROM events WHERE id=?").get(event.id);
  if (existing) return res.status(200).json({ accepted: true, duplicate: true, eventId: event.id });

  const storedPayload = JSON.stringify({
    version: event.version,
    organizationRef: event.organizationRef,
    subjectId: event.subjectId || null,
    correlationId: event.correlationId || null,
    payload: event.payload || {},
  });
  db.prepare("INSERT INTO events(id,organization_id,type,source,occurred_at,payload_json,created_at) VALUES(?,?,?,?,?,?,?)")
    .run(event.id, organization.id, event.type, source, new Date(event.occurredAt).toISOString(), storedPayload, new Date().toISOString());

  res.status(202).json({ accepted: true, duplicate: false, eventId: event.id });
});

app.get("/api/health", (_req,res)=>{
  try { db.prepare("SELECT 1").get(); res.json({status:"ok"}); }
  catch { res.status(503).json({status:"storage_unavailable"}); }
});
app.get("/api/plans", (_req,res)=>{
  res.json({
    currency:"XCD",
    trialDays:TRIAL_DAYS,
    selfServiceSignup:SELF_SERVICE_SIGNUP,
    plans:Object.entries(PLAN_CATALOG).map(([id,plan])=>({id,...plan})),
  });
});

app.post("/api/auth/register", loginLimited, (req,res)=>{
  if(!SELF_SERVICE_SIGNUP) return res.status(403).json({error:"Online registration is not currently open. Contact V79 Digital."});
  const email=clean(req.body?.email).toLowerCase();
  const password=String(req.body?.password || "");
  const name=clean(req.body?.name);
  const organizationName=clean(req.body?.organizationName);
  const plan=clean(req.body?.plan).toLowerCase();

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:"Enter a valid email address."});
  if(password.length<16 || password.length>256) return res.status(400).json({error:"Use a password of 16–256 characters."});
  if(name.length<2 || name.length>120) return res.status(400).json({error:"Enter your name."});
  if(organizationName.length<2 || organizationName.length>160) return res.status(400).json({error:"Enter your business or organisation name."});
  if(!validPlan(plan)) return res.status(400).json({error:"Choose a valid V79 plan."});
  if(db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) return res.status(409).json({error:"An account with this email already exists."});

  const userId=crypto.randomUUID();
  const orgId=`v79org_${crypto.randomUUID()}`;
  const salt=crypto.randomBytes(16).toString("hex");
  const now=new Date().toISOString();
  const trialEndsAt=TRIAL_DAYS>0 ? new Date(Date.now()+TRIAL_DAYS*24*60*60_000).toISOString() : now;
  let slug=slugify(organizationName), suffix=1;
  while(db.prepare("SELECT 1 FROM organizations WHERE slug=?").get(slug)) slug=`${slugify(organizationName)}-${++suffix}`;

  const tx=db.transaction(()=>{
    db.prepare("INSERT INTO users(id,email,name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)")
      .run(userId,email,name,salt,passwordDigest(password,salt),now);
    db.prepare("INSERT INTO organizations(id,name,slug,created_at) VALUES(?,?,?,?)")
      .run(orgId,organizationName,slug,now);
    db.prepare("INSERT INTO memberships(user_id,organization_id,role,created_at) VALUES(?,?,?,?)")
      .run(userId,orgId,"owner",now);
    db.prepare("INSERT INTO subscriptions(organization_id,plan,status,trial_ends_at,current_period_end,updated_at) VALUES(?,?,?,?,?,?)")
      .run(orgId,plan,"trialing",trialEndsAt,null,now);
  });
  tx();
  ensureManagedIntegrations(orgId);

  const token=crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .run(hashToken(token),userId,Date.now()+SESSION_TTL_MS,now);
  setSessionCookie(res,token);
  res.status(201).json({
    user:{id:userId,email,name},
    organization:{id:orgId,name:organizationName,slug,role:"owner"},
    subscription:subscriptionFor(orgId),
  });
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
  res.json({
    user,
    organization:{id:m.organizationId,name:m.organizationName,slug:m.slug,role:m.role},
    subscription: subscriptionFor(m.organizationId) || null,
  });
});
app.put("/api/auth/password", requireAuth, (req,res)=>{
  const currentPassword=String(req.body?.currentPassword || "");
  const newPassword=String(req.body?.newPassword || "");
  if(newPassword.length<16 || newPassword.length>256) return res.status(400).json({error:"Use a new password of 16–256 characters."});
  const user=(req as any).hubUser;
  const record=db.prepare("SELECT password_salt,password_hash FROM users WHERE id=?").get(user.id) as any;
  if(!record || !constantEqualHex(passwordDigest(currentPassword,record.password_salt),record.password_hash)) {
    return res.status(401).json({error:"Current password is incorrect."});
  }
  const salt=crypto.randomBytes(16).toString("hex");
  db.prepare("UPDATE users SET password_salt=?,password_hash=? WHERE id=?").run(salt,passwordDigest(newPassword,salt),user.id);
  const token=cookieValue(req,SESSION_COOKIE);
  db.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").run(user.id,hashToken(token));
  res.json({success:true});
});

app.get("/api/apps/marketing/launch", requireAuth, (req,res)=>{
  const user=(req as any).hubUser, m=(req as any).hubMembership;
  if (!productEntitled(m.organizationId,"marketing")) {
    return res.status(403).json({
      error:"Your current V79 subscription does not include V79 Marketing.",
      code:"ENTITLEMENT_REQUIRED",
      subscription:subscriptionFor(m.organizationId) || null,
    });
  }
  const publicUrl=(productConfig.marketing as any).publicUrl;
  if(!publicUrl) return res.status(503).json({error:"V79 Marketing public URL is not configured."});
  const token=crypto.randomBytes(32).toString("base64url");
  const now=new Date().toISOString();
  db.prepare("DELETE FROM app_launch_tickets WHERE user_id=? AND product='marketing'").run(user.id);
  db.prepare("INSERT INTO app_launch_tickets(token_hash,user_id,organization_id,product,expires_at,created_at) VALUES(?,?,?,?,?,?)")
    .run(hashToken(token),user.id,m.organizationId,"marketing",Date.now()+2*60_000,now);
  db.prepare(`
    INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at)
    VALUES(?, 'marketing', ?, 1, ?)
    ON CONFLICT(organization_id,product) DO UPDATE SET external_subject_id=excluded.external_subject_id,enabled=1,updated_at=excluded.updated_at
  `).run(m.organizationId,m.organizationId,now);
  const target=new URL("/api/platform/launch",publicUrl);
  target.searchParams.set("ticket",token);
  res.redirect(302,target.toString());
});

app.post("/api/platform/session/consume", (req:any,res)=>{
  const source=clean(req.get("x-v79-service-id"));
  if(source!=="v79-marketing") return res.status(401).json({error:"Unknown V79 launch consumer."});
  const secret=clean(process.env.V79_MARKETING_LAUNCH_SECRET);
  if(secret.length<32) return res.status(503).json({error:"Marketing launch integration is not configured."});
  const timestamp=clean(req.get("x-v79-timestamp"));
  const signature=clean(req.get("x-v79-signature"));
  const bodyText=req.rawBody ? Buffer.from(req.rawBody).toString("utf8") : JSON.stringify(req.body || {});
  const verified=verifyPlatformRequest({
    method:req.method,
    pathname:"/api/platform/session/consume",
    timestamp,
    body:bodyText,
    secret,
    signature,
  });
  if(!verified) return res.status(401).json({error:"Invalid or expired V79 launch signature."});

  const ticket=clean(req.body?.ticket);
  const product=clean(req.body?.product);
  if(product!=="marketing" || !/^[A-Za-z0-9_-]{32,180}$/.test(ticket)) return res.status(400).json({error:"Invalid launch request."});
  const tokenHash=hashToken(ticket);
  const row=db.prepare(`
    SELECT t.user_id AS userId,t.organization_id AS organizationId,t.expires_at AS expiresAt,
      u.email,u.name,o.name AS organizationName,o.slug,m.role
    FROM app_launch_tickets t
    JOIN users u ON u.id=t.user_id
    JOIN organizations o ON o.id=t.organization_id
    JOIN memberships m ON m.user_id=t.user_id AND m.organization_id=t.organization_id
    WHERE t.token_hash=? AND t.product='marketing'
  `).get(tokenHash) as any;
  if(!row || row.expiresAt<=Date.now()) {
    if(row) db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
    return res.status(401).json({error:"Launch ticket is invalid or expired."});
  }
  if(!productEntitled(row.organizationId,"marketing")) {
    db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
    return res.status(403).json({error:"V79 Marketing is not included in this subscription."});
  }
  db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
  const subscription=subscriptionFor(row.organizationId);
  res.json({
    user:{id:row.userId,email:row.email,name:row.name},
    organization:{id:row.organizationId,name:row.organizationName,slug:row.slug},
    role:row.role,
    plan:subscription?.plan || null,
    entitlement:{product:"marketing",enabled:true},
  });
});

app.get("/api/integrations", requireAuth, (req,res)=>{
  const m=(req as any).hubMembership;
  ensureManagedIntegrations(m.organizationId);
  const rows=db.prepare("SELECT product,external_subject_id AS externalSubjectId,enabled,updated_at AS updatedAt FROM integrations WHERE organization_id=?").all(m.organizationId) as any[];
  const byProduct=Object.fromEntries(rows.map(row=>[row.product,row]));
  res.json((Object.keys(productConfig) as Product[]).map(product=>({
    product,
    name:productConfig[product].name,
    linked:Boolean(byProduct[product]?.enabled),
    externalSubjectId:byProduct[product]?.externalSubjectId || "",
    openUrl:productConfig[product].openUrl || "",
    entitled:productEntitled(m.organizationId,product),
    managedByHub:product === "marketing",
    updatedAt:byProduct[product]?.updatedAt || null,
  })));
});
app.put("/api/integrations/:product", requireAuth, requireAdmin, (req,res)=>{
  const product=req.params.product as Product;
  if(product==="marketing") return res.status(409).json({error:"V79 Marketing is linked automatically by Hub identity."});
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
  if(req.params.product==="marketing") return res.status(409).json({error:"V79 Marketing is managed by the Hub subscription."});
  const m=(req as any).hubMembership;
  db.prepare("DELETE FROM integrations WHERE organization_id=? AND product=?").run(m.organizationId,req.params.product);
  res.json({success:true});
});
app.get("/api/platform/dashboard", requireAuth, async (req,res)=>{
  const m=(req as any).hubMembership;
  ensureManagedIntegrations(m.organizationId);
  const rows=db.prepare("SELECT product,external_subject_id AS externalSubjectId FROM integrations WHERE organization_id=? AND enabled=1").all(m.organizationId) as any[];
  const integrations=Object.fromEntries(rows.map(row=>[row.product,row.externalSubjectId]));
  const products:any={};
  await Promise.all((Object.keys(productConfig) as Product[]).map(async product=>{
    const subject=integrations[product];
    products[product]=subject ? await fetchSummary(product,subject) : {status:"unlinked"};
    products[product].name=productConfig[product].name;
    products[product].openUrl=productConfig[product].openUrl || "";
    products[product].entitled=productEntitled(m.organizationId,product);
  }));
  const events=(db.prepare("SELECT id,type,source,occurred_at AS occurredAt,payload_json AS payloadJson FROM events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 20").all(m.organizationId) as any[])
    .map(event => {
      let details:any={};
      try { details=JSON.parse(event.payloadJson || "{}"); } catch {}
      return { id:event.id,type:event.type,source:event.source,occurredAt:event.occurredAt,details };
    });
  res.json({
    organization:{id:m.organizationId,name:m.organizationName,slug:m.slug},
    subscription:subscriptionFor(m.organizationId) || null,
    products,
    events
  });
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
