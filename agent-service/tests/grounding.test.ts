import test from "node:test";
import assert from "node:assert/strict";
import { compactOwnerSnapshot } from "../src/grounding.js";

test("compacts and deduplicates owner business snapshot", () => {
  const compact = compactOwnerSnapshot({
    generatedAt: "2026-09-29T20:00:00Z",
    hubAdmin: { users: 1, activeSessions: 1 },
    connections: { pos: { status: "online" } },
    business: { pos: { metrics: { sales30d: 4, revenue30d: 100, generatedAt: "x" } } },
    platform: { pos: { metrics: { sales30d: 4, activeTenants: 1, generatedAt: "y" } } },
  });
  assert.equal(compact.systems.pos.connection, "online");
  assert.deepEqual(compact.systems.pos.metrics, { sales30d: 4, revenue30d: 100 });
  assert.deepEqual(compact.systems.pos.platform, { activeTenants: 1 });
  assert.equal(compact.systems.ffpro.connection, "unknown");
});
