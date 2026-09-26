// Rule tests for the acceptance criteria in docs/PRD.md §6.
// Plain tsx script (no test framework): run with `npm run rules:test`.

import assert from "node:assert/strict";
import { computeLineCoverage, computeRequirementCoverage, computeOemAvailability, canSubmitQuote } from "../coverage";
import { computePrice, impliedMargin } from "../pricing";
import { computeDeliveryRisk } from "../risk";
import { evaluateDispatchBlock, pdiTotals } from "../pdi";
import { buildFollowUpTasks } from "../followups";
import { answerQuestion, type QnaFacts } from "../qna";
import { parseLines, MAX_LINE_ITEMS } from "@/lib/parse";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("Coverage (module 3, the hard part)");
test("1,000 required = 600 firm (A) + 400 firm (B) → coverage 1,000, uncovered 0", () => {
  const line = { id: 1, partNumber: "P-1", quantity: 1000 };
  const cov = computeLineCoverage(line, [
    { oemId: 10, oemName: "A", responseType: "firm_commitment", firmQuantity: 600 },
    { oemId: 11, oemName: "B", responseType: "firm_commitment", firmQuantity: 400 },
  ]);
  assert.equal(cov.committed, 1000);
  assert.equal(cov.uncovered, 0);
  assert.equal(cov.fullyCovered, true);
  assert.equal(cov.coveredByMultiple, true);
});

test("availability indication does NOT count toward coverage", () => {
  const line = { id: 1, partNumber: "P-1", quantity: 1000 };
  const cov = computeLineCoverage(line, [
    { oemId: 10, oemName: "A", responseType: "firm_commitment", firmQuantity: 600 },
    { oemId: 11, oemName: "B", responseType: "availability_indication", firmQuantity: 0, availableQuantity: 400 },
  ]);
  assert.equal(cov.committed, 600);
  assert.equal(cov.uncovered, 400);
  assert.equal(cov.availabilityTotal, 400);
  assert.equal(cov.fullyCovered, false);
});

test("quote cannot be submitted with uncovered quantity without an approved override", () => {
  const cov = computeRequirementCoverage(
    [{ id: 1, partNumber: "P-1", quantity: 1000 }],
    new Map([
      [1, [{ oemId: 10, responseType: "firm_commitment" as const, firmQuantity: 600 }]],
    ]),
  );
  assert.equal(canSubmitQuote(cov).allowed, false);
  assert.equal(canSubmitQuote(cov, { approved: true }).allowed, true);
});

test("global capacity nets off commitments made elsewhere", () => {
  const a = computeOemAvailability(1000, 700);
  assert.equal(a.availableToCommit, 300);
  assert.equal(a.overCommitted, false);
  const unknown = computeOemAvailability(null, 700);
  assert.equal(unknown.capacityUnknown, true);
  assert.equal(unknown.availableToCommit, null);
});

console.log("Pricing (module 4)");
test("recommended price is cost / (1 - margin) and never auto-final", () => {
  const p = computePrice({ oemUnitPrice: 8000, freightUnit: 1000, otherUnit: 0, quantity: 10, targetMarginPercent: 20 });
  assert.equal(p.unitCost, 9000);
  assert.equal(p.recommendedUnitPrice, 11250);
  assert.equal(p.recommendedTotal, 112500);
  assert.equal(impliedMargin(11250, 9000), 20);
});

test("margin >= 100% is flagged rather than crashing", () => {
  const p = computePrice({ oemUnitPrice: 100, quantity: 1, targetMarginPercent: 150 });
  assert.equal(p.marginTooHigh, true);
});

console.log("Delivery risk (module 7)");
test("late when deadline passed with outstanding quantity", () => {
  const r = computeDeliveryRisk({
    deadline: "2026-01-01",
    expectedCompletion: "2026-01-10",
    today: new Date("2026-01-05"),
    orderedQuantity: 100,
    acceptedQuantity: 40,
  });
  assert.equal(r.level, "late");
  assert.equal(r.outstandingQuantity, 60);
});

test("at risk inside the window, on track well before", () => {
  const atRisk = computeDeliveryRisk({
    deadline: "2026-01-10",
    expectedCompletion: "2026-01-08",
    today: new Date("2026-01-05"),
    orderedQuantity: 100,
    acceptedQuantity: 0,
  });
  assert.equal(atRisk.level, "at_risk");
  const onTrack = computeDeliveryRisk({
    deadline: "2026-03-01",
    expectedCompletion: "2026-02-20",
    today: new Date("2026-01-05"),
    orderedQuantity: 100,
    acceptedQuantity: 0,
  });
  assert.equal(onTrack.level, "on_track");
});

console.log("PDI (module 7)");
test("cleared, offered and rejected are distinct", () => {
  const t = pdiTotals([{ id: 1, status: "failed", quantityOffered: 300, quantityCleared: 180, quantityRejected: 120 }]);
  assert.equal(t.offered, 300);
  assert.equal(t.cleared, 180);
  assert.equal(t.rejected, 120);
  assert.equal(t.pending, 0);
});

test("failed or held PDI blocks dispatch", () => {
  const blocked = evaluateDispatchBlock(
    [{ id: 1, status: "failed", quantityOffered: 300, quantityCleared: 180, quantityRejected: 120 }],
    true,
  );
  assert.equal(blocked.blocked, true);
  const clear = evaluateDispatchBlock(
    [{ id: 1, status: "passed", quantityOffered: 40, quantityCleared: 40, quantityRejected: 0 }],
    true,
  );
  assert.equal(clear.blocked, false);
});

console.log("Follow-ups (module 5)");
test("no-response-7d fires after 7 days and dedupes deterministically", () => {
  const tasks = buildFollowUpTasks({
    today: new Date("2026-01-10"),
    noResponseQuotes: [{ requirementId: 1, requirementRef: "REQ-1", submittedAt: new Date("2026-01-01") }],
    governmentResponses: [],
    pendingOemRequests: [],
    upcomingDeadlines: [],
    invoices: [],
    expiringDocuments: [],
    atRiskOrders: [],
  });
  const t1 = tasks.find((t) => t.rule === "no_response_7d");
  assert.ok(t1);
  assert.equal(t1!.dedupeKey, "no_response_7d:1:2026-01-01");
});

console.log("Plain-language Q&A (module 10) — stored data only");
test("answers order count from facts and never invents", () => {
  const facts: QnaFacts = {
    monthLabel: "January 2026",
    orders: { total: 3, open: 2, atRisk: 1, byState: [{ state: "open", label: "Open", count: 2 }] },
    requirements: { total: 5, byStatus: [], wonThisMonth: 1, lostThisMonth: 2, openNow: 3 },
    losses: { totalAllTime: 2, thisMonth: 2, byReason: [{ code: "price", label: "Price", count: 2, value: 100 }], recent: [] },
    payments: { receivableOutstanding: 0, payableOutstanding: 0, overdueInvoices: 0 },
    oemResponsesPending: 0,
    documentsExpiring: 0,
    quotesAwaitingResponse: 0,
  };
  assert.match(answerQuestion("how many orders are there?", facts).answer, /3 order/);
  assert.match(answerQuestion("why did we lose them?", facts).answer, /Price/);
  assert.equal(answerQuestion("what is the weather?", facts).answered, false);
});

console.log("Line items (module 1)");
test("up to 500 part numbers, 501 rejected", () => {
  const ok = parseLines(Array.from({ length: 500 }, (_, i) => `PN-${i}, part, 1`).join("\n"));
  assert.equal(ok.lines.length, 500);
  assert.equal(ok.errors.length, 0);
  const tooMany = parseLines(Array.from({ length: MAX_LINE_ITEMS + 1 }, (_, i) => `PN-${i}, part, 1`).join("\n"));
  assert.equal(tooMany.errors.length, 1);
});

console.log(`\n${passed} rule checks passed.`);
