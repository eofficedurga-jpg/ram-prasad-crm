// Money is stored as integer minor units (paise). Quantities are integers.

export function formatMoney(
  minorUnits: number | null | undefined,
  currency = "INR",
): string {
  if (minorUnits === null || minorUnits === undefined) return "—";
  const major = minorUnits / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export function toMinor(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromMinor(minorUnits: number | null | undefined): number {
  if (minorUnits === null || minorUnits === undefined) return 0;
  return minorUnits / 100;
}

export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const dbb = typeof b === "string" ? new Date(b) : b;
  return Math.round((da.getTime() - dbb.getTime()) / 86_400_000);
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
