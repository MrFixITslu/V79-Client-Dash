import test from "node:test";
import assert from "node:assert/strict";
import { addBillingPeriod, normalizeMoney, verifyWipayResponse, wipayResponseHash } from "../server/billing-contract.mjs";

test("WiPay response hash verifies exactly",()=>{
  const apiKey="secret-key";
  const transactionId="SB-12-1-order-20260924";
  const total="299.00";
  const hash=wipayResponseHash(transactionId,total,apiKey);
  assert.equal(verifyWipayResponse({transactionId,total,apiKey,hash}),true);
  assert.equal(verifyWipayResponse({transactionId,total:"298.00",apiKey,hash}),false);
  assert.equal(verifyWipayResponse({transactionId,total,apiKey,hash:"00"}),false);
});

test("billing months clamp end-of-month dates",()=>{
  assert.equal(addBillingPeriod("2026-01-31T12:00:00.000Z","monthly").toISOString(),"2026-02-28T12:00:00.000Z");
  assert.equal(addBillingPeriod("2028-02-29T12:00:00.000Z","annual").toISOString(),"2029-02-28T12:00:00.000Z");
});

test("money normalization stays cents-safe",()=>{
  assert.equal(normalizeMoney("299.00"),299);
  assert.equal(normalizeMoney(149.999),150);
  assert.equal(normalizeMoney("-1"),null);
  assert.equal(normalizeMoney("not money"),null);
});
