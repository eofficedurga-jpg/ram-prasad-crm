import { toMinor } from "./format";

export const MAX_LINE_ITEMS = 500;

export type ParsedLine = {
  partNumber: string;
  description: string;
  quantity: number;
  targetUnitPrice: number | null;
};

export function parseLines(text: string): { lines: ParsedLine[]; errors: string[] } {
  const errors: string[] = [];
  const lines: ParsedLine[] = [];
  const raw = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (raw.length > MAX_LINE_ITEMS) {
    errors.push(
      `A requirement can carry at most ${MAX_LINE_ITEMS} line items; you supplied ${raw.length}.`,
    );
    return { lines, errors };
  }
  raw.forEach((row, i) => {
    const parts = row.split(",").map((p) => p.trim());
    const [partNumber, description, qtyText, priceText] = parts;
    if (!partNumber) {
      errors.push(`Line ${i + 1}: part number is required.`);
      return;
    }
    const quantity = Number(qtyText ?? "");
    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push(`Line ${i + 1}: quantity must be a non-negative number.`);
      return;
    }
    lines.push({
      partNumber,
      description: description ?? "",
      quantity: Math.round(quantity),
      targetUnitPrice: priceText ? toMinor(priceText) : null,
    });
  });
  return { lines, errors };
}
