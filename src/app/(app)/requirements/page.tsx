import Link from "next/link";
import { listRequirements } from "@/server/requirements";
import { CoverageBar, DataState, EmptyRow, StatusBadge } from "@/components/ui";
import { REQUIREMENT_STATUS_LABELS } from "@/lib/enums";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  let rows: Awaited<ReturnType<typeof listRequirements>> = [];
  let failed: string | null = null;
  try {
    rows = await listRequirements();
  } catch (e) {
    failed = e instanceof Error ? e.message : String(e);
  }
  const filtered = status ? rows.filter((r) => r.status === status) : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Requirements & RFIs</h1>
          <p className="text-sm muted">
            The central record. Everything else hangs off it. {rows.length} total.
          </p>
        </div>
        <Link className="btn-primary" href="/requirements/new">
          New requirement
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/requirements" className={`badge ${!status ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
          All
        </Link>
        {Object.entries(REQUIREMENT_STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/requirements?status=${value}`}
            className={`badge ${status === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <DataState status={failed ? "error" : filtered.length === 0 ? "empty" : "ok"} errorMessage={failed ?? undefined} emptyTitle="No requirements match" emptyHint="Create a requirement or change the filter.">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title / customer</th>
                <th>Status</th>
                <th>Lines</th>
                <th>Coverage</th>
                <th>Required delivery</th>
                <th>Submission</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow colSpan={8} message="No requirements yet." />
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link className="link" href={`/requirements/${r.id}`}>
                        {r.ref}
                      </Link>
                      <p className="text-xs muted">{r.tenderRef ?? r.enquiryRef ?? "—"}</p>
                    </td>
                    <td>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs muted">{r.customer ?? "No customer"}</p>
                    </td>
                    <td>
                      <StatusBadge status={r.status} label={REQUIREMENT_STATUS_LABELS[r.status]} />
                      {r.lossReasonCode ? (
                        <p className="mt-1 text-xs text-red-700">lost: {r.lossReasonCode.replace(/_/g, " ")}</p>
                      ) : null}
                    </td>
                    <td className="tabular-nums">{r.lineCount}</td>
                    <td>
                      <CoverageBar required={r.required} committed={r.committed} compact />
                    </td>
                    <td>{formatDate(r.requiredDeliveryDate)}</td>
                    <td>{formatDate(r.submissionDeadline)}</td>
                    <td>{r.ownerName ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}
