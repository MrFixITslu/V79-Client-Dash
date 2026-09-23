import crypto from "node:crypto";

export function bodySha256(body = "") {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export function canonicalPlatformMessage({ method, pathname, timestamp, body = "" }) {
  return [
    String(method || "GET").toUpperCase(),
    pathname || "/",
    String(timestamp || ""),
    bodySha256(body),
  ].join("\n");
}

export function signPlatformRequest({ method, pathname, timestamp, body = "", secret }) {
  if (!secret || String(secret).length < 32) {
    throw new Error("Platform shared secret must contain at least 32 characters.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(canonicalPlatformMessage({ method, pathname, timestamp, body }))
    .digest("hex");
}

export function verifyPlatformRequest({
  method,
  pathname,
  timestamp,
  body = "",
  secret,
  signature,
  maxSkewMs = 300000,
}) {
  if (!secret || String(secret).length < 32 || !signature || !timestamp) return false;
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || Math.abs(Date.now() - parsed) > maxSkewMs) return false;
  const expected = signPlatformRequest({ method, pathname, timestamp, body, secret });
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(signature), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
