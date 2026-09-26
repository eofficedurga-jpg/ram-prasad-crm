import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { recordPaymentAction } from "@/app/actions/finance";
import { DataState, EmptyRow, Money, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import {
  COMMISSION_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/enums";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const db = await getDbAsync();
  const [invoiceRows, paymentRows, commissionRows, orderRows] = await Promise.all([
    db
      .select({ invoice: t.invoices, orderNo: t.orders.orderNo, customer: t.customers.name })
      .from(t.invoices)
      .leftJoin(t.orders, eq(t.orders.id, t.invoices.orderId))
      .leftJoin(t.customers, eq(t.customers.id, t.orders.customerId))
      .orderBy(desc(t.invoices.createdAt)),
    db
      .select({ payment: t.payments, invoiceNo: t.invoices.invoiceNo, orderNo: t.orders.orderNo })
      .from(t.payments)
      .leftJoin(t.invoices, eq(t.invoices.id, t.payments.invoiceId))
      .leftJoin(t.orders, eq(t.orders.id, t.payments.orderId))
      .orderBy(desc(t.payments.createdAt)),
    db
      .select({ commission: t.commissionEntries, orderNo: t.orders.orderNo, oem: t.oems.name })
      .from(t.commissionEntries)
      .leftJoin(t.orders, eq(t.orders.id, t.commissionEntries.orderId))
      .leftJoin(t.oems, eq(t.oems.id, t.commissionEntries.oemId))
      .orderBy(desc(t.commissionEntries.createdAt)),
    db.select({ id: t.orders.id, orderNo: t.orders.orderNo }).from(t.orders).orderBy(asc(t.orders.orderNo)),
  ]);

  const paidByInvoice = new Map<number, number>();
  for (const p of paymentRows) {
    if (p.payment.invoiceId && (p.payment.status === "paid" || p.payment.status === "partially_paid")) {
      paidByInvoice.set(
        p.payment.invoiceId,
        (paidByInvoice.get(p.payment.invoiceId) ?? 0) + p.payment.amount,
      );
    }
  }

  const receivable = invoiceRows
    .filter((i) => i.invoice.invoiceType === "customer_tax_invoice")
    .reduce((s, i) => s + Math.max(0, i.invoice.total - (paidByInvoice.get(i.invoice.id) ?? 0)), 0);
  const payable = invoiceRows
    .filter((i) => i.invoice.invoiceType === "supplier_invoice")
    .reduce((s, i) => s + Math.max(0, i.invoice.total - (paidByInvoice.get(i.invoice.id) ?? 0)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Finance</h1>
        <p className="text-sm muted">
          Receivable {formatMoney(receivable)} · Payable {formatMoney(payable)} · commission on the OEM-payment milestone.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Invoices</h2>
        <DataState status={invoiceRows.length === 0 ? "empty" : "ok"} emptyTitle="No invoices yet" emptyHint="Create an invoice from an order.">
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Order</th>
                  <th>Type</th>
                  <th>Due</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.length === 0 ? (
                  <EmptyRow colSpan={7} message="No invoices." />
                ) : (
                  invoiceRows.map((i) => {
                    const paid = paidByInvoice.get(i.invoice.id) ?? 0;
                    return (
                      <tr key={i.invoice.id}>
                        <td className="font-mono text-xs">{i.invoice.invoiceNo}</td>
                        <td>
                          <Link className="link text-xs" href={`/orders/${i.invoice.orderId}`}>
                            {i.orderNo}
                          </Link>
                          <span className="block text-xs muted">{i.customer ?? ""}</span>
                        </td>
                        <td className="text-xs">{INVOICE_TYPE_LABELS[i.invoice.invoiceType]}</td>
                        <td>{formatDate(i.invoice.dueDate)}</td>
                        <td className="text-right">
                          <Money minor={i.invoice.total} />
                        </td>
                        <td className="text-right">
                          <Money minor={Math.max(0, i.invoice.total - paid)} />
                        </td>
                        <td>
                          <StatusBadge status={i.invoice.status} label={INVOICE_STATUS_LABELS[i.invoice.status]} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Invoice / Order</th>
                <th className="text-right">Amount</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.length === 0 ? (
                <EmptyRow colSpan={7} message="No payments." />
              ) : (
                paymentRows.map((p) => (
                  <tr key={p.payment.id}>
                    <td className="text-xs">{PAYMENT_DIRECTION_LABELS[p.payment.direction]}</td>
                    <td className="text-xs">
                      {p.invoiceNo ?? p.orderNo ?? "—"}
                    </td>
                    <td className="text-right">
                      <Money minor={p.payment.amount} />
                    </td>
                    <td>{formatDate(p.payment.paidAt)}</td>
                    <td>{formatDate(p.payment.dueDate)}</td>
                    <td className="text-xs">{p.payment.reference ?? "—"}</td>
                    <td>
                      <StatusBadge status={p.payment.status} label={PAYMENT_STATUS_LABELS[p.payment.status]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Commission</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>OEM</th>
                <th className="text-right">Base</th>
                <th>Rate</th>
                <th className="text-right">Amount</th>
                <th>Milestone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {commissionRows.length === 0 ? (
                <EmptyRow colSpan={7} message="No commission entries." />
              ) : (
                commissionRows.map((c) => (
                  <tr key={c.commission.id}>
                    <td>
                      <Link className="link text-xs" href={`/orders/${c.commission.orderId}`}>
                        {c.orderNo}
                      </Link>
                    </td>
                    <td className="text-xs">{c.oem ?? "—"}</td>
                    <td className="text-right">
                      <Money minor={c.commission.baseAmount} />
                    </td>
                    <td>{c.commission.ratePercent ?? "—"}%</td>
                    <td className="text-right">
                      <Money minor={c.commission.amount} />
                    </td>
                    <td className="text-xs">{c.commission.milestone}</td>
                    <td>
                      <StatusBadge status={c.commission.status} label={COMMISSION_STATUS_LABELS[c.commission.status]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="card-title mb-3">Record a payment</h2>
        <form action={recordPaymentAction} className="grid gap-2 sm:grid-cols-4">
          <select className="input sm:col-span-2" name="direction" defaultValue="receivable_from_customer">
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
          <select className="input sm:col-span-2" name="orderId" defaultValue="">
            <option value="">Order…</option>
            {orderRows.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNo}
              </option>
            ))}
          </select>
          <select className="input sm:col-span-2" name="invoiceId" defaultValue="">
            <option value="">Invoice (optional)…</option>
            {invoiceRows.map((i) => (
              <option key={i.invoice.id} value={i.invoice.id}>
                {i.invoice.invoiceNo}
              </option>
            ))}
          </select>
          <input className="input" name="amount" placeholder="Amount" required />
          <input className="input" name="paidAt" type="date" />
          <input className="input" name="dueDate" type="date" />
          <input className="input" name="reference" placeholder="Reference" />
          <div className="sm:col-span-4">
            <SubmitButton className="btn-primary">Record payment</SubmitButton>
          </div>
        </form>
        <p className="mt-2 text-xs muted">
          Marking an OEM (payable) payment as paid reaches the commission milestone and earns the pending commission.
        </p>
      </section>
    </div>
  );
}
