import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPlatformMessage,
  signPlatformRequest,
  verifyPlatformRequest,
} from "../server/platform-contract.mjs";

const secret = "0123456789abcdef0123456789abcdef";

test("platform signatures are deterministic and verifiable", () => {
  const timestamp = String(Date.now());
  const input = { method: "GET", pathname: "/api/platform/summary/demo", timestamp, body: "", secret };
  const signature = signPlatformRequest(input);
  assert.equal(signature.length, 64);
  assert.equal(verifyPlatformRequest({ ...input, signature }), true);
});

test("platform signatures bind method and path", () => {
  const timestamp = String(Date.now());
  const signature = signPlatformRequest({ method: "GET", pathname: "/api/platform/summary/demo", timestamp, body: "", secret });
  assert.equal(verifyPlatformRequest({ method: "POST", pathname: "/api/platform/summary/demo", timestamp, body: "", secret, signature }), false);
  assert.equal(verifyPlatformRequest({ method: "GET", pathname: "/api/platform/summary/other", timestamp, body: "", secret, signature }), false);
});

test("canonical message hashes the request body", () => {
  const timestamp = "123";
  assert.notEqual(
    canonicalPlatformMessage({ method: "POST", pathname: "/event", timestamp, body: "one" }),
    canonicalPlatformMessage({ method: "POST", pathname: "/event", timestamp, body: "two" })
  );
});
