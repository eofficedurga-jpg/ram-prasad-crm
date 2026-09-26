import Link from "next/link";
import { listQuotes } from "@/server/quotes";
import { DataState, EmptyRow, Money, StatusBadge } from "@/components/ui";
import { QUOTE_STATUS_LABELS } from "@/lib/enums";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const rows = await listQuotes();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Quotes</h1>
        <p className="text-sm muted">Every quote is built from a requirement. Versioned and approved.</p>
      </div>
      <DataState status={rows.length === 0 ? "empty" : "ok"} emptyTitle="No quotes yet" emptyHint="Open a requirement and build a quote.">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Requirement</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Recommended</th>
                <th>Final</th>
                <th>Submitted</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={9} message="No quotes." />
              ) : (
                rows.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link className="link font-mono text-xs" href={`/quotes/${q.id}`}>
                        {q.quoteNo}
                      </Link>
                      <span className="ml-1 text-xs muted">v{q.version}</span>
                    </td>
                    <td>
                      <Link className="link" href={`/requirements/${q.requirementId}`}>
                        {q.requirementRef}
                      </Link>
                      <span className="block text-xs muted">{q.requirementTitle}</span>
                    </td>
                    <td>{q.customer ?? "—"}</td>
                    <td>
                      <StatusBadge status={q.status} label={QUOTE_STATUS_LABELS[q.status]} />
                    </td>
                    <td>
                      <Money minor={q.totalCost} />
                    </td>
                    <td>
                      <Money minor={q.totalRecommendedPrice} />
                    </td>
                    <td className="font-medium">
                      <Money minor={q.totalFinalPrice} />
                    </td>
                    <td>{formatDate(q.submittedAt)}</td>
                    <td>{formatDate(q.approvedAt)}</td>
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
