import Link from "next/link";
import { listOems } from "@/server/oems";
import { DataState, EmptyRow, StatusBadge } from "@/components/ui";
import { OEM_STATUS_LABELS } from "@/lib/enums";
import { formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OemsPage() {
  const rows = await listOems();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">OEM master</h1>
          <p className="text-sm muted">Products, capabilities, prices, lead time, compliance, performance, approval.</p>
        </div>
        <Link className="btn-primary" href="/oems/new">
          New OEM
        </Link>
      </div>
      <DataState status={rows.length === 0 ? "empty" : "ok"} emptyTitle="No OEMs yet" emptyHint="Add the suppliers you source from.">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th>Categories</th>
                <th>Products</th>
                <th>Firm committed</th>
                <th>Lead time</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={8} message="No OEMs." />
              ) : (
                rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="link" href={`/oems/${o.id}`}>
                        {o.name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{o.code}</td>
                    <td>
                      <StatusBadge status={o.status} label={OEM_STATUS_LABELS[o.status]} />
                    </td>
                    <td className="text-xs">{o.categories ?? "—"}</td>
                    <td className="tabular-nums">{o.productCount}</td>
                    <td className="tabular-nums">{formatQty(o.committedUnits)}</td>
                    <td>{o.typicalLeadTimeDays ? `${o.typicalLeadTimeDays} d` : "—"}</td>
                    <td>{o.rating ? `${o.rating}/5` : "—"}</td>
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
