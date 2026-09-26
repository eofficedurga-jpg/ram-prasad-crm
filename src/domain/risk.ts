// Delivery risk: expected completion against the committed deadline.

export type RiskLevel = "on_track" | "at_risk" | "late" | "delivered" | "no_deadline";

export type RiskInput = {
  deadline: Date | string | null | undefined;
  expectedCompletion: Date | string | null | undefined;
  today?: Date;
  orderedQuantity: number;
  acceptedQuantity: number;
  completed?: boolean;
  atRiskWindowDays?: number;
};

export type RiskResult = {
  level: RiskLevel;
  daysRemaining: number | null;
  outstandingQuantity: number;
  reason: string;
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function computeDeliveryRisk(input: RiskInput): RiskResult {
  const window = input.atRiskWindowDays ?? 7;
  const now = startOfDay(input.today ?? new Date());
  const deadline = toDate(input.deadline);
  const expected = toDate(input.expectedCompletion);
  const outstandingQuantity = Math.max(
    0,
    (input.orderedQuantity || 0) - (input.acceptedQuantity || 0),
  );

  if (input.completed || outstandingQuantity === 0) {
    return {
      level: "delivered",
      daysRemaining: deadline ? Math.round((deadline.getTime() - now.getTime()) / 86_400_000) : null,
      outstandingQuantity,
      reason: "No outstanding quantity.",
    };
  }

  if (!deadline) {
    return {
      level: "no_deadline",
      daysRemaining: null,
      outstandingQuantity,
      reason: "No committed delivery deadline recorded.",
    };
  }

  const daysRemaining = Math.round((deadline.getTime() - now.getTime()) / 86_400_000);

  if (daysRemaining < 0) {
    return {
      level: "late",
      daysRemaining,
      outstandingQuantity,
      reason: `Deadline passed ${Math.abs(daysRemaining)} day(s) ago with ${outstandingQuantity} unit(s) outstanding.`,
    };
  }

  if (expected && expected > deadline) {
    return {
      level: "late",
      daysRemaining,
      outstandingQuantity,
      reason: `Expected completion ${expected.toISOString().slice(0, 10)} is after the deadline.`,
    };
  }

  if (daysRemaining <= window) {
    return {
      level: "at_risk",
      daysRemaining,
      outstandingQuantity,
      reason: `Only ${daysRemaining} day(s) to deadline with ${outstandingQuantity} unit(s) outstanding.`,
    };
  }

  return {
    level: "on_track",
    daysRemaining,
    outstandingQuantity,
    reason: `${daysRemaining} day(s) to deadline.`,
  };
}
