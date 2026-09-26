// Quantity coverage: the single source of truth for required vs committed.
//
// Rule R8/R11: only responses typed `firm_commitment` count toward coverage.
// Availability / quote indications are shown but never reduce the uncovered
// balance, so the team cannot confidently commit to a quantity the OEMs have
// not actually covered.

export type OemResponseSlice = {
  oemId: number;
  oemName?: string;
  responseType:
    | "firm_commitment"
    | "availability_indication"
    | "quote_indication"
    | "decline";
  firmQuantity: number;
  availableQuantity?: number | null;
};

export type LineItemSlice = {
  id: number;
  partNumber: string;
  quantity: number;
};

export type PerOemCommitment = {
  oemId: number;
  oemName: string;
  committed: number;
};

export type LineCoverage = {
  lineItemId: number;
  partNumber: string;
  required: number;
  committed: number;
  uncovered: number;
  overCommitted: number;
  coveragePercent: number;
  fullyCovered: boolean;
  byOem: PerOemCommitment[];
  availabilityTotal: number;
  hasFirmCommitment: boolean;
  hasIndicationOnly: boolean;
  coveredByMultiple: boolean;
};

export type RequirementCoverage = {
  lines: LineCoverage[];
  totalRequired: number;
  totalCommitted: number;
  totalUncovered: number;
  coveragePercent: number;
  fullyCovered: boolean;
  uncoveredLines: number;
  oemCount: number;
};

function percent(covered: number, required: number): number {
  if (required <= 0) return 100;
  return Math.min(100, Math.round((covered / required) * 1000) / 10);
}

export function computeLineCoverage(
  line: LineItemSlice,
  responses: OemResponseSlice[],
): LineCoverage {
  const firm = responses.filter((r) => r.responseType === "firm_commitment");
  const indications = responses.filter(
    (r) => r.responseType === "availability_indication" || r.responseType === "quote_indication",
  );

  const oemMap = new Map<number, PerOemCommitment>();
  let committed = 0;
  for (const r of firm) {
    const qty = Math.max(0, r.firmQuantity || 0);
    if (qty <= 0) continue;
    committed += qty;
    const existing = oemMap.get(r.oemId);
    if (existing) {
      existing.committed += qty;
    } else {
      oemMap.set(r.oemId, {
        oemId: r.oemId,
        oemName: r.oemName ?? `OEM #${r.oemId}`,
        committed: qty,
      });
    }
  }

  const availabilityTotal = indications.reduce(
    (sum, r) => sum + Math.max(0, r.availableQuantity || 0),
    0,
  );

  const required = Math.max(0, line.quantity || 0);
  const uncovered = Math.max(0, required - committed);
  const overCommitted = Math.max(0, committed - required);
  const byOem = [...oemMap.values()].sort((a, b) => b.committed - a.committed);

  return {
    lineItemId: line.id,
    partNumber: line.partNumber,
    required,
    committed,
    uncovered,
    overCommitted,
    coveragePercent: percent(committed, required),
    fullyCovered: uncovered === 0,
    byOem,
    availabilityTotal,
    hasFirmCommitment: firm.length > 0,
    hasIndicationOnly: firm.length === 0 && indications.length > 0,
    coveredByMultiple: byOem.length > 1,
  };
}

export function computeRequirementCoverage(
  lines: LineItemSlice[],
  responsesByLine: Map<number, OemResponseSlice[]>,
): RequirementCoverage {
  const lineCoverages = lines.map((line) =>
    computeLineCoverage(line, responsesByLine.get(line.id) ?? []),
  );
  const totalRequired = lineCoverages.reduce((s, l) => s + l.required, 0);
  const totalCommitted = lineCoverages.reduce((s, l) => s + l.committed, 0);
  const totalUncovered = lineCoverages.reduce((s, l) => s + l.uncovered, 0);
  const oemIds = new Set<number>();
  for (const l of lineCoverages) {
    for (const o of l.byOem) oemIds.add(o.oemId);
  }
  return {
    lines: lineCoverages,
    totalRequired,
    totalCommitted,
    totalUncovered,
    coveragePercent: percent(totalCommitted, totalRequired),
    fullyCovered: totalUncovered === 0,
    uncoveredLines: lineCoverages.filter((l) => !l.fullyCovered).length,
    oemCount: oemIds.size,
  };
}

export type CapacityAvailability = {
  capacity: number | null;
  committedElsewhere: number;
  availableToCommit: number | null;
  capacityUnknown: boolean;
  overCommitted: boolean;
};

/**
 * Global vs per-order capacity (PRD open question 1):
 * each OEM's committed total across all live orders is netted off its capacity
 * so the next requirement sees only the genuinely available balance.
 */
export function computeOemAvailability(
  capacity: number | null | undefined,
  committedElsewhere: number,
): CapacityAvailability {
  const capacityUnknown = capacity === null || capacity === undefined;
  const availableToCommit = capacityUnknown ? null : capacity - committedElsewhere;
  return {
    capacity: capacityUnknown ? null : capacity,
    committedElsewhere,
    availableToCommit,
    capacityUnknown,
    overCommitted: !capacityUnknown && availableToCommit !== null && availableToCommit < 0,
  };
}

/**
 * Rule R11: a quote cannot be submitted for approval while any line is
 * uncovered unless the owner explicitly overrides with a recorded reason.
 */
export function canSubmitQuote(
  coverage: RequirementCoverage,
  override?: { approved: boolean } | null,
): { allowed: boolean; reason?: string; requiresOverride: boolean } {
  if (coverage.fullyCovered) return { allowed: true, requiresOverride: false };
  if (override?.approved) return { allowed: true, requiresOverride: true };
  return {
    allowed: false,
    requiresOverride: true,
    reason: `${coverage.uncoveredLines} line item(s) have uncovered quantity (${coverage.totalUncovered} units). Secure firm OEM commitments or record an owner override.`,
  };
}
