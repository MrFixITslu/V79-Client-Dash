import test from "node:test";
import assert from "node:assert/strict";
import { hasOwnerAssistantAccess } from "../server/agent-access.mjs";

const base = {
  organizationId: "v79",
  ownerOrganizationId: "v79",
  ownerUserId: "owner-1",
  ownerEmail: "vision79slu@gmail.com",
  membership: {
    organizationId: "v79",
    userId: "owner-1",
    role: "owner",
    status: "active",
  },
};

test("only the verified Vision79 owner identity receives Owner Assistant access", () => {
  assert.equal(hasOwnerAssistantAccess({
    ...base,
    user: { id: "owner-1", email: "vision79slu@gmail.com" },
  }), true);
});

test("admin role, wrong owner email, or wrong organization cannot gain Owner Assistant access", () => {
  assert.equal(hasOwnerAssistantAccess({
    ...base,
    user: { id: "admin-2", email: "vision79slu@gmail.com" },
    membership: { ...base.membership, userId: "admin-2", role: "admin" },
  }), false);
  assert.equal(hasOwnerAssistantAccess({
    ...base,
    user: { id: "owner-1", email: "someone@example.com" },
  }), false);
  assert.equal(hasOwnerAssistantAccess({
    ...base,
    organizationId: "customer-org",
    user: { id: "owner-1", email: "vision79slu@gmail.com" },
  }), false);
});