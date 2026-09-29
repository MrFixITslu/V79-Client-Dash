import test from "node:test";
import assert from "node:assert/strict";
import { checkApproval } from "../src/policy.js";

test("read-only actions do not require approval", () => {
  assert.equal(checkApproval("read").approvalRequired, false);
});

test("drafts do not require approval", () => {
  assert.equal(checkApproval("draft").approvalRequired, false);
});

test("customer-impacting and risky actions require approval", () => {
  for (const risk of [
    "external_communication",
    "booking_change",
    "financial",
    "deployment",
    "security",
  ] as const) {
    assert.equal(checkApproval(risk).approvalRequired, true);
  }
});
