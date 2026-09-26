import Link from "next/link";
import { listOrders } from "@/server/orders";
import { DataState, EmptyRow, Money, RiskBadge, StatusBadge } from "@/components/ui";
import { ORDER_STATUS_LABELS } from "@/lib/enums";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const rows = await listOrders();
  const atRisk = rows.filter((r) => r.risk === "at_risk" || r.risk === "late");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Orders & POs</h1>
        <p className="text-sm muted">
          {rows.length} orders · {atRisk.length} at delivery risk. Every PO maps to an approved quote.
        </p>
      </div>
      <DataState status={rows.length === 0 ? "empty" : "ok"} emptyTitle="No orders yet" emptyHint="Approve a quote, then convert it to an order.">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Requirement</th>
                <th>Customer</th>
                <th>PO</th>
                <th>Status</th>
                <th>Delivery risk</th>
                <th>Deadline</th>
                <th>Expected</th>
                <th className="text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={9} message="No orders." />
              ) : (
                rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="link" href={`/orders/${o.id}`}>
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="text-xs">{o.requirementRef ?? "—"}</td>
                    <td>{o.customer ?? "—"}</td>
                    <td className="font-mono text-xs">{o.poNumber}</td>
                    <td>
                      <StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status]} />
                    </td>
                    <td>
                      <RiskBadge level={o.risk} />
                    </td>
                    <td>{formatDate(o.deliveryDeadline)}</td>
                    <td>{formatDate(o.expectedCompletionDate)}</td>
                    <td className="text-right">
                      <Money minor={o.totalValue} />
                    </td>
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
