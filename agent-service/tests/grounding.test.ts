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


test("priority signals put negative cashflow before generic inactivity", () => {
  const compact = compactOwnerSnapshot({
    business: {
      ffpro: { metrics: { currentMonthIncome: 1750, currentMonthExpenses: 5982.02, currentMonthNet: -4232.02 } },
      pos: { metrics: { sales30d: 0, revenue30d: 0, criticalReplenishmentItems: 0, delayedShipments: 0, unresolvedInventoryExceptions: 0 } },
      marketing: { metrics: { campaigns: 0, activeCampaigns: 0 } },
      lasertag: { metrics: { upcomingBookings: 0, upcomingPlayers: 0 } },
      academy: { metrics: { publishedCourses: 4, enrolledCourses: 1 } },
    },
  });

  assert.equal(compact.prioritySignals[0].severity, "high");
  assert.equal(compact.prioritySignals[0].code, "finance_negative_month_net");
  assert.equal(compact.prioritySignals[0].values.currentMonthNet, -4232.02);
  assert.ok(compact.prioritySignals.find(signal => signal.code === "pos_no_recent_sales"));
  assert.ok(compact.prioritySignals.find(signal => signal.code === "marketing_no_active_campaigns"));
});
