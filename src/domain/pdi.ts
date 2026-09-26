// PDI: cleared is distinct from offered and rejected.
// A failed or held PDI blocks dispatch (Rule R6 + module 7).

export type PdiSlice = {
  id: number;
  status: "scheduled" | "in_progress" | "passed" | "failed" | "held";
  quantityOffered: number;
  quantityCleared: number;
  quantityRejected: number;
};

export type PdiTotals = {
  offered: number;
  cleared: number;
  rejected: number;
  pending: number;
  passRatePercent: number;
};

export function pdiTotals(records: PdiSlice[]): PdiTotals {
  const offered = records.reduce((s, r) => s + (r.quantityOffered || 0), 0);
  const cleared = records.reduce((s, r) => s + (r.quantityCleared || 0), 0);
  const rejected = records.reduce((s, r) => s + (r.quantityRejected || 0), 0);
  const pending = Math.max(0, offered - cleared - rejected);
  return {
    offered,
    cleared,
    rejected,
    pending,
    passRatePercent: offered > 0 ? Math.round((cleared / offered) * 1000) / 10 : 0,
  };
}

export type DispatchBlock = {
  blocked: boolean;
  reasons: string[];
};

export function evaluateDispatchBlock(
  records: PdiSlice[],
  hasPdiRequirement: boolean,
): DispatchBlock {
  const reasons: string[] = [];
  for (const r of records) {
    if (r.status === "failed") reasons.push(`PDI #${r.id} failed`);
    if (r.status === "held") reasons.push(`PDI #${r.id} is on hold`);
  }
  if (hasPdiRequirement && records.length === 0) {
    reasons.push("No PDI record exists yet for this order");
  } else if (hasPdiRequirement && records.length > 0) {
    const cleared = pdiTotals(records).cleared;
    const anyPassed = records.some((r) => r.status === "passed");
    if (!anyPassed && cleared === 0) {
      reasons.push("No PDI has passed yet");
    }
  }
  return { blocked: reasons.length > 0, reasons };
}

export function pdiQuantityBalances(records: PdiSlice[]): {
  offered: number;
  cleared: number;
  rejected: number;
  outstandingAfterRejection: number;
} {
  const t = pdiTotals(records);
  return {
    offered: t.offered,
    cleared: t.cleared,
    rejected: t.rejected,
    // rejected units must be re-offered; this is the rework balance.
    outstandingAfterRejection: t.rejected,
  };
}
