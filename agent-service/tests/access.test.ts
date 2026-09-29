import test from "node:test";
import assert from "node:assert/strict";
import { canUseSystem, isValidOwnerContext } from "../src/context.js";

const owner = {
  userId: "owner-1",
  email: "vision79slu@gmail.com",
  organizationId: "v79",
  organizationName: "V79 Digital",
  allowedSystems: ["pos", "marketing"],
  ownerAgent: true,
  hubAdmin: true,
};

test("owner context must match the Vision79 owner account", () => {
  assert.equal(isValidOwnerContext(owner), true);
  assert.equal(isValidOwnerContext({ ...owner, email: "other@example.com" }), false);
  assert.equal(isValidOwnerContext({ ...owner, ownerAgent: false }), false);
});

test("system access follows owner scope or explicit entitlements", () => {
  assert.equal(canUseSystem(owner, "ffpro"), true);
  const customer = { ...owner, ownerAgent: false, hubAdmin: false };
  assert.equal(canUseSystem(customer, "pos"), true);
  assert.equal(canUseSystem(customer, "ffpro"), false);
});