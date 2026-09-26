import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney, formatQty } from "@/lib/format";

type Tone = "green" | "blue" | "amber" | "red" | "slate";

const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  slate: "bg-slate-100 text-slate-700",
};

const TONE_BAR: Record<Tone, string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  slate: "bg-slate-400",
};

const TONE_MAP: Record<string, Tone> = {
  // success
  won: "green",
  approved: "green",
  paid: "green",
  passed: "green",
  done: "green",
  accepted: "green",
  valid: "green",
  completed: "green",
  received: "green",
  on_track: "green",
  firm_commitment: "green",
  earned: "green",
  // in-flight
  submitted: "blue",
  sent: "blue",
  issued: "blue",
  in_progress: "blue",
  qualifying: "blue",
  quoted: "blue",
  delinquent: "red",
  // waiting / warning
  pending: "amber",
  pending_approval: "amber",
  at_risk: "amber",
  expiring: "amber",
  partially_paid: "amber",
  clarification_requested: "amber",
  technical_clarification: "amber",
  commercial_negotiation: "amber",
  awaiting_approval: "amber",
  held: "amber",
  in_transit: "amber",
  scheduled: "amber",
  responded: "amber",
  availability_indication: "amber",
  quote_indication: "amber",
  // failure
  lost: "red",
  cancelled: "red",
  rejected: "red",
  failed: "red",
  expired: "red",
  overdue: "red",
  blocked: "red",
  late: "red",
  decline: "red",
  not_approved: "red",
  at_risk_flag: "red",
  // neutral
  draft: "slate",
  no_response: "slate",
  closed: "slate",
  suspended: "slate",
  superseded: "slate",
  other: "slate",
  no_deadline: "slate",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE_MAP[status] ?? "slate";
  return <Badge tone={tone}>{label ?? status.replace(/_/g, " ")}</Badge>;
}

export function RiskBadge({ level }: { level: string }) {
  const label =
    level === "on_track"
      ? "On track"
      : level === "at_risk"
        ? "At risk"
        : level === "late"
          ? "Late"
          : level === "delivered"
            ? "Delivered"
            : "No deadline";
  return <Badge tone={TONE_MAP[level] ?? "slate"}>{label}</Badge>;
}

export function Money({
  minor,
  currency = "INR",
}: {
  minor: number | null | undefined;
  currency?: string;
}) {
  return <span className="tabular-nums">{formatMoney(minor, currency)}</span>;
}

export function Qty({ value }: { value: number | null | undefined }) {
  return <span className="tabular-nums">{formatQty(value)}</span>;
}

export function SectionCard({
  title,
  action,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="card card-pad h-full">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs muted flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${TONE_BAR[tone]}`} />
          {hint}
        </p>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/**
 * Three distinct states, never a blank table:
 *  - ok      -> render rows
 *  - empty   -> "no data", with a next action
 *  - error   -> "failed", with the error message
 *  - missing -> required source data not available
 */
export function DataState({
  status,
  children,
  emptyTitle = "Nothing here yet",
  emptyHint,
  errorMessage,
  missingMessage,
}: {
  status: "ok" | "empty" | "error" | "missing";
  children: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  errorMessage?: string;
  missingMessage?: string;
}) {
  if (status === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">Failed to load</p>
        <p className="mt-1">{errorMessage ?? "An unexpected error occurred."}</p>
      </div>
    );
  }
  if (status === "missing") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Missing data</p>
        <p className="mt-1">{missingMessage ?? "Required source data is not available yet."}</p>
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm">
        <p className="font-medium text-slate-700">{emptyTitle}</p>
        {emptyHint ? <p className="mt-1 muted">{emptyHint}</p> : null}
      </div>
    );
  }
  return <>{children}</>;
}

export function CoverageBar({
  required,
  committed,
  compact = false,
}: {
  required: number;
  committed: number;
  compact?: boolean;
}) {
  const covered = Math.min(committed, required);
  const pct = required > 0 ? Math.round((covered / required) * 100) : 100;
  const uncovered = Math.max(0, required - committed);
  const over = Math.max(0, committed - required);
  return (
    <div className="min-w-[150px]">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${uncovered > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs ${compact ? "" : "mt-1.5"}`}>
        <span className="tabular-nums">Required <strong>{formatQty(required)}</strong></span>
        <span className="tabular-nums text-emerald-700">Committed <strong>{formatQty(committed)}</strong></span>
        {uncovered > 0 ? (
          <span className="tabular-nums text-amber-700">Uncovered <strong>{formatQty(uncovered)}</strong></span>
        ) : (
          <span className="text-emerald-700 font-medium">Covered</span>
        )}
        {over > 0 ? <span className="tabular-nums text-slate-500">Over <strong>{formatQty(over)}</strong></span> : null}
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm muted">
        {message}
      </td>
    </tr>
  );
}
