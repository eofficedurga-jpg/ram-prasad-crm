import Link from "next/link";
import { searchAll, searchHistory } from "@/server/search";
import { EmptyRow, Money, StatusBadge } from "@/components/ui";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { DOCUMENT_TYPE_LABELS } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; part?: string }>;
}) {
  const { q, part } = await searchParams;
  const results = q ? await searchAll(q) : null;
  const history = part ? await searchHistory(part) : null;
  const totalResults = results
    ? results.requirements.length +
      results.parts.length +
      results.quotes.length +
      results.orders.length +
      results.oems.length +
      results.documents.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Search & history</h1>
        <p className="text-sm muted">
          Search all history for a comparable requirement — past OEM, price, delivery, margin, documents and problems.
        </p>
      </div>

      <form className="card card-pad flex flex-wrap gap-2" method="get">
        <input
          className="input flex-1 min-w-[240px]"
          name="q"
          placeholder="Search requirements, part numbers, quotes, orders, OEMs, documents…"
          defaultValue={q ?? ""}
        />
        <button className="btn-primary" type="submit">
          Search
        </button>
      </form>

      <form className="card card-pad flex flex-wrap gap-2" method="get">
        <input
          className="input flex-1 min-w-[240px]"
          name="part"
          placeholder="Comparable-requirement history by part number (e.g. HAB-770)"
          defaultValue={part ?? ""}
        />
        <button className="btn-secondary" type="submit">
          Find history
        </button>
      </form>

      {results ? (
        <div className="space-y-6">
          <p className="text-sm muted">
            {totalResults} result(s) for “{results.query}”.
          </p>

          <section className="card overflow-x-auto">
            <div className="card-header">
              <h2 className="card-title">Requirements ({results.requirements.length})</h2>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.requirements.length === 0 ? (
                  <EmptyRow colSpan={3} message="No matching requirements." />
                ) : (
                  results.requirements.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link className="link" href={`/requirements/${r.id}`}>
                          {r.ref}
                        </Link>
                      </td>
                      <td>{r.title}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="card overflow-x-auto">
            <div className="card-header">
              <h2 className="card-title">Line items / parts ({results.parts.length})</h2>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Requirement</th>
                </tr>
              </thead>
              <tbody>
                {results.parts.length === 0 ? (
                  <EmptyRow colSpan={4} message="No matching parts." />
                ) : (
                  results.parts.map((p, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{p.partNumber}</td>
                      <td>{p.description ?? "—"}</td>
                      <td className="tabular-nums">{formatQty(p.quantity)}</td>
                      <td>
                        <Link className="link text-xs" href={`/requirements/${p.requirementId}`}>
                          open
                        </Link>
                        {" · "}
                        <Link className="link text-xs" href={`/search?part=${encodeURIComponent(p.partNumber)}`}>
                          history
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card overflow-x-auto">
              <div className="card-header">
                <h2 className="card-title">Quotes ({results.quotes.length})</h2>
              </div>
              <table className="table">
                <tbody>
                  {results.quotes.length === 0 ? (
                    <EmptyRow colSpan={3} message="No matching quotes." />
                  ) : (
                    results.quotes.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link className="link font-mono text-xs" href={`/quotes/${r.id}`}>
                            {r.quoteNo}
                          </Link>
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-right">
                          <Money minor={r.total} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card overflow-x-auto">
              <div className="card-header">
                <h2 className="card-title">Orders ({results.orders.length})</h2>
              </div>
              <table className="table">
                <tbody>
                  {results.orders.length === 0 ? (
                    <EmptyRow colSpan={3} message="No matching orders." />
                  ) : (
                    results.orders.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link className="link" href={`/orders/${r.id}`}>
                            {r.orderNo}
                          </Link>
                          <span className="block font-mono text-xs muted">{r.poNumber}</span>
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-right">
                          <Money minor={r.total} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card overflow-x-auto">
              <div className="card-header">
                <h2 className="card-title">OEMs ({results.oems.length})</h2>
              </div>
              <table className="table">
                <tbody>
                  {results.oems.length === 0 ? (
                    <EmptyRow colSpan={3} message="No matching OEMs." />
                  ) : (
                    results.oems.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link className="link" href={`/oems/${r.id}`}>
                            {r.name}
                          </Link>
                        </td>
                        <td className="font-mono text-xs">{r.code}</td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card overflow-x-auto">
              <div className="card-header">
                <h2 className="card-title">Documents ({results.documents.length})</h2>
              </div>
              <table className="table">
                <tbody>
                  {results.documents.length === 0 ? (
                    <EmptyRow colSpan={3} message="No matching documents." />
                  ) : (
                    results.documents.map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td>
                        <td className="text-xs">{DOCUMENT_TYPE_LABELS[r.docType]}</td>
                        <td>{formatDate(r.expiryDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      ) : null}

      {history ? (
        <section className="card overflow-x-auto">
          <div className="card-header">
            <h2 className="card-title">Comparable history for “{part}” ({history.length})</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Part</th>
                <th>Qty</th>
                <th>OEM</th>
                <th>Firm</th>
                <th>Unit price</th>
                <th>Lead</th>
                <th>Outcome</th>
                <th>Winning price</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <EmptyRow colSpan={9} message="No history for that part number." />
              ) : (
                history.map((h, i) => (
                  <tr key={i}>
                    <td>
                      <Link className="link text-xs" href={`/requirements/${h.requirementId}`}>
                        {h.ref}
                      </Link>
                      <span className="block text-xs muted">{h.title}</span>
                    </td>
                    <td className="font-mono text-xs">{h.partNumber}</td>
                    <td className="tabular-nums">{formatQty(h.quantity)}</td>
                    <td className="text-xs">{h.oemName ?? "—"}</td>
                    <td className="tabular-nums">{h.firmQuantity ? formatQty(h.firmQuantity) : "—"}</td>
                    <td>{h.unitPrice ? formatMoney(h.unitPrice) : "—"}</td>
                    <td>{h.leadTimeDays ? `${h.leadTimeDays} d` : "—"}</td>
                    <td>
                      <StatusBadge status={h.status} />
                      {h.lossReasonCode ? (
                        <span className="block text-xs text-red-700">
                          {h.lossReasonCode.replace(/_/g, " ")}
                          {h.lossCompetitor ? ` vs ${h.lossCompetitor}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td>{h.lossWinningPrice ? formatMoney(h.lossWinningPrice) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
