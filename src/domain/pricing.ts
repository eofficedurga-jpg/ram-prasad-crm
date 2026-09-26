// Pricing: deterministic, advisory only.
// Rule R12: the recommended price is never auto-finalised. A human sets the
// final price, and an approved quote is what feeds the order.

export type PriceInput = {
  oemUnitPrice: number; // minor units (paise)
  quantity: number;
  freightUnit?: number;
  otherUnit?: number;
  targetMarginPercent: number; // 0..99
};

export type PriceResult = {
  unitCost: number;
  totalCost: number;
  recommendedUnitPrice: number;
  recommendedTotal: number;
  impliedMarginPercent: number;
  marginTooHigh: boolean;
};

export function unitCost(
  oemUnitPrice: number,
  freightUnit = 0,
  otherUnit = 0,
): number {
  return Math.max(0, Math.round(oemUnitPrice + freightUnit + otherUnit));
}

/**
 * Cost-plus-margin: price = cost / (1 - margin). Margin is expressed on the
 * selling price. Guarded so a margin >= 100% is rejected rather than blowing up.
 */
export function recommendedUnitPrice(
  cost: number,
  targetMarginPercent: number,
): { price: number; marginTooHigh: boolean } {
  const margin = Math.min(99, Math.max(0, targetMarginPercent));
  const marginTooHigh = targetMarginPercent >= 100;
  const divisor = 1 - margin / 100;
  const price = Math.round(cost / divisor);
  return { price, marginTooHigh };
}

export function computePrice(input: PriceInput): PriceResult {
  const cost = unitCost(input.oemUnitPrice, input.freightUnit, input.otherUnit);
  const { price, marginTooHigh } = recommendedUnitPrice(cost, input.targetMarginPercent);
  const totalCost = cost * Math.max(0, input.quantity);
  const recommendedTotal = price * Math.max(0, input.quantity);
  const impliedMarginPercent =
    price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0;
  return {
    unitCost: cost,
    totalCost,
    recommendedUnitPrice: price,
    recommendedTotal,
    impliedMarginPercent,
    marginTooHigh,
  };
}

export function impliedMargin(finalUnitPrice: number, cost: number): number {
  if (finalUnitPrice <= 0) return 0;
  return Math.round(((finalUnitPrice - cost) / finalUnitPrice) * 1000) / 10;
}
