import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuoteDetail } from "@/server/quotes";
import {
  createQuoteVersionAction,
  decideQuoteAction,
  submitQuoteForApprovalAction,
  updateQuoteLineAction,
} from "@/app/actions/quotes";
import { createOrderFromQuoteAction } from "@/app/actions/orders";
import { Money, SectionCard, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { QUOTE_STATUS_LABELS } from "@/lib/enums";
import { formatDate, formatMoney } from "@/lib/format";
import { impliedMargin as impliedMarginClient } from "@/domain/pricing";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getQuoteDetail(Number(id));
  if (!detail) notFound();
  const { quote, requirement, lines, versions, approvals, existingOrder, comparable, oems } = detail;

  const canEdit = quote.status === "draft" || quote.status === "pending_approval";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {quote.quoteNo} <span className="text-sm muted">v{quote.version}</span>
            </h1>
            <StatusBadge status={quote.status} label={QUOTE_STATUS_LABELS[quote.status]} />
          </div>
          <p className="text-sm muted">
            {requirement ? (
              <Link className="link" href={`/requirements/${requirement.id}`}>
                {requirement.ref}
              </Link>
            ) : null}{" "}
            · {requirement?.title} · {detail.customer?.name ?? "no customer"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quote.status === "draft" ? (
            <form action={submitQuoteForApprovalAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <SubmitButton className="btn-primary">Submit for approval</SubmitButton>
            </form>
          ) : null}
          {quote.status === "pending_approval" ? (
            <>
              <form action={decideQuoteAction} className="flex items-end gap-2">
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="decision" value="approve" />
                <input className="input w-40" name="comment" placeholder="Approval comment" />
                <SubmitButton className="btn-primary">Approve</SubmitButton>
              </form>
              <form action={decideQuoteAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="decision" value="reject" />
                <SubmitButton className="btn-danger">Reject</SubmitButton>
              </form>
            </>
          ) : null}
          <form action={createQuoteVersionAction}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton className="btn-secondary">New version</SubmitButton>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card card-pad">
          <p className="text-xs muted">Total cost</p>
          <p className="text-lg font-semibold">
            <Money minor={quote.totalCost} />
          </p>
        </div>
        <div className="card card-pad">
          <p className="text-xs muted">Recommended (advisory)</p>
          <p className="text-lg font-semibold">
            <Money minor={quote.totalRecommendedPrice} />
          </p>
        </div>
        <div className="card card-pad">
          <p className="text-xs muted">Final price</p>
          <p className="text-lg font-semibold text-blue-700">
            <Money minor={quote.totalFinalPrice} />
          </p>
        </div>
        <div className="card card-pad">
          <p className="text-xs muted">Final margin</p>
          <p className="text-lg font-semibold">
            {quote.totalFinalPrice > 0
              ? `${Math.round(((quote.totalFinalPrice - quote.totalCost) / quote.totalFinalPrice) * 1000) / 10}%`
              : "—"}
          </p>
        </div>
      </div>

      <SectionCard
        title="Bid intelligence — comparable past bids"
        subtitle="What was quoted before, whether it was won or lost, and the winning price. Change the bid from history."
      >
        {comparable.length === 0 ? (
          <p className="text-sm muted">
            No comparable past bids for these part numbers yet. Comparisons improve as history builds.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Part</th>
                <th>History quote</th>
                <th>Outcome</th>
                <th>Qty</th>
                <th>Our unit price</th>
                <th>Winning price</th>
                <th>OEM</th>
                <th>Loss reason</th>
              </tr>
            </thead>
            <tbody>
              {comparable.map((c) => (
                <tr key={`${c.quoteId}-${c.partNumber}`}>
                  <td className="font-mono text-xs">{c.partNumber}</td>
                  <td>
                    <Link className="link text-xs" href={`/quotes/${c.quoteId}`}>
                      {c.quoteNo}
                    </Link>
                    <span className="block text-xs muted">{c.requirementRef}</span>
                  </td>
                  <td>
                    <StatusBadge status={c.outcome === "won" ? "won" : c.outcome === "lost" ? "lost" : "submitted"} label={c.outcome} />
                  </td>
                  <td className="tabular-nums">{c.quantity}</td>
                  <td>
                    <Money minor={c.finalUnitPrice} />
                  </td>
                  <td>{c.lossWinningPrice ? <Money minor={c.lossWinningPrice} /> : "—"}</td>
                  <td className="text-xs">{c.oemName ?? "—"}</td>
                  <td className="text-xs">{c.lossReasonCode?.replace(/_/g, " ") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Quote lines" subtitle="Final price is set by a human — the recommendation is advisory only.">
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {l.description ?? l.partNumber}{" "}
                    <span className="font-mono text-xs muted">{l.partNumber}</span>
                  </p>
                  <p className="text-xs muted">
                    qty {l.quantity} · OEM {l.oemName ?? "—"} · cost {formatMoney(l.unitCost)} · recommended{" "}
                    {formatMoney(l.recommendedUnitPrice)} · margin cost→final {impliedMarginClient(l.finalUnitPrice, l.unitCost)}%
                  </p>
                </div>
                <Money minor={l.finalUnitPrice * l.quantity} />
              </div>
              {canEdit ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs link">Price this line</summary>
                  <form action={updateQuoteLineAction} className="mt-2 grid gap-2 sm:grid-cols-6">
                    <input type="hidden" name="quoteLineId" value={l.id} />
                    <input className="input" name="targetMarginPercent" type="number" min={0} max={99} step="0.1" defaultValue={l.targetMarginPercent ?? "15"} placeholder="Margin %" />
                    <input className="input" name="freightUnit" placeholder="Freight/unit" />
                    <input className="input" name="otherUnit" placeholder="Other/unit" />
                    <input className="input" name="finalUnitPrice" placeholder="Final unit price" />
                    <input className="input" name="leadTimeDays" type="number" min={0} placeholder="Lead days" />
                    <SubmitButton className="btn-secondary sm:col-span-6">Save line</SubmitButton>
                  </form>
                </details>
              ) : (
                <p className="mt-2 text-xs muted">Approved quotes are immutable — create a new version to change price.</p>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {quote.status === "approved" ? (
        <SectionCard title="Convert to order (PO)" subtitle="No orphan PO: this order maps to this approved quote.">
          {existingOrder ? (
            <p className="text-sm">
              Already converted:{" "}
              <Link className="link" href={`/orders/${existingOrder.id}`}>
                {existingOrder.orderNo}
              </Link>
            </p>
          ) : (
            <form action={createOrderFromQuoteAction} className="grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="quoteId" value={quote.id} />
              <input className="input" name="orderNo" placeholder="Order no (e.g. ORD-2026-004)" required />
              <input className="input" name="poNumber" placeholder="Customer PO number" required />
              <input className="input" name="poDate" type="date" />
              <input className="input" name="deliveryDeadline" type="date" />
              <select className="input sm:col-span-2" name="oemId" defaultValue="">
                <option value="">Primary OEM…</option>
                {oems.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input className="input" name="supplierPoNumber" placeholder="Supplier PO no" />
              <input className="input" name="supplierPoDate" type="date" />
              <input className="input sm:col-span-2" name="expectedCompletionDate" type="date" />
              <input className="input sm:col-span-2" name="complianceRequirements" placeholder="Compliance requirements" />
              <input className="input sm:col-span-2" name="inspectionRequirements" placeholder="Inspection requirements" />
              <input className="input sm:col-span-2" name="pdiRequirements" placeholder="PDI requirements" />
              <div className="sm:col-span-4">
                <SubmitButton className="btn-primary">Create order</SubmitButton>
              </div>
            </form>
          )}
        </SectionCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Versions">
          <ul className="space-y-2 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <Link className="link" href={`/quotes/${v.id}`}>
                  v{v.version} · {v.quoteNo}
                </Link>
                <StatusBadge status={v.status} label={QUOTE_STATUS_LABELS[v.status]} />
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Approvals">
          {approvals.length === 0 ? (
            <p className="text-sm muted">No approvals recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {approvals.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs">
                    requested {formatDate(a.requestedAt)}
                    {a.comment ? <span className="block muted">{a.comment}</span> : null}
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
