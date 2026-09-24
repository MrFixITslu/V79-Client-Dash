import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { signPlatformRequest, verifyPlatformRequest } from "./server/platform-contract.mjs";
import { addBillingPeriod, normalizeMoney, verifyWipayResponse } from "./server/billing-contract.mjs";

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
  product TEXT NOT NULL CHECK(product IN ('ffpro','tiquet','marketing')),
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

function migrateLaunchTicketsForHubApps() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='app_launch_tickets'").get() as any;
  const sql = String(row?.sql || "");
  if (!sql || (sql.includes("'ffpro'") && sql.includes("'tiquet'"))) return;
  db.pragma("foreign_keys = OFF");
  try {
    db.exec(`
      ALTER TABLE app_launch_tickets RENAME TO app_launch_tickets_legacy;
      CREATE TABLE app_launch_tickets (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        product TEXT NOT NULL CHECK(product IN ('ffpro','tiquet','marketing')),
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      );
      INSERT INTO app_launch_tickets(token_hash,user_id,organization_id,product,expires_at,created_at)
        SELECT token_hash,user_id,organization_id,product,expires_at,created_at
        FROM app_launch_tickets_legacy
        WHERE product IN ('marketing');
      DROP TABLE app_launch_tickets_legacy;
    `);
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
migrateLaunchTicketsForHubApps();

db.exec(`
CREATE TABLE IF NOT EXISTS member_product_access (
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('tiquet','marketing')),
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, organization_id, product),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','member')),
  products_json TEXT NOT NULL DEFAULT '[]',
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org_status ON team_invitations(organization_id,status,expires_at);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE TABLE IF NOT EXISTS billing_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK(plan IN ('start','business','advantage')),
  billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly','annual')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','checkout_ready','paid','failed','cancelled')),
  last_error TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_billing_orders_org_created ON billing_orders(organization_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_orders_provider_transaction
  ON billing_orders(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
`);

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
function requireOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
  if ((req as any).hubMembership?.role !== "owner") return res.status(403).json({ error: "Organisation owner access is required for billing." });
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
  db.prepare("UPDATE team_invitations SET status='expired' WHERE status='pending' AND expires_at <= ?").run(now);
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

function subscriptionUsable(organizationId: string) {
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
  return true;
}

function productEntitled(organizationId: string, product: string) {
  if (product === "academy") return true;
  if (!subscriptionUsable(organizationId)) return false;
  const subscription = subscriptionFor(organizationId);
  const plan = PLAN_CATALOG[subscription.plan as PlanName];
  return Boolean(plan?.products.includes(product as any));
}

function planSeatLimit(organizationId: string) {
  const subscription = subscriptionFor(organizationId);
  const plan = subscription && PLAN_CATALOG[subscription.plan as PlanName];
  return Number(plan?.includedUsers || 1);
}

function seatUsage(organizationId: string) {
  const members = Number((db.prepare("SELECT COUNT(*) AS count FROM memberships WHERE organization_id=?").get(organizationId) as any)?.count || 0);
  const pendingInvites = Number((db.prepare("SELECT COUNT(*) AS count FROM team_invitations WHERE organization_id=? AND status='pending' AND expires_at>?").get(organizationId,Date.now()) as any)?.count || 0);
  return { members, pendingInvites, used: members + pendingInvites, limit: planSeatLimit(organizationId) };
}

function memberProducts(userId: string, organizationId: string) {
  return (db.prepare("SELECT product FROM member_product_access WHERE user_id=? AND organization_id=? AND enabled=1 ORDER BY product").all(userId,organizationId) as any[])
    .map(row => String(row.product));
}

function memberCanAccessProduct(userId: string, organizationId: string, role: string, product: string) {
  // Academy learner accounts remain independent of Hub. A linked learner summary
  // is business administration data, so only the Hub owner/admin can see it.
  if (product === "academy") return ["owner","admin"].includes(role);
  if (!productEntitled(organizationId, product)) return false;
  if (role === "owner") return true;
  if (product === "ffpro") return false;
  return Boolean(db.prepare("SELECT 1 FROM member_product_access WHERE user_id=? AND organization_id=? AND product=? AND enabled=1").get(userId,organizationId,product));
}

function assignMemberProducts(userId: string, organizationId: string, requested: unknown) {
  const allowed = new Set(["tiquet","marketing"]);
  const products = Array.isArray(requested)
    ? [...new Set(requested.map(v=>clean(v).toLowerCase()).filter(v=>allowed.has(v) && productEntitled(organizationId,v)))]
    : [];
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM member_product_access WHERE user_id=? AND organization_id=?").run(userId,organizationId);
    for (const product of products) {
      db.prepare("INSERT INTO member_product_access(user_id,organization_id,product,enabled,updated_at) VALUES(?,?,?,?,?)")
        .run(userId,organizationId,product,1,now);
    }
  });
  tx();
  return products;
}

function ensureManagedIntegrations(organizationId: string) {
  const now=new Date().toISOString();
  for (const product of ["ffpro","tiquet","marketing"] as const) {
    if (!productEntitled(organizationId,product)) continue;
    db.prepare(`
      INSERT INTO integrations(organization_id,product,external_subject_id,enabled,updated_at)
      VALUES(?, ?, ?, 1, ?)
      ON CONFLICT(organization_id,product) DO NOTHING
    `).run(organizationId,product,organizationId,now);
  }
}

type BillingCycle = "monthly" | "annual";

function billingAmount(plan: PlanName, cycle: BillingCycle) {
  const catalog=PLAN_CATALOG[plan];
  const xcd=cycle==="annual" ? catalog.annualXcd : catalog.monthlyXcd;
  return { amountMinor: Math.round(xcd*100), amount: xcd.toFixed(2) };
}

function wipayConfig() {
  const provider=clean(process.env.V79_BILLING_PROVIDER).toLowerCase() || "disabled";
  const paymentUrl=clean(process.env.WIPAY_PAYMENT_URL);
  const accountNumber=clean(process.env.WIPAY_ACCOUNT_NUMBER);
  const apiKey=clean(process.env.WIPAY_API_KEY);
  const countryCode=clean(process.env.WIPAY_COUNTRY_CODE).toUpperCase();
  const currency=clean(process.env.WIPAY_CURRENCY).toUpperCase();
  const environment=clean(process.env.WIPAY_ENVIRONMENT).toLowerCase() || "sandbox";
  const extraHosts=clean(process.env.WIPAY_ALLOWED_HOSTS).split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
  let url:URL|null=null;
  try { if(paymentUrl) url=new URL(paymentUrl); } catch {}
  const configured=provider==="wipay"
    && Boolean(url)
    && url!.protocol==="https:"
    && accountNumber.length>0
    && apiKey.length>=3
    && /^[A-Z]{2}$/.test(countryCode)
    && currency==="XCD"
    && ["sandbox","live"].includes(environment);
  return {provider,paymentUrl,accountNumber,apiKey,countryCode,currency,environment,extraHosts,url,configured};
}

function billingProviderPublic() {
  const cfg=wipayConfig();
  return {
    id:cfg.provider,
    name:cfg.provider==="wipay" ? "WiPay" : "Not configured",
    configured:cfg.configured,
    environment:cfg.provider==="wipay" ? cfg.environment : null,
    currency:cfg.provider==="wipay" ? (cfg.currency || null) : null,
    countryCode:cfg.provider==="wipay" ? (cfg.countryCode || null) : null,
    hostedCheckout:true,
    cardDataStoredByV79:false,
  };
}

function trustedWipayCheckoutUrl(value:string,cfg:ReturnType<typeof wipayConfig>) {
  try {
    const target=new URL(value);
    if(target.protocol!=="https:") return "";
    const host=target.hostname.toLowerCase();
    const configuredHost=cfg.url?.hostname.toLowerCase() || "";
    const allowed=host===configuredHost || host==="wipayfinancial.com" || host.endsWith(".wipayfinancial.com") || cfg.extraHosts.includes(host);
    return allowed ? target.toString() : "";
  } catch { return ""; }
}

function billingReturnUrl(req:express.Request) {
  return new URL("/api/billing/wipay/return",canonicalOrigin(req)).toString();
}

function billingOrderView(row:any) {
  return {
    id:row.id,
    plan:row.plan,
    billingCycle:row.billing_cycle,
    amountXcd:Number(row.amount_minor||0)/100,
    currency:row.currency,
    provider:row.provider,
    status:row.status,
    providerTransactionId:row.provider_transaction_id || null,
    createdAt:row.created_at,
    paidAt:row.paid_at || null,
  };
}

const productConfig = {
  ffpro: {
    name:"FFPRO",
    url:clean(process.env.FFPRO_BASE_URL),
    openUrl:"/api/apps/ffpro/launch",
    publicUrl:clean(process.env.FFPRO_PUBLIC_URL) || "https://ffpro.v79sl.com",
  },
  tiquet: {
    name:"V79 Tiquet",
    url:clean(process.env.TIQUET_BASE_URL),
    openUrl:"/api/apps/tiquet/launch",
    publicUrl:clean(process.env.TIQUET_PUBLIC_URL) || "https://tiquet.v79sl.com",
  },
  academy: {
    name:"V79 Academy",
    url:clean(process.env.ACADEMY_BASE_URL),
    openUrl:clean(process.env.ACADEMY_PUBLIC_URL) || clean(process.env.ACADEMY_BASE_URL),
    publicUrl:clean(process.env.ACADEMY_PUBLIC_URL) || clean(process.env.ACADEMY_BASE_URL),
  },
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
    if(["ffpro","tiquet","marketing"].includes(product) && response.status===404) {
      return {status:"ready",error:`Open ${productConfig[product].name} to initialise this organisation's workspace.`};
    }
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
  const linked = db.prepare(`
    SELECT o.id,o.name,o.slug
    FROM integrations i JOIN organizations o ON o.id=i.organization_id
    WHERE i.product=? AND i.external_subject_id=? AND i.enabled=1
    LIMIT 1
  `).get(product, organizationRef) as any;
  if (linked) return linked;

  // Hub-managed apps use the stable Hub organisation id after first launch.
  // The source is authenticated with its own event secret, so this fallback
  // is safe only for products whose identity is controlled by Hub.
  if (["ffpro","tiquet","marketing"].includes(product)) {
    const organization = db.prepare("SELECT id,name,slug FROM organizations WHERE id=?").get(organizationRef) as any;
    if (organization && productEntitled(organization.id, product)) return organization;
  }
  return null;
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

app.get("/api/billing", requireAuth, requireOwner, (req,res)=>{
  const m=(req as any).hubMembership;
  const orders=(db.prepare(`
    SELECT id,plan,billing_cycle,amount_minor,currency,provider,provider_transaction_id,status,created_at,paid_at
    FROM billing_orders WHERE organization_id=? ORDER BY created_at DESC LIMIT 20
  `).all(m.organizationId) as any[]).map(billingOrderView);
  res.json({
    subscription:subscriptionFor(m.organizationId) || null,
    seats:seatUsage(m.organizationId),
    provider:billingProviderPublic(),
    plans:Object.entries(PLAN_CATALOG).map(([id,plan])=>({id,...plan})),
    orders,
  });
});

app.post("/api/billing/checkout", requireAuth, requireOwner, async (req,res)=>{
  const m=(req as any).hubMembership;
  const plan=clean(req.body?.plan).toLowerCase();
  const cycle=clean(req.body?.billingCycle).toLowerCase();
  if(!validPlan(plan)) return res.status(400).json({error:"Choose a valid V79 plan."});
  if(!["monthly","annual"].includes(cycle)) return res.status(400).json({error:"Choose monthly or annual billing."});
  const billingCycle=cycle as BillingCycle;
  const cfg=wipayConfig();
  if(!cfg.configured) return res.status(503).json({
    error:"Online billing is not configured yet. V79 will not collect card details until a verified payment gateway is enabled.",
    code:"PAYMENT_PROVIDER_NOT_CONFIGURED",
  });

  const targetPlan=PLAN_CATALOG[plan];
  const usage=seatUsage(m.organizationId);
  if(usage.used>targetPlan.includedUsers) return res.status(409).json({
    error:`V79 ${targetPlan.name.replace("V79 ","")} includes ${targetPlan.includedUsers} user seats, but this workspace currently uses or reserves ${usage.used}. Remove members or pending invitations before selecting this plan.`,
    code:"SEAT_LIMIT_CONFLICT",
  });

  const current=subscriptionFor(m.organizationId);
  if(current?.status==="active" && current.currentPeriodEnd && new Date(current.currentPeriodEnd).getTime()>Date.now() && current.plan!==plan) {
    return res.status(409).json({
      error:"Automated mid-period plan changes are not enabled yet. Keep the current plan until renewal or contact V79 Digital for a controlled plan change.",
      code:"ACTIVE_PLAN_CHANGE_REQUIRES_SUPPORT",
    });
  }

  const pricing=billingAmount(plan,billingCycle);
  const orderId=`v79_${crypto.randomBytes(12).toString("hex")}`;
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO billing_orders
    (id,organization_id,plan,billing_cycle,amount_minor,currency,provider,status,created_at)
    VALUES(?,?,?,?,?,'XCD','wipay','pending',?)`)
    .run(orderId,m.organizationId,plan,billingCycle,pricing.amountMinor,now);

  const fields=new URLSearchParams({
    account_number:cfg.accountNumber,
    country_code:cfg.countryCode,
    currency:cfg.currency,
    environment:cfg.environment,
    fee_structure:"merchant_absorb",
    method:"credit_card",
    order_id:orderId,
    origin:"V79-Hub",
    response_url:billingReturnUrl(req),
    total:pricing.amount,
    avs:"1",
    data:JSON.stringify({v:1,orderId}),
  });

  try {
    const response=await fetch(cfg.paymentUrl,{
      method:"POST",
      headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},
      body:fields.toString(),
      redirect:"manual",
      signal:AbortSignal.timeout(10_000),
    });
    let checkoutUrl="";
    let providerTransactionId="";
    if(response.status>=300 && response.status<400) {
      checkoutUrl=trustedWipayCheckoutUrl(response.headers.get("location") || "",cfg);
    } else {
      const payload:any=await response.json().catch(()=>null);
      checkoutUrl=trustedWipayCheckoutUrl(String(payload?.url || ""),cfg);
      providerTransactionId=clean(payload?.transaction_id);
    }

    // Safe browser-return activation requires the provider transaction id to be
    // bound to this order before the customer leaves V79.
    if(!response.ok && !(response.status>=300 && response.status<400)) throw new Error(`WiPay returned HTTP ${response.status}`);
    if(!checkoutUrl) throw new Error("WiPay did not return a trusted hosted checkout URL.");
    if(!providerTransactionId) throw new Error("WiPay did not return a transaction identifier required for secure callback binding.");

    db.prepare("UPDATE billing_orders SET status='checkout_ready',provider_transaction_id=?,last_error=NULL WHERE id=?")
      .run(providerTransactionId,orderId);
    res.json({checkoutUrl,order:billingOrderView(db.prepare("SELECT * FROM billing_orders WHERE id=?").get(orderId))});
  } catch(error:any) {
    const detail=String(error?.message || "Payment gateway unavailable").slice(0,240);
    db.prepare("UPDATE billing_orders SET status='failed',last_error=? WHERE id=?").run(detail,orderId);
    console.warn("[V79 Billing] WiPay checkout creation failed:",detail);
    res.status(502).json({error:"The payment gateway did not create a secure checkout. No payment was taken. Please retry later.",code:"PAYMENT_GATEWAY_UNAVAILABLE"});
  }
});

app.get("/api/billing/wipay/return", (req,res)=>{
  const cfg=wipayConfig();
  const status=clean(req.query.status).toLowerCase();
  const orderId=clean(req.query.order_id);
  const transactionId=clean(req.query.transaction_id);
  const totalText=clean(req.query.total);
  const responseHash=clean(req.query.hash);
  const currency=clean(req.query.currency).toUpperCase();
  const back=new URL("/",canonicalOrigin(req));

  if(status!=="success") {
    back.searchParams.set("billing","failed");
    return res.redirect(302,back.toString());
  }
  const order=db.prepare("SELECT * FROM billing_orders WHERE id=? AND provider='wipay'").get(orderId) as any;
  const total=normalizeMoney(totalText);
  const expected=order ? Number(order.amount_minor||0)/100 : NaN;
  const valid=cfg.configured
    && order
    && order.status!=="failed"
    && order.provider_transaction_id
    && transactionId===order.provider_transaction_id
    && currency===order.currency
    && total!==null
    && total+0.0001>=expected
    && verifyWipayResponse({transactionId,total:totalText,apiKey:cfg.apiKey,hash:responseHash});

  if(!valid) {
    console.warn("[V79 Billing] Rejected unverifiable WiPay return", {orderId,transactionId,status});
    back.searchParams.set("billing","verification_failed");
    return res.redirect(302,back.toString());
  }

  if(order.status!=="paid") {
    const current=subscriptionFor(order.organization_id);
    const currentEnd=current?.status==="active" && current?.plan===order.plan && current.currentPeriodEnd
      ? new Date(current.currentPeriodEnd)
      : new Date();
    const base=Number.isFinite(currentEnd.getTime()) && currentEnd.getTime()>Date.now() ? currentEnd : new Date();
    const periodEnd=addBillingPeriod(base,order.billing_cycle).toISOString();
    const now=new Date().toISOString();
    const tx=db.transaction(()=>{
      db.prepare("UPDATE billing_orders SET status='paid',paid_at=?,last_error=NULL WHERE id=?").run(now,order.id);
      db.prepare(`
        INSERT INTO subscriptions(organization_id,plan,status,trial_ends_at,current_period_end,updated_at)
        VALUES(?,?,'active',NULL,?,?)
        ON CONFLICT(organization_id) DO UPDATE SET
          plan=excluded.plan,status='active',trial_ends_at=NULL,current_period_end=excluded.current_period_end,updated_at=excluded.updated_at
      `).run(order.organization_id,order.plan,periodEnd,now);
    });
    tx();
    ensureManagedIntegrations(order.organization_id);
  }

  back.searchParams.set("billing","success");
  res.redirect(302,back.toString());
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

app.get("/api/team/invitations/:token", (req,res)=>{
  const token=clean(req.params.token);
  if(!/^[A-Za-z0-9_-]{32,180}$/.test(token)) return res.status(404).json({error:"Invite not found."});
  const invite=db.prepare(`
    SELECT i.id,i.email,i.role,i.products_json AS productsJson,i.expires_at AS expiresAt,i.status,
      o.name AS organizationName
    FROM team_invitations i JOIN organizations o ON o.id=i.organization_id
    WHERE i.token_hash=?
  `).get(hashToken(token)) as any;
  if(!invite || invite.status!=="pending" || invite.expiresAt<=Date.now()) return res.status(404).json({error:"This invitation is invalid or has expired."});
  let products:string[]=[];
  try { products=JSON.parse(invite.productsJson || "[]"); } catch {}
  res.json({
    email:invite.email,
    role:invite.role,
    products,
    organizationName:invite.organizationName,
    expiresAt:new Date(invite.expiresAt).toISOString(),
  });
});

app.post("/api/team/invitations/:token/accept", loginLimited, (req,res)=>{
  const token=clean(req.params.token);
  const name=clean(req.body?.name);
  const password=String(req.body?.password || "");
  if(!/^[A-Za-z0-9_-]{32,180}$/.test(token)) return res.status(404).json({error:"Invite not found."});
  if(name.length<2 || name.length>120) return res.status(400).json({error:"Enter your name."});
  if(password.length<16 || password.length>256) return res.status(400).json({error:"Use a password of 16–256 characters."});

  const invite=db.prepare("SELECT * FROM team_invitations WHERE token_hash=?").get(hashToken(token)) as any;
  if(!invite || invite.status!=="pending" || invite.expires_at<=Date.now()) return res.status(404).json({error:"This invitation is invalid or has expired."});
  if(!subscriptionUsable(invite.organization_id)) return res.status(403).json({error:"This V79 workspace does not currently have an active trial or subscription for additional team seats."});
  const usage=seatUsage(invite.organization_id);
  if(usage.members>=usage.limit) return res.status(409).json({error:"This V79 plan has no available team seats."});
  const existing=db.prepare("SELECT u.id,m.organization_id AS organizationId FROM users u LEFT JOIN memberships m ON m.user_id=u.id WHERE u.email=? LIMIT 1").get(invite.email) as any;
  if(existing?.organizationId) return res.status(409).json({error:"This email already belongs to a V79 Hub workspace. Ask the workspace owner for help."});

  const userId=existing?.id || crypto.randomUUID();
  const salt=crypto.randomBytes(16).toString("hex"), now=new Date().toISOString();
  let products:string[]=[];
  try { products=JSON.parse(invite.products_json || "[]"); } catch {}
  const tx=db.transaction(()=>{
    if(!existing) {
      db.prepare("INSERT INTO users(id,email,name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?)")
        .run(userId,invite.email,name,salt,passwordDigest(password,salt),now);
    } else {
      db.prepare("UPDATE users SET name=?,password_salt=?,password_hash=? WHERE id=?")
        .run(name,salt,passwordDigest(password,salt),userId);
    }
    db.prepare("INSERT INTO memberships(user_id,organization_id,role,created_at) VALUES(?,?,?,?)")
      .run(userId,invite.organization_id,invite.role,now);
    db.prepare("UPDATE team_invitations SET status='accepted',accepted_at=? WHERE id=?").run(now,invite.id);
  });
  tx();
  assignMemberProducts(userId,invite.organization_id,products);

  const sessionToken=crypto.randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)")
    .run(hashToken(sessionToken),userId,Date.now()+SESSION_TTL_MS,now);
  setSessionCookie(res,sessionToken);
  const m=membership(userId);
  res.status(201).json({
    user:{id:userId,email:invite.email,name},
    organization:{id:m.organizationId,name:m.organizationName,slug:m.slug,role:m.role},
    subscription:subscriptionFor(m.organizationId) || null,
  });
});

app.get("/api/team", requireAuth, requireAdmin, (req,res)=>{
  const m=(req as any).hubMembership;
  db.prepare("UPDATE team_invitations SET status='expired' WHERE organization_id=? AND status='pending' AND expires_at<=?").run(m.organizationId,Date.now());
  const members=(db.prepare(`
    SELECT u.id,u.email,u.name,m.role,m.created_at AS joinedAt
    FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.organization_id=?
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,u.name
  `).all(m.organizationId) as any[]).map(row=>({
    ...row,
    products:row.role==="owner"
      ? ["ffpro","tiquet",...(productEntitled(m.organizationId,"marketing")?["marketing"]:[])]
      : memberProducts(row.id,m.organizationId),
  }));
  const invitations=(db.prepare(`
    SELECT id,email,role,products_json AS productsJson,expires_at AS expiresAt,created_at AS createdAt
    FROM team_invitations
    WHERE organization_id=? AND status='pending' AND expires_at>?
    ORDER BY created_at DESC
  `).all(m.organizationId,Date.now()) as any[]).map(row=>{
    let products:string[]=[]; try{products=JSON.parse(row.productsJson||"[]");}catch{}
    return {...row,products,expiresAt:new Date(row.expiresAt).toISOString()};
  });
  res.json({
    seats:seatUsage(m.organizationId),
    assignableProducts:["tiquet",...(productEntitled(m.organizationId,"marketing")?["marketing"]:[])],
    financeAccess:"owner_only",
    members,
    invitations,
  });
});

app.post("/api/team/invitations", requireAuth, requireAdmin, (req,res)=>{
  const actor=(req as any).hubUser, m=(req as any).hubMembership;
  const email=clean(req.body?.email).toLowerCase();
  const role=clean(req.body?.role).toLowerCase() || "member";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:"Enter a valid email address."});
  if(!["admin","member"].includes(role)) return res.status(400).json({error:"Choose a valid team role."});
  if(role==="admin" && m.role!=="owner") return res.status(403).json({error:"Only the organisation owner can invite another administrator."});
  if(db.prepare("SELECT 1 FROM users u JOIN memberships mm ON mm.user_id=u.id WHERE mm.organization_id=? AND u.email=?").get(m.organizationId,email)) return res.status(409).json({error:"That person is already a member of this workspace."});
  const existingHubUser=db.prepare("SELECT u.id,o.name AS organizationName FROM users u LEFT JOIN memberships mm ON mm.user_id=u.id LEFT JOIN organizations o ON o.id=mm.organization_id WHERE u.email=? LIMIT 1").get(email) as any;
  if(existingHubUser) return res.status(409).json({error:existingHubUser.organizationName ? `That email already belongs to another V79 Hub workspace (${existingHubUser.organizationName}).` : "That email already belongs to a V79 Hub account."});
  if(db.prepare("SELECT 1 FROM team_invitations WHERE organization_id=? AND email=? AND status='pending' AND expires_at>?").get(m.organizationId,email,Date.now())) return res.status(409).json({error:"A current invitation already exists for this email."});
  if(!subscriptionUsable(m.organizationId)) return res.status(403).json({error:"An active trial or subscription is required before adding team seats."});
  const usage=seatUsage(m.organizationId);
  if(usage.used>=usage.limit) return res.status(409).json({error:`Your plan includes ${usage.limit} Hub user seat${usage.limit===1?"":"s"}. Revoke an invite, remove a member or change plan before inviting another user.`});

  const products=(Array.isArray(req.body?.products)?req.body.products:[])
    .map((v:any)=>clean(v).toLowerCase())
    .filter((v:string,i:number,a:string[])=>["tiquet","marketing"].includes(v)&&a.indexOf(v)===i&&productEntitled(m.organizationId,v));
  const inviteToken=crypto.randomBytes(32).toString("base64url");
  const id=crypto.randomUUID(), now=new Date().toISOString(), expiresAt=Date.now()+7*24*60*60_000;
  db.prepare(`INSERT INTO team_invitations(id,organization_id,email,role,products_json,token_hash,expires_at,invited_by,status,created_at)
    VALUES(?,?,?,?,?,?,?,?, 'pending', ?)`)
    .run(id,m.organizationId,email,role,JSON.stringify(products),hashToken(inviteToken),expiresAt,actor.id,now);
  const inviteUrl=new URL(canonicalOrigin(req));
  inviteUrl.searchParams.set("invite",inviteToken);
  res.status(201).json({id,email,role,products,expiresAt:new Date(expiresAt).toISOString(),inviteUrl:inviteUrl.toString(),seats:seatUsage(m.organizationId)});
});

app.delete("/api/team/invitations/:id", requireAuth, requireAdmin, (req,res)=>{
  const m=(req as any).hubMembership;
  const result=db.prepare("UPDATE team_invitations SET status='revoked' WHERE id=? AND organization_id=? AND status='pending'").run(clean(req.params.id),m.organizationId);
  if(!result.changes) return res.status(404).json({error:"Pending invitation not found."});
  res.json({success:true,seats:seatUsage(m.organizationId)});
});

app.patch("/api/team/members/:userId", requireAuth, requireAdmin, (req,res)=>{
  const actor=(req as any).hubUser, m=(req as any).hubMembership;
  const userId=clean(req.params.userId);
  const target=db.prepare("SELECT role FROM memberships WHERE user_id=? AND organization_id=?").get(userId,m.organizationId) as any;
  if(!target) return res.status(404).json({error:"Team member not found."});
  if(target.role==="owner") return res.status(403).json({error:"The organisation owner access cannot be changed here."});
  const role=clean(req.body?.role).toLowerCase() || target.role;
  if(!["admin","member"].includes(role)) return res.status(400).json({error:"Choose a valid team role."});
  if((target.role==="admin" || role==="admin") && m.role!=="owner") return res.status(403).json({error:"Only the organisation owner can change administrator access."});
  if(actor.id===userId && role!==target.role) return res.status(400).json({error:"You cannot change your own Hub role."});
  db.prepare("UPDATE memberships SET role=? WHERE user_id=? AND organization_id=?").run(role,userId,m.organizationId);
  const products=assignMemberProducts(userId,m.organizationId,req.body?.products);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  res.json({success:true,role,products});
});

app.delete("/api/team/members/:userId", requireAuth, requireAdmin, (req,res)=>{
  const actor=(req as any).hubUser, m=(req as any).hubMembership;
  const userId=clean(req.params.userId);
  const target=db.prepare("SELECT role FROM memberships WHERE user_id=? AND organization_id=?").get(userId,m.organizationId) as any;
  if(!target) return res.status(404).json({error:"Team member not found."});
  if(target.role==="owner") return res.status(403).json({error:"The organisation owner cannot be removed."});
  if(actor.id===userId) return res.status(400).json({error:"You cannot remove yourself from the workspace."});
  if(target.role==="admin" && m.role!=="owner") return res.status(403).json({error:"Only the organisation owner can remove an administrator."});
  const tx=db.transaction(()=>{
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM memberships WHERE user_id=? AND organization_id=?").run(userId,m.organizationId);
    db.prepare("DELETE FROM users WHERE id=? AND NOT EXISTS(SELECT 1 FROM memberships WHERE user_id=?)").run(userId,userId);
  });
  tx();
  res.json({success:true,seats:seatUsage(m.organizationId)});
});

const launchProductForSource: Record<string,"ffpro"|"tiquet"|"marketing"> = {
  "v79-ffpro":"ffpro",
  "v79-tiquet":"tiquet",
  "v79-marketing":"marketing",
};
function launchSecretFor(product: "ffpro"|"tiquet"|"marketing") {
  const names = {
    ffpro:"V79_FFPRO_LAUNCH_SECRET",
    tiquet:"V79_TIQUET_LAUNCH_SECRET",
    marketing:"V79_MARKETING_LAUNCH_SECRET",
  } as const;
  return clean(process.env[names[product]]);
}

app.get("/api/apps/:product/launch", requireAuth, (req,res)=>{
  const product=clean(req.params.product) as Product;
  if(!["ffpro","tiquet","marketing"].includes(product)) return res.status(404).json({error:"Unknown V79 business app."});
  const user=(req as any).hubUser, m=(req as any).hubMembership;
  if (!productEntitled(m.organizationId,product)) {
    return res.status(403).json({
      error:`${productConfig[product].name} is not included in the current V79 subscription.`,
      code:"ENTITLEMENT_REQUIRED",
      subscription:subscriptionFor(m.organizationId) || null,
    });
  }
  if (!memberCanAccessProduct(user.id,m.organizationId,m.role,product)) {
    return res.status(403).json({
      error:`${productConfig[product].name} has not been assigned to your Hub account.`,
      code:"PRODUCT_ACCESS_REQUIRED",
    });
  }
  if (product==="ffpro" && m.role!=="owner") {
    return res.status(403).json({
      error:"FFPRO finance access is currently restricted to the organisation owner until granular finance permissions are enabled.",
      code:"FINANCE_OWNER_REQUIRED",
    });
  }
  const publicUrl=(productConfig[product] as any).publicUrl;
  if(!publicUrl) return res.status(503).json({error:`${productConfig[product].name} public URL is not configured.`});
  const secret=launchSecretFor(product as "ffpro"|"tiquet"|"marketing");
  if(secret.length<32) return res.status(503).json({error:`${productConfig[product].name} launch integration is not configured.`});

  const token=crypto.randomBytes(32).toString("base64url");
  const now=new Date().toISOString();
  db.prepare("DELETE FROM app_launch_tickets WHERE user_id=? AND product=?").run(user.id,product);
  db.prepare("INSERT INTO app_launch_tickets(token_hash,user_id,organization_id,product,expires_at,created_at) VALUES(?,?,?,?,?,?)")
    .run(hashToken(token),user.id,m.organizationId,product,Date.now()+2*60_000,now);
  ensureManagedIntegrations(m.organizationId);
  const target=new URL("/api/platform/launch",publicUrl);
  target.searchParams.set("ticket",token);
  res.redirect(302,target.toString());
});

app.post("/api/platform/session/consume", (req:any,res)=>{
  const source=clean(req.get("x-v79-service-id"));
  const product=launchProductForSource[source];
  if(!product) return res.status(401).json({error:"Unknown V79 launch consumer."});
  const secret=launchSecretFor(product);
  if(secret.length<32) return res.status(503).json({error:`${productConfig[product].name} launch integration is not configured.`});

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
  const requestedProduct=clean(req.body?.product);
  if(requestedProduct!==product || !/^[A-Za-z0-9_-]{32,180}$/.test(ticket)) return res.status(400).json({error:"Invalid launch request."});
  const tokenHash=hashToken(ticket);
  const row=db.prepare(`
    SELECT t.user_id AS userId,t.organization_id AS organizationId,t.expires_at AS expiresAt,
      u.email,u.name,o.name AS organizationName,o.slug,m.role
    FROM app_launch_tickets t
    JOIN users u ON u.id=t.user_id
    JOIN organizations o ON o.id=t.organization_id
    JOIN memberships m ON m.user_id=t.user_id AND m.organization_id=t.organization_id
    WHERE t.token_hash=? AND t.product=?
  `).get(tokenHash,product) as any;

  if(!row || row.expiresAt<=Date.now()) {
    if(row) db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
    return res.status(401).json({error:"Launch ticket is invalid or expired."});
  }
  if(!productEntitled(row.organizationId,product)) {
    db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
    return res.status(403).json({error:`${productConfig[product].name} is not included in this subscription.`});
  }
  if(!memberCanAccessProduct(row.userId,row.organizationId,row.role,product)) {
    db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
    return res.status(403).json({error:`${productConfig[product].name} has not been assigned to this Hub user.`});
  }
  if(product==="ffpro" && row.role!=="owner") {
    db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
    return res.status(403).json({error:"FFPRO finance access requires the organisation owner role."});
  }

  db.prepare("DELETE FROM app_launch_tickets WHERE token_hash=?").run(tokenHash);
  const subscription=subscriptionFor(row.organizationId);
  res.json({
    user:{id:row.userId,email:row.email,name:row.name},
    organization:{id:row.organizationId,name:row.organizationName,slug:row.slug},
    role:row.role,
    plan:subscription?.plan || null,
    entitlement:{product,enabled:true,access:row.role==="owner"?"owner":row.role},
    assignedProducts:row.role==="owner"
      ? ["ffpro","tiquet",...(productEntitled(row.organizationId,"marketing")?["marketing"]:[])]
      : memberProducts(row.userId,row.organizationId),
  });
});

app.get("/api/integrations", requireAuth, (req,res)=>{
  const m=(req as any).hubMembership;
  ensureManagedIntegrations(m.organizationId);
  const rows=db.prepare("SELECT product,external_subject_id AS externalSubjectId,enabled,updated_at AS updatedAt FROM integrations WHERE organization_id=?").all(m.organizationId) as any[];
  const byProduct=Object.fromEntries(rows.map(row=>[row.product,row]));
  const integrationUser=(req as any).hubUser;
  const isAdministrator=["owner","admin"].includes(m.role);
  res.json((Object.keys(productConfig) as Product[]).map(product=>{
    const accessible=memberCanAccessProduct(integrationUser.id,m.organizationId,m.role,product);
    return {
      product,
      name:productConfig[product].name,
      linked:Boolean(byProduct[product]?.enabled),
      externalSubjectId:isAdministrator ? (byProduct[product]?.externalSubjectId || "") : "",
      openUrl:accessible ? (productConfig[product].openUrl || "") : "",
      entitled:productEntitled(m.organizationId,product),
      accessible,
      managedByHub:["ffpro","tiquet","marketing"].includes(product),
      updatedAt:isAdministrator ? (byProduct[product]?.updatedAt || null) : null,
    };
  }));
});
app.put("/api/integrations/:product", requireAuth, requireAdmin, (req,res)=>{
  const product=req.params.product as Product;
  if(["ffpro","tiquet","marketing"].includes(product)) return res.status(409).json({error:`${productConfig[product].name} is linked automatically by V79 Hub identity.`});
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
  if(["ffpro","tiquet","marketing"].includes(req.params.product)) return res.status(409).json({error:"This V79 app connection is managed by the Hub subscription and identity."});
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
  const dashboardUser=(req as any).hubUser;
  await Promise.all((Object.keys(productConfig) as Product[]).map(async product=>{
    const subject=integrations[product];
    const accessible=memberCanAccessProduct(dashboardUser.id,m.organizationId,m.role,product);
    products[product]=accessible
      ? (subject ? await fetchSummary(product,subject) : {status:"unlinked"})
      : {status:"restricted",error:"This app has not been assigned to your Hub account."};
    products[product].name=productConfig[product].name;
    products[product].openUrl=accessible ? (productConfig[product].openUrl || "") : "";
    products[product].entitled=productEntitled(m.organizationId,product);
    products[product].accessible=accessible;
  }));
  const events=(db.prepare("SELECT id,type,source,occurred_at AS occurredAt,payload_json AS payloadJson FROM events WHERE organization_id=? ORDER BY occurred_at DESC LIMIT 50").all(m.organizationId) as any[])
    .filter((event:any)=>{
      const eventProduct=EVENT_SOURCE_PRODUCTS[event.source];
      return !eventProduct || memberCanAccessProduct(dashboardUser.id,m.organizationId,m.role,eventProduct);
    })
    .slice(0,20)
    .map(event => {
      let details:any={};
      try { details=JSON.parse(event.payloadJson || "{}"); } catch {}
      return { id:event.id,type:event.type,source:event.source,occurredAt:event.occurredAt,details };
    });
  res.json({
    organization:{id:m.organizationId,name:m.organizationName,slug:m.slug},
    subscription:subscriptionFor(m.organizationId) || null,
    seats:seatUsage(m.organizationId),
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
