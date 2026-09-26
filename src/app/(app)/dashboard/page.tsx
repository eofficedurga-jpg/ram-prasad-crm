import Link from "next/link";
import { getDashboardFacts } from "@/server/dashboard";
import { answerQuestion, suggestedQuestions } from "@/domain/qna";
import { getQnaFacts } from "@/server/qna";
import { askQuestionAction } from "@/app/actions/qna";
import { regenerateFollowUpsAction } from "@/app/actions/followups";
import { formatDate, formatMoney } from "@/lib/format";
import { Money, RiskBadge, SectionCard, StatCard, StatusBadge } from "@/components/ui";
import { LOSS_REASON_LABELS } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [facts, qnaFacts] = await Promise.all([getDashboardFacts(), getQnaFacts()]);
  const { q } = await searchParams;
  const answer = q ? answerQuestion(q, qnaFacts) : null;

  const openOrders = facts.orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered",
  );
  const atRisk = facts.orders.filter((o) => o.risk === "at_risk" || o.risk === "late");
  const expiringDocs = facts.documents.filter(
    (d) => d.daysToExpiry !== null && d.daysToExpiry <= 90,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Morning view</h1>
          <p className="text-sm muted">
            {facts.monthLabel} · {facts.generatedAt.toLocaleString("en-GB")}
          </p>
        </div>
        <form action={regenerateFollowUpsAction}>
          <button className="btn-secondary" type="submit">
            Regenerate follow-up tasks
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Open orders" value={openOrders.length} hint={`${facts.orders.length} total`} tone="blue" href="/orders" />
        <StatCard label="Orders at risk" value={atRisk.length} hint="expected vs committed deadline" tone="red" href="/orders" />
        <StatCard label="Quotes awaiting response" value={facts.quotesAwaitingResponse.length} hint="submitted to agency" tone="amber" href="/quotes" />
        <StatCard label="Receivable pending" value={<Money minor={facts.receivableOutstanding} />} hint={`${facts.overdueInvoices} overdue invoice(s)`} tone="amber" href="/finance" />
        <StatCard label="OEM responses pending" value={facts.oemPending.length} hint="requests with no response" tone="amber" href="/followups" />
        <StatCard label="Documents expiring" value={expiringDocs.length} hint="within 90 days or expired" tone="red" href="/documents" />
      </div>

      <SectionCard title="Ask your data" subtitle="Answers are computed from stored records only — never invented.">
        <form action={askQuestionAction} className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[240px]"
            name="question"
            placeholder='e.g. "how many orders are there?"'
            defaultValue={q ?? ""}
          />
          <button className="btn-primary" type="submit">
            Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedQuestions().map((s) => (
            <Link key={s} href={`/ask?q=${encodeURIComponent(s)}`} className="badge bg-slate-100 text-slate-700 hover:bg-slate-200">
              {s}
            </Link>
          ))}
        </div>
        {answer ? (
          <div className={`mt-4 rounded-md border p-3 text-sm ${answer.answered ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="font-medium">{q}</p>
            <p className="mt-1">{answer.answer}</p>
            {answer.detail && answer.detail.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {answer.detail.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : null}
            <Link href={`/ask?q=${encodeURIComponent(q ?? "")}`} className="link mt-2 inline-block text-xs">
              Open full answer
            </Link>
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Orders at delivery risk" subtitle="Where you must not be asked 'where is our order?'">
          {atRisk.length === 0 ? (
            <p className="text-sm muted">No orders at risk. All open orders are on track.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Deadline</th>
                  <th>Outstanding</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="link" href={`/orders/${o.id}`}>
                        {o.orderNo}
                      </Link>
                    </td>
                    <td>{o.customer ?? "—"}</td>
                    <td>{formatDate(o.deliveryDeadline)}</td>
                    <td className="tabular-nums">{o.orderedQuantity - o.acceptedQuantity}</td>
                    <td>
                      <RiskBadge level={o.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Coverage gaps" subtitle="Open requirements where firm commitments do not yet cover the quantity">
          {facts.coverageGaps.length === 0 ? (
            <p className="text-sm muted">Every open requirement is fully covered by firm OEM commitments.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Required</th>
                  <th>Uncovered</th>
                </tr>
              </thead>
              <tbody>
                {facts.coverageGaps.map((g) => (
                  <tr key={g.requirementId}>
                    <td>
                      <Link className="link" href={`/requirements/${g.requirementId}`}>
                        {g.ref}
                      </Link>
                      <p className="text-xs muted">{g.title}</p>
                    </td>
                    <td className="tabular-nums">{g.required}</td>
                    <td className="tabular-nums font-semibold text-amber-700">{g.uncovered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Open orders by state">
          {facts.ordersByState.length === 0 ? (
            <p className="text-sm muted">No orders yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {facts.ordersByState.map((s) => (
                <li key={s.state} className="flex items-center justify-between">
                  <StatusBadge status={s.state} label={s.label} />
                  <span className="tabular-nums font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Why we lost" subtitle="Structured loss reasons">
          {facts.losses.byReason.length === 0 ? (
            <p className="text-sm muted">No losses recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {facts.losses.byReason.map((r) => (
                <li key={r.code} className="flex items-center justify-between">
                  <span>{LOSS_REASON_LABELS[r.code] ?? r.label}</span>
                  <span className="tabular-nums">
                    {r.count} · <Money minor={r.value} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {facts.losses.recent.length > 0 ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Recent</p>
              <ul className="mt-1 space-y-1 text-xs">
                {facts.losses.recent.slice(0, 5).map((l) => (
                  <li key={l.ref}>
                    <span className="font-medium">{l.ref}</span> · {l.title} — {l.reason}
                    {l.competitor ? ` (vs ${l.competitor})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Payments pending">
          {facts.invoices.filter((i) => i.balance > 0).length === 0 ? (
            <p className="text-sm muted">No outstanding invoices.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Type</th>
                  <th>Due</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {facts.invoices
                  .filter((i) => i.balance > 0)
                  .slice(0, 8)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.invoiceNo}</td>
                      <td className="text-xs">{i.invoiceType === "customer_tax_invoice" ? "Receivable" : "Payable"}</td>
                      <td>{formatDate(i.dueDate)}</td>
                      <td className="text-right">
                        <Money minor={i.balance} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Documents expiring">
          {expiringDocs.length === 0 ? (
            <p className="text-sm muted">No documents expiring in the next 90 days.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Expiry</th>
                  <th className="text-right">Days</th>
                </tr>
              </thead>
              <tbody>
                {expiringDocs.slice(0, 8).map((d) => (
                  <tr key={d.id}>
                    <td>{d.title}</td>
                    <td>{formatDate(d.expiryDate)}</td>
                    <td className="text-right tabular-nums">
                      {(d.daysToExpiry ?? 0) < 0 ? (
                        <span className="text-red-700">expired</span>
                      ) : (
                        d.daysToExpiry
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      <p className="text-xs muted">
        Receivable from customers: {formatMoney(facts.receivableOutstanding)} · Payable to OEMs:{" "}
        {formatMoney(facts.payableOutstanding)} · Open follow-ups: {facts.openFollowUps} · Pending approvals:{" "}
        {facts.pendingApprovals}
      </p>
    </div>
  );
}
