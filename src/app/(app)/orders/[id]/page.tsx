import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetail } from "@/server/orders";
import {
  createInvoiceAction,
  createPdiAction,
  recordDeliveryAction,
  recordFulfilmentEventAction,
  updateOrderAction,
} from "@/app/actions/orders";
import { createCommissionAction, recordPaymentAction, updateCommissionStatusAction } from "@/app/actions/finance";
import { Money, RiskBadge, SectionCard, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { evaluateDispatchBlock } from "@/domain/pdi";
import {
  COMMISSION_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  FULFILMENT_STAGE_LABELS,
  FULFILMENT_ORDER,
  FULFILMENT_STATE_LABELS,
  INVOICE_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_STATUS_LABELS,
  PDI_STATUS_LABELS,
} from "@/lib/enums";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getOrderDetail(Number(id));
  if (!d) notFound();
  const order = d.order;
  const block = evaluateDispatchBlock(
    d.pdi.map((p) => ({
      id: p.id,
      status: p.status,
      quantityOffered: p.quantityOffered,
      quantityCleared: p.quantityCleared,
      quantityRejected: p.quantityRejected,
    })),
    Boolean(order.pdiRequirements),
  );
  const userName = new Map(d.users.map((u) => [u.id, u.name]));
  const stageState = new Map<string, string>();
  for (const f of d.fulfilment) stageState.set(f.stage, f.state);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{order.orderNo}</h1>
            <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
            <RiskBadge level={d.risk.level} />
          </div>
          <p className="text-sm muted">
            {d.customerName ?? "no customer"} ·{" "}
            {d.requirementRef ? (
              <Link className="link" href={`/requirements/${order.requirementId}`}>
                {d.requirementRef}
              </Link>
            ) : null}{" "}
            · from quote{" "}
            {d.quote ? (
              <Link className="link" href={`/quotes/${d.quote.id}`}>
                {d.quote.quoteNo}
              </Link>
            ) : "—"}
          </p>
        </div>
        <Link className="btn-secondary" href="/orders">
          Back
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card card-pad">
          <p className="text-xs muted">Order value</p>
          <p className="text-lg font-semibold">
            <Money minor={order.totalValue} />
          </p>
        </div>
        <div className="card card-pad">
          <p className="text-xs muted">Delivery deadline</p>
          <p className="text-lg font-semibold">{formatDate(order.deliveryDeadline)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-xs muted">Expected completion</p>
          <p className="text-lg font-semibold">{formatDate(order.expectedCompletionDate)}</p>
        </div>
        <div className="card card-pad">
          <p className="text-xs muted">Outstanding</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatQty(d.orderedQuantity - d.acceptedQuantity)}
            <span className="text-xs muted"> / {formatQty(d.orderedQuantity)}</span>
          </p>
        </div>
      </div>

      <SectionCard title="Delivery risk" subtitle={d.risk.reason}>
        <p className="text-sm">
          Expected completion {formatDate(order.expectedCompletionDate)} against committed deadline{" "}
          {formatDate(order.deliveryDeadline)} → <RiskBadge level={d.risk.level} />
        </p>
      </SectionCard>

      <SectionCard title="PO details" subtitle="PO number, dates, OEM, supplier PO and the compliance / inspection / PDI requirements">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="muted">Customer PO</p>
            <p className="font-medium">{order.poNumber}</p>
            <p className="text-xs muted">{formatDate(order.poDate)}</p>
          </div>
          <div>
            <p className="muted">Supplier PO</p>
            <p className="font-medium">{order.supplierPoNumber ?? "—"}</p>
            <p className="text-xs muted">{formatDate(order.supplierPoDate)}</p>
          </div>
          <div>
            <p className="muted">Primary OEM</p>
            <p className="font-medium">
              {order.oemId ? (
                <Link className="link" href={`/oems/${order.oemId}`}>
                  OEM #{order.oemId}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="muted">Compliance</p>
            <p>{order.complianceRequirements ?? "—"}</p>
          </div>
          <div>
            <p className="muted">Inspection</p>
            <p>{order.inspectionRequirements ?? "—"}</p>
          </div>
          <div>
            <p className="muted">PDI</p>
            <p>{order.pdiRequirements ?? "—"}</p>
          </div>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs link">Update order</summary>
          <form action={updateOrderAction} className="mt-2 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="orderId" value={order.id} />
            <select className="input" name="status" defaultValue={order.status}>
              {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input className="input" name="deliveryDeadline" type="date" defaultValue={order.deliveryDeadline ?? ""} />
            <input className="input" name="expectedCompletionDate" type="date" defaultValue={order.expectedCompletionDate ?? ""} />
            <input className="input" name="supplierPoNumber" defaultValue={order.supplierPoNumber ?? ""} placeholder="Supplier PO no" />
            <input className="input" name="supplierPoDate" type="date" defaultValue={order.supplierPoDate ?? ""} />
            <input className="input sm:col-span-2" name="complianceRequirements" defaultValue={order.complianceRequirements ?? ""} placeholder="Compliance" />
            <input className="input sm:col-span-2" name="inspectionRequirements" defaultValue={order.inspectionRequirements ?? ""} placeholder="Inspection" />
            <input className="input sm:col-span-2" name="pdiRequirements" defaultValue={order.pdiRequirements ?? ""} placeholder="PDI requirements" />
            <div className="sm:col-span-4">
              <SubmitButton className="btn-secondary">Save</SubmitButton>
            </div>
          </form>
        </details>
      </SectionCard>

      <SectionCard title="Fulfilment timeline" subtitle="OEM PO placed → accepted. Each step has an owner and expected date.">
        <ol className="mb-4 flex flex-wrap gap-2">
          {FULFILMENT_ORDER.map((stage) => {
            const state = stageState.get(stage) ?? "pending";
            const tone =
              state === "done"
                ? "bg-emerald-600 text-white"
                : state === "blocked"
                  ? "bg-red-600 text-white"
                  : state === "in_progress"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600";
            return (
              <li key={stage} className={`badge ${tone}`}>
                {FULFILMENT_STAGE_LABELS[stage]}
              </li>
            );
          })}
        </ol>
        <table className="table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>State</th>
              <th>Owner</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {[...d.fulfilment]
              .sort((a, b) => FULFILMENT_ORDER.indexOf(a.stage) - FULFILMENT_ORDER.indexOf(b.stage))
              .map((f) => (
                <tr key={f.id}>
                  <td>{FULFILMENT_STAGE_LABELS[f.stage]}</td>
                  <td>
                    <StatusBadge status={f.state} label={FULFILMENT_STATE_LABELS[f.state]} />
                  </td>
                  <td>{f.ownerUserId ? userName.get(f.ownerUserId) ?? "—" : "—"}</td>
                  <td>{formatDate(f.expectedDate)}</td>
                  <td>{formatDate(f.actualDate)}</td>
                  <td className="text-xs">{f.notes ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs link">Record a fulfilment step</summary>
          <form action={recordFulfilmentEventAction} className="mt-2 grid gap-2 sm:grid-cols-6">
            <input type="hidden" name="orderId" value={order.id} />
            <select className="input sm:col-span-2" name="stage" defaultValue="production_started">
              {Object.entries(FULFILMENT_STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select className="input" name="state" defaultValue="in_progress">
              {Object.entries(FULFILMENT_STATE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select className="input" name="ownerUserId" defaultValue="">
              <option value="">Owner…</option>
              {d.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input className="input" name="expectedDate" type="date" />
            <input className="input" name="actualDate" type="date" />
            <input className="input sm:col-span-5" name="notes" placeholder="Notes" />
            <SubmitButton className="btn-secondary">Save step</SubmitButton>
          </form>
        </details>
      </SectionCard>

      <SectionCard
        title="PDI — offered, cleared, rejected"
        subtitle="Cleared is distinct from offered and rejected. A failed or held PDI blocks dispatch."
      >
        <div className="mb-3 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs muted">Offered</p>
            <p className="text-lg font-semibold tabular-nums">{formatQty(d.pdiSummary.offered)}</p>
          </div>
          <div>
            <p className="text-xs muted">Cleared</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-700">{formatQty(d.pdiSummary.cleared)}</p>
          </div>
          <div>
            <p className="text-xs muted">Rejected</p>
            <p className="text-lg font-semibold tabular-nums text-red-700">{formatQty(d.pdiSummary.rejected)}</p>
          </div>
          <div>
            <p className="text-xs muted">Pass rate</p>
            <p className="text-lg font-semibold tabular-nums">{d.pdiSummary.passRatePercent}%</p>
          </div>
        </div>
        {block.blocked ? (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">Dispatch blocked</p>
            <ul className="mt-1 list-disc pl-5">
              {block.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-3 text-sm text-emerald-700">No PDI blocker.</p>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>PDI</th>
              <th>Status</th>
              <th>Offered</th>
              <th>Cleared</th>
              <th>Rejected</th>
              <th>Scheduled</th>
              <th>Inspector</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {d.pdi.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-center text-sm muted">
                  No PDI recorded.
                </td>
              </tr>
            ) : (
              d.pdi.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.pdiRef}</td>
                  <td>
                    <StatusBadge status={p.status} label={PDI_STATUS_LABELS[p.status]} />
                  </td>
                  <td className="tabular-nums">{formatQty(p.quantityOffered)}</td>
                  <td className="tabular-nums text-emerald-700">{formatQty(p.quantityCleared)}</td>
                  <td className="tabular-nums text-red-700">{formatQty(p.quantityRejected)}</td>
                  <td>{formatDate(p.scheduledDate)}</td>
                  <td>{p.inspector ?? "—"}</td>
                  <td className="text-xs">{p.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs link">Record PDI</summary>
          <form action={createPdiAction} className="mt-2 grid gap-2 sm:grid-cols-6">
            <input type="hidden" name="orderId" value={order.id} />
            <input className="input sm:col-span-2" name="pdiRef" placeholder="PDI ref" />
            <select className="input" name="status" defaultValue="passed">
              {Object.entries(PDI_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input className="input" name="quantityOffered" type="number" min={0} placeholder="Offered" required />
            <input className="input" name="quantityCleared" type="number" min={0} placeholder="Cleared" />
            <input className="input" name="quantityRejected" type="number" min={0} placeholder="Rejected" />
            <input className="input" name="scheduledDate" type="date" />
            <input className="input" name="completedDate" type="date" />
            <input className="input sm:col-span-2" name="inspector" placeholder="Inspector" />
            <input className="input sm:col-span-2" name="notes" placeholder="Notes" />
            <SubmitButton className="btn-secondary sm:col-span-6">Save PDI</SubmitButton>
          </form>
        </details>
      </SectionCard>

      <SectionCard title="Deliveries" subtitle="Partial deliveries are normal; outstanding balance stays visible.">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Qty</th>
              <th>Invoice</th>
              <th>Received by</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {d.deliveries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-sm muted">
                  No deliveries recorded.
                </td>
              </tr>
            ) : (
              d.deliveries.map((del) => (
                <tr key={del.id}>
                  <td>{formatDate(del.actualDate ?? del.scheduledDate)}</td>
                  <td>
                    <StatusBadge status={del.status} label={DELIVERY_STATUS_LABELS[del.status]} />
                  </td>
                  <td className="tabular-nums">{formatQty(del.quantity)}</td>
                  <td className="text-xs">{d.invoices.find((i) => i.id === del.invoiceId)?.invoiceNo ?? "—"}</td>
                  <td>{del.receivedBy ?? "—"}</td>
                  <td className="text-xs">{del.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs link">Record delivery</summary>
          <form action={recordDeliveryAction} className="mt-2 grid gap-2 sm:grid-cols-6">
            <input type="hidden" name="orderId" value={order.id} />
            <select className="input sm:col-span-2" name="status" defaultValue="delivered">
              {Object.entries(DELIVERY_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input className="input" name="quantity" type="number" min={0} placeholder="Qty delivered" required />
            <input className="input" name="actualDate" type="date" />
            <select className="input" name="invoiceId" defaultValue="">
              <option value="">Invoice…</option>
              {d.invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNo}
                </option>
              ))}
            </select>
            <input className="input" name="receivedBy" placeholder="Received by" />
            <input className="input sm:col-span-4" name="notes" placeholder="Notes" />
            <input className="input sm:col-span-2" name="overrideReason" placeholder="PDI override reason (if blocked)" />
            <SubmitButton className="btn-secondary sm:col-span-6">Save delivery</SubmitButton>
          </form>
        </details>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Invoices" subtitle="One PO can have multiple invoices.">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Type</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm muted">
                    No invoices.
                  </td>
                </tr>
              ) : (
                d.invoices.map((i) => {
                  const paid = d.payments
                    .filter((p) => p.invoiceId === i.id && (p.status === "paid" || p.status === "partially_paid"))
                    .reduce((s, p) => s + p.amount, 0);
                  return (
                    <tr key={i.id}>
                      <td className="font-mono text-xs">{i.invoiceNo}</td>
                      <td className="text-xs">{INVOICE_TYPE_LABELS[i.invoiceType]}</td>
                      <td className="text-right">
                        <Money minor={i.total} />
                      </td>
                      <td className="text-right">
                        <Money minor={Math.max(0, i.total - paid)} />
                      </td>
                      <td>
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs link">Add invoice</summary>
            <form action={createInvoiceAction} className="mt-2 grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="orderId" value={order.id} />
              <input className="input" name="invoiceNo" placeholder="Invoice no" required />
              <select className="input sm:col-span-2" name="invoiceType" defaultValue="customer_tax_invoice">
                {Object.entries(INVOICE_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input className="input" name="invoiceDate" type="date" />
              <input className="input" name="dueDate" type="date" />
              <input className="input" name="amount" placeholder="Amount" />
              <input className="input" name="tax" placeholder="Tax" />
              <div className="sm:col-span-4">
                <SubmitButton className="btn-secondary">Add invoice</SubmitButton>
              </div>
            </form>
          </details>
        </SectionCard>

        <SectionCard title="Payments" subtitle="Partial payments normal. Commission follows the OEM-payment milestone.">
          <table className="table">
            <thead>
              <tr>
                <th>Direction</th>
                <th className="text-right">Amount</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm muted">
                    No payments.
                  </td>
                </tr>
              ) : (
                d.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-xs">{PAYMENT_DIRECTION_LABELS[p.direction]}</td>
                    <td className="text-right">
                      <Money minor={p.amount} />
                    </td>
                    <td>{formatDate(p.paidAt)}</td>
                    <td>{formatDate(p.dueDate)}</td>
                    <td>
                      <StatusBadge status={p.status} label={PAYMENT_STATUS_LABELS[p.status]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs link">Record payment</summary>
            <form action={recordPaymentAction} className="mt-2 grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="orderId" value={order.id} />
              <select className="input sm:col-span-2" name="direction" defaultValue="payable_to_oem">
                {Object.entries(PAYMENT_DIRECTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select className="input sm:col-span-2" name="status" defaultValue="paid">
                {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input className="input" name="amount" placeholder="Amount" required />
              <input className="input" name="paidAt" type="date" />
              <input className="input" name="dueDate" type="date" />
              <input className="input" name="reference" placeholder="Reference" />
              <select className="input sm:col-span-4" name="invoiceId" defaultValue="">
                <option value="">Invoice (optional)…</option>
                {d.invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNo}
                  </option>
                ))}
              </select>
              <div className="sm:col-span-4">
                <SubmitButton className="btn-secondary">Record payment</SubmitButton>
              </div>
            </form>
          </details>
        </SectionCard>
      </div>

      <SectionCard title="Commission" subtitle="Earned on an OEM-payment milestone.">
        <table className="table">
          <thead>
            <tr>
              <th>Base</th>
              <th>Rate</th>
              <th className="text-right">Amount</th>
              <th>Milestone</th>
              <th>Status</th>
              <th>Earned</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.commission.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-sm muted">
                  No commission entries.
                </td>
              </tr>
            ) : (
              d.commission.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Money minor={c.baseAmount} />
                  </td>
                  <td>{c.ratePercent ?? "—"}%</td>
                  <td className="text-right">
                    <Money minor={c.amount} />
                  </td>
                  <td className="text-xs">{c.milestone}</td>
                  <td>
                    <StatusBadge status={c.status} label={COMMISSION_STATUS_LABELS[c.status]} />
                  </td>
                  <td>{formatDate(c.earnedAt)}</td>
                  <td>
                    <form action={updateCommissionStatusAction} className="flex gap-1">
                      <input type="hidden" name="commissionId" value={c.id} />
                      <select className="input w-28 text-xs" name="status" defaultValue={c.status}>
                        {Object.entries(COMMISSION_STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button className="text-xs link" type="submit">
                        set
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs link">Add commission entry</summary>
          <form action={createCommissionAction} className="mt-2 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="orderId" value={order.id} />
            <input className="input" name="baseAmount" placeholder="Base amount" required />
            <input className="input" name="ratePercent" type="number" step="0.01" placeholder="Rate %" required />
            <input className="input sm:col-span-2" name="notes" placeholder="Notes" />
            <div className="sm:col-span-4">
              <SubmitButton className="btn-secondary">Add commission</SubmitButton>
            </div>
          </form>
        </details>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Documents">
          {d.documents.length === 0 ? (
            <p className="text-sm muted">No documents linked to this order.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2">
                  <span>
                    {doc.title}
                    <span className="block text-xs muted">exp {formatDate(doc.expiryDate)}</span>
                  </span>
                  <StatusBadge status={doc.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Audit trail">
          <ul className="space-y-2 text-xs">
            {d.audits.map((a) => (
              <li key={a.id}>
                <span className="muted">{formatDate(a.createdAt)}</span> · <strong>{a.action}</strong>
                {a.reason ? ` — ${a.reason}` : ""}
              </li>
            ))}
            {d.audits.length === 0 ? <li className="muted">No audit entries.</li> : null}
          </ul>
        </SectionCard>
      </div>

      <p className="text-xs muted">
        Order history travels with the order: requirement {d.requirementRef}, quote{" "}
        {d.quote?.quoteNo ?? "—"}, total value {formatMoney(order.totalValue)}.
      </p>
    </div>
  );
}
