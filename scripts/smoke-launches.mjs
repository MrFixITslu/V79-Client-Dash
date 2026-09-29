#!/usr/bin/env node

const hubBase = new URL(process.env.APP_URL || "https://hub.v79sl.com").origin;
const username = String(process.env.V79_HUB_ADMIN_USERNAME || "admin");
const password = String(process.env.V79_HUB_ADMIN_PASSWORD || "");

if (!password) {
  console.error("SMOKE FAIL: V79_HUB_ADMIN_PASSWORD is unavailable inside Hub.");
  process.exit(1);
}

function cookieFrom(response, name) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const first = String(value).split(";")[0];
    if (first.startsWith(name + "=")) return first;
  }
  return "";
}

function safeUrl(raw, base) {
  if (!raw) return "(none)";
  try {
    const url = new URL(raw, base);
    const keys = [...url.searchParams.keys()];
    const hashKeys = url.hash ? [...new URLSearchParams(url.hash.slice(1)).keys()] : [];
    return `${url.origin}${url.pathname}${keys.length ? "?" + keys.map(k => k + "=<redacted>").join("&") : ""}${hashKeys.length ? "#" + hashKeys.map(k => k + "=<redacted>").join("&") : ""}`;
  } catch {
    return "(invalid URL)";
  }
}

async function bodySnippet(response) {
  const text = await response.text().catch(() => "");
  return text.replace(/\s+/g, " ").slice(0, 240);
}

async function loginHub() {
  const response = await fetch(new URL("/api/auth/login", hubBase), {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", "origin": hubBase },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 200) {
    throw new Error(`Hub login HTTP ${response.status}: ${await bodySnippet(response)}`);
  }
  const cookie = cookieFrom(response, "v79_hub_session");
  if (!cookie) throw new Error("Hub login did not set v79_hub_session.");
  return cookie;
}

async function hubLaunch(product, hubCookie) {
  const response = await fetch(new URL(`/api/apps/${product}/launch`, hubBase), {
    redirect: "manual",
    headers: { cookie: hubCookie },
    signal: AbortSignal.timeout(10000),
  });
  const location = response.headers.get("location") || "";
  console.log(`${product}: Hub launch HTTP ${response.status} -> ${safeUrl(location, hubBase)}`);
  if (response.status !== 302 || !location) {
    throw new Error(`${product}: Hub launch failed HTTP ${response.status}: ${await bodySnippet(response)}`);
  }
  return new URL(location, hubBase);
}

async function launchManaged(product, cookieName, verifyPath, hubCookie) {
  const launchUrl = await hubLaunch(product, hubCookie);
  const appOrigin = launchUrl.origin;
  const response = await fetch(launchUrl, {
    redirect: "manual",
    headers: { accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(15000),
  });
  const next = response.headers.get("location") || "";
  console.log(`${product}: App launch HTTP ${response.status} -> ${safeUrl(next, appOrigin)}`);

  if (next) {
    const redirected = new URL(next, appOrigin);
    if (redirected.origin !== appOrigin) {
      throw new Error(`${product}: app redirected outside its origin: ${safeUrl(redirected.toString())}`);
    }
  }
  if (response.status !== 302) {
    throw new Error(`${product}: app launch expected 302, got ${response.status}: ${await bodySnippet(response)}`);
  }

  const appCookie = cookieFrom(response, cookieName);
  if (!appCookie) throw new Error(`${product}: app did not set ${cookieName}.`);

  const verify = await fetch(new URL(verifyPath, appOrigin), {
    redirect: "manual",
    headers: { cookie: appCookie, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const snippet = await bodySnippet(verify);
  if (verify.status !== 200) throw new Error(`${product}: session verification HTTP ${verify.status}: ${snippet}`);
  if (product === "ffpro") {
    let parsed;
    try { parsed = JSON.parse(snippet); } catch {}
    if (!parsed?.authenticated || !parsed?.user) throw new Error(`ffpro: session-state is not authenticated: ${snippet}`);
  }
  console.log(`${product}: PASS authenticated session established`);
}

async function launchPos(hubCookie) {
  const launchUrl = await hubLaunch("pos", hubCookie);
  const params = new URLSearchParams(launchUrl.hash.replace(/^#/, ""));
  const ticket = params.get("ticket");
  if (!ticket) throw new Error("pos: Hub redirect did not contain launch ticket.");

  const appOrigin = launchUrl.origin;
  const response = await fetch(new URL("/auth/launch", appOrigin), {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      "origin": appOrigin,
      "accept": "application/json",
    },
    body: JSON.stringify({ ticket }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 200) {
    throw new Error(`pos: ticket exchange HTTP ${response.status}: ${await bodySnippet(response)}`);
  }
  const appCookie = cookieFrom(response, "v79_pos_session");
  if (!appCookie) throw new Error("pos: ticket exchange did not set v79_pos_session.");

  const me = await fetch(new URL("/v1/me", appOrigin), {
    headers: { cookie: appCookie, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const snippet = await bodySnippet(me);
  if (me.status !== 200) throw new Error(`pos: /v1/me HTTP ${me.status}: ${snippet}`);
  console.log("pos: PASS authenticated session established");
}

let failed = false;
try {
  console.log(`Testing production Hub launch flow via ${hubBase}`);
  const hubCookie = await loginHub();
  console.log("hub: PASS production login");

  const tests = [
    ["pos", () => launchPos(hubCookie)],
    ["ffpro", () => launchManaged("ffpro", "ffpro.sid", "/api/auth/session-state", hubCookie)],
    ["tiquet", () => launchManaged("tiquet", "tiquet_session", "/api/auth/me", hubCookie)],
    ["marketing", () => launchManaged("marketing", "v79_marketing_session", "/api/auth/me", hubCookie)],
  ];

  for (const [name, test] of tests) {
    try {
      await test();
    } catch (error) {
      failed = true;
      console.error(`${name}: FAIL ${error?.message || error}`);
    }
  }
} catch (error) {
  failed = true;
  console.error(`hub: FAIL ${error?.message || error}`);
}

if (failed) process.exit(1);
console.log("SMOKE PASS: all Hub app launches established authenticated sessions.");
