import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequirementDetail } from "@/server/requirements";
import { getOemAvailability, listApprovedOemsForSourcing } from "@/server/oems";
import {
  addLineItemAction,
  deleteLineItemAction,
  recordLossAction,
  updateRequirementAction,
  updateRequirementStatusAction,
} from "@/app/actions/requirements";
import {
  createOemRequestAction,
  recordOemResponseAction,
  requestCoverageOverrideAction,
} from "@/app/actions/sourcing";
import { createQuoteAction, recordGovernmentResponseAction } from "@/app/actions/quotes";
import { CoverageBar, Money, SectionCard, StatusBadge } from "@/components/ui";
import { Timeline, type TimelineEvent } from "@/components/Timeline";
import { SubmitButton } from "@/components/SubmitButton";
import {
  DOCUMENT_TYPE_LABELS,
  GOVERNMENT_RESPONSE_LABELS,
  LOSS_REASON_LABELS,
  OEM_RESPONSE_TYPE_LABELS,
  PRIORITY_LABELS,
  QUOTE_STATUS_LABELS,
  REQUIREMENT_STATUS_LABELS,
  SOURCING_STATUS_LABELS,
} from "@/lib/enums";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getRequirementDetail(Number(id));
  if (!detail) notFound();
  const oems = await listApprovedOemsForSourcing();
  const availability = await getOemAvailability();
  const partNumbers = new Set(detail.lines.map((l) => l.partNumber));
  const relevantAvailability = availability.filter(
    (a) => a.partNumber && partNumbers.has(a.partNumber),
  );

  const req = detail.requirement;
  const cov = detail.coverage;

  const timeline: TimelineEvent[] = [
    ...detail.statusEvents.map((e) => ({
      at: e.createdAt,
      title: `Status ${e.toStatus.replace(/_/g, " ")}`,
      detail: e.note,
      status: e.toStatus,
      group: "Requirement",
    })),
    ...detail.sourcing.flatMap((s) =>
      s.responses.map((r) => ({
        at: r.responseDate ?? new Date().toISOString(),
        title: `${s.oemName} responded (${OEM_RESPONSE_TYPE_LABELS[r.responseType]})`,
        detail:
          r.responseType === "firm_commitment"
            ? `Firm ${formatQty(r.firmQuantity)} units${r.unitPrice ? ` @ ${formatMoney(r.unitPrice)}` : ""}`
            : `Indication ${formatQty(r.availableQuantity ?? 0)} units (not counted toward coverage)`,
        group: `Sourcing · ${s.partNumber}`,
      })),
    ),
    ...detail.quotes.map((q) => ({
      at: q.approvedAt ?? q.submittedAt ?? q.createdAt,
      title: `Quote ${q.quoteNo} v${q.version} ${q.status.replace(/_/g, " ")}`,
      detail: `Total ${formatMoney(q.totalFinalPrice)}`,
      status: q.status,
      group: "Quote",
    })),
    ...detail.governmentResponses.map((g) => ({
      at: g.createdAt,
      title: `Government response: ${GOVERNMENT_RESPONSE_LABELS[g.status]}`,
      detail: g.notes,
      status: g.status,
      group: "Response",
    })),
    ...detail.audits.map((a) => ({
      at: a.createdAt,
      title: a.action,
      detail: a.reason,
      group: "Audit",
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{req.title}</h1>
            <StatusBadge status={req.status} label={REQUIREMENT_STATUS_LABELS[req.status]} />
          </div>
          <p className="text-sm muted">
            {req.ref} · {detail.customerName ?? "No customer"} · {PRIORITY_LABELS[req.priority]} priority ·
            owner {detail.ownerName ?? "—"}
          </p>
        </div>
        <Link className="btn-secondary" href="/requirements">
          Back to list
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Lifecycle quantity balance" subtitle="Requested → committed, with uncovered balance always visible">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs muted">Requested</p>
                <p className="text-lg font-semibold tabular-nums">{formatQty(cov.totalRequired)}</p>
              </div>
              <div>
                <p className="text-xs muted">Firm committed</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-700">{formatQty(cov.totalCommitted)}</p>
              </div>
              <div>
                <p className="text-xs muted">Uncovered</p>
                <p className={`text-lg font-semibold tabular-nums ${cov.totalUncovered > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {formatQty(cov.totalUncovered)}
                </p>
              </div>
              <div>
                <p className="text-xs muted">Coverage</p>
                <p className="text-lg font-semibold tabular-nums">{cov.coveragePercent}%</p>
              </div>
            </div>
            <div className="mt-3">
              <CoverageBar required={cov.totalRequired} committed={cov.totalCommitted} />
            </div>
            {!cov.fullyCovered ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Cannot commit to a quantity the OEMs have not covered.</p>
                <p className="mt-1">
                  {cov.uncoveredLines} line(s) uncovered ({formatQty(cov.totalUncovered)} units). Secure firm
                  commitments, or record an owner override to proceed.
                </p>
                <form action={requestCoverageOverrideAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="requirementId" value={req.id} />
                  <input
                    className="input flex-1 min-w-[220px]"
                    name="reason"
                    placeholder="Reason for override (required, audited)"
                    required
                  />
                  <SubmitButton className="btn-secondary">Request override</SubmitButton>
                </form>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-700">Fully covered by firm OEM commitments.</p>
            )}
          </SectionCard>

          <SectionCard
            title={`Line items (${detail.lines.length}/500)`}
            subtitle="Many part numbers per requirement — never one giant text field"
          >
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Part number</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Target</th>
                    <th>Coverage</th>
                    <th>Committed by</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cov.lines.map((line) => {
                    const item = detail.lines.find((l) => l.id === line.lineItemId);
                    return (
                      <tr key={line.lineItemId}>
                        <td>{item?.lineNo}</td>
                        <td className="font-mono text-xs">{line.partNumber}</td>
                        <td>{item?.description ?? "—"}</td>
                        <td className="tabular-nums">{formatQty(line.required)}</td>
                        <td>
                          {item?.targetUnitPrice ? <Money minor={item.targetUnitPrice} /> : "—"}
                        </td>
                        <td>
                          <CoverageBar required={line.required} committed={line.committed} compact />
                          {line.hasIndicationOnly ? (
                            <p className="mt-1 text-xs text-amber-700">
                              Indication only ({formatQty(line.availabilityTotal)}) — not a commitment
                            </p>
                          ) : null}
                        </td>
                        <td className="text-xs">
                          {line.byOem.length === 0 ? (
                            <span className="muted">None</span>
                          ) : (
                            line.byOem.map((o) => (
                              <div key={o.oemId}>
                                {o.oemName}: <span className="tabular-nums">{formatQty(o.committed)}</span>
                              </div>
                            ))
                          )}
                        </td>
                        <td>
                          <form action={deleteLineItemAction}>
                            <input type="hidden" name="requirementId" value={req.id} />
                            <input type="hidden" name="lineItemId" value={line.lineItemId} />
                            <button className="text-xs text-red-600 hover:underline" type="submit">
                              remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <form action={addLineItemAction} className="mt-4 grid gap-2 sm:grid-cols-5">
              <input type="hidden" name="requirementId" value={req.id} />
              <input className="input" name="partNumber" placeholder="Part number" required />
              <input className="input sm:col-span-2" name="description" placeholder="Description" />
              <input className="input" name="quantity" type="number" min={0} placeholder="Qty" required />
              <input className="input" name="targetUnitPrice" placeholder="Target unit price" />
              <div className="sm:col-span-5">
                <SubmitButton className="btn-secondary">Add line item</SubmitButton>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Sourcing — OEM requests & responses"
            subtitle="Shortlist OEMs, record each request and response. Firm commitment ≠ availability indication."
          >
            {detail.sourcing.length === 0 ? (
              <p className="text-sm muted">No OEM requests yet. Create one below.</p>
            ) : (
              <div className="space-y-3">
                {detail.sourcing.map((s) => (
                  <div key={s.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {s.oemName} · <span className="font-mono text-xs">{s.partNumber}</span>
                        </p>
                        <p className="text-xs muted">
                          Requested {formatQty(s.requestedQuantity)} · sent {formatDate(s.sentAt)} via {s.method}
                          {s.dueBy ? ` · due ${formatDate(s.dueBy)}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={s.status} label={SOURCING_STATUS_LABELS[s.status]} />
                    </div>
                    {s.responses.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {s.responses.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={r.responseType} label={OEM_RESPONSE_TYPE_LABELS[r.responseType]} />
                            {r.responseType === "firm_commitment" ? (
                              <span>
                                Firm <strong>{formatQty(r.firmQuantity)}</strong>
                              </span>
                            ) : (
                              <span className="muted">Indication {formatQty(r.availableQuantity ?? 0)} (excluded)</span>
                            )}
                            {r.unitPrice ? <span>@ {formatMoney(r.unitPrice)}</span> : null}
                            {r.leadTimeDays ? <span className="muted">{r.leadTimeDays}d</span> : null}
                            <span className="muted">{r.responseDate}</span>
                            {r.notes ? <span className="muted">— {r.notes}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs muted">Awaiting response.</p>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs link">Record response</summary>
                      <form action={recordOemResponseAction} className="mt-2 grid gap-2 sm:grid-cols-6">
                        <input type="hidden" name="oemRequestId" value={s.id} />
                        <input type="hidden" name="requirementId" value={req.id} />
                        <input type="hidden" name="requirementLineItemId" value={s.lineItemId} />
                        <input type="hidden" name="oemId" value={s.oemId} />
                        <select className="input sm:col-span-2" name="responseType" defaultValue="firm_commitment">
                          {Object.entries(OEM_RESPONSE_TYPE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <input className="input" name="firmQuantity" type="number" min={0} placeholder="Firm qty" />
                        <input className="input" name="availableQuantity" type="number" min={0} placeholder="Avail qty" />
                        <input className="input" name="unitPrice" placeholder="Unit price" />
                        <input className="input" name="leadTimeDays" type="number" min={0} placeholder="Lead days" />
                        <input className="input sm:col-span-4" name="notes" placeholder="Notes" />
                        <SubmitButton className="btn-secondary sm:col-span-2">Save response</SubmitButton>
                      </form>
                    </details>
                  </div>
                ))}
              </div>
            )}

            <form action={createOemRequestAction} className="mt-4 grid gap-2 sm:grid-cols-6">
              <input type="hidden" name="requirementId" value={req.id} />
              <select className="input sm:col-span-2" name="requirementLineItemId" required defaultValue="">
                <option value="">Line item…</option>
                {detail.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.partNumber} ({l.quantity})
                  </option>
                ))}
              </select>
              <select className="input sm:col-span-2" name="oemId" required defaultValue="">
                <option value="">OEM…</option>
                {oems.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.approved ? "✓" : "(not approved)"}
                  </option>
                ))}
              </select>
              <input className="input" name="requestedQuantity" type="number" min={0} placeholder="Req qty" required />
              <input className="input" name="dueBy" type="date" />
              <div className="sm:col-span-6">
                <SubmitButton className="btn-secondary">Send OEM request</SubmitButton>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Global OEM availability (this part)"
            subtitle="Capacity netted against firm commitments elsewhere — decides if capacity is global or per order"
          >
            {relevantAvailability.length === 0 ? (
              <p className="text-sm muted">No OEM products registered for these part numbers yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>OEM</th>
                    <th>Product</th>
                    <th>Capacity/mo</th>
                    <th>Committed elsewhere</th>
                    <th>Available to commit</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantAvailability.map((a) => (
                    <tr key={`${a.oemId}-${a.productId}`}>
                      <td>{a.oemName}</td>
                      <td>
                        {a.productName} <span className="font-mono text-xs muted">{a.partNumber}</span>
                      </td>
                      <td className="tabular-nums">{a.capacityUnknown ? "unknown" : formatQty(a.capacity)}</td>
                      <td className="tabular-nums">{formatQty(a.committedElsewhere)}</td>
                      <td className={`tabular-nums font-medium ${a.overCommitted ? "text-red-700" : ""}`}>
                        {a.capacityUnknown ? "unknown" : formatQty(a.availableToCommit ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard
            title="Quotes & bid intelligence"
            subtitle="Every quotation comes from this RFI. Comparable past bids guide the price."
            action={
              <form action={createQuoteAction} className="flex items-end gap-2">
                <input type="hidden" name="requirementId" value={req.id} />
                <div>
                  <label className="label" htmlFor="targetMarginPercent">
                    Target margin %
                  </label>
                  <input
                    className="input w-24"
                    id="targetMarginPercent"
                    name="targetMarginPercent"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={15}
                  />
                </div>
                <SubmitButton className="btn-primary">Build quote</SubmitButton>
              </form>
            }
          >
            {detail.quotes.length === 0 ? (
              <p className="text-sm muted">No quotes yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Recommended</th>
                    <th>Final</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detail.quotes.map((q) => (
                    <tr key={q.id}>
                      <td className="font-mono text-xs">{q.quoteNo}</td>
                      <td>v{q.version}</td>
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
                      <td>
                        <Link className="link text-xs" href={`/quotes/${q.id}`}>
                          open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard title="Government response & follow-up states">
            <form action={recordGovernmentResponseAction} className="grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="requirementId" value={req.id} />
              <select className="input" name="quoteId" defaultValue="">
                <option value="">Quote (optional)…</option>
                {detail.quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNo} v{q.version}
                  </option>
                ))}
              </select>
              <select className="input" name="status" defaultValue="clarification_requested">
                {Object.entries(GOVERNMENT_RESPONSE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input className="input" name="responseDate" type="date" />
              <input className="input" name="notes" placeholder="Notes" />
              <div className="sm:col-span-4">
                <SubmitButton className="btn-secondary">Record response</SubmitButton>
              </div>
            </form>
            {detail.governmentResponses.length > 0 ? (
              <table className="table mt-4">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.governmentResponses.map((g) => (
                    <tr key={g.id}>
                      <td>{formatDate(g.responseDate)}</td>
                      <td>
                        <StatusBadge status={g.status} label={GOVERNMENT_RESPONSE_LABELS[g.status]} />
                      </td>
                      <td>{g.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </SectionCard>

          <SectionCard title="Loss reason" subtitle="Structured — powers win/loss analysis">
            <form action={recordLossAction} className="grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="requirementId" value={req.id} />
              <select className="input" name="lossReasonCode" defaultValue={req.lossReasonCode ?? "price"}>
                {Object.entries(LOSS_REASON_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input className="input" name="lossCompetitor" placeholder="Competitor (optional)" defaultValue={req.lossCompetitor ?? ""} />
              <input className="input" name="lossQuotedPrice" placeholder="Our quoted price" />
              <input className="input" name="lossWinningPrice" placeholder="Winning price" />
              <input className="input sm:col-span-4" name="lossReasonNotes" placeholder="Notes" defaultValue={req.lossReasonNotes ?? ""} />
              <div className="sm:col-span-4">
                <SubmitButton className="btn-danger">Mark lost with reason</SubmitButton>
              </div>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Status" >
            <form action={updateRequirementStatusAction} className="space-y-2">
              <input type="hidden" name="requirementId" value={req.id} />
              <select className="input" name="status" defaultValue={req.status}>
                {Object.entries(REQUIREMENT_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input className="input" name="note" placeholder="Note (audited)" />
              <SubmitButton className="btn-primary w-full">Update status</SubmitButton>
            </form>
            <p className="mt-2 text-xs muted">
              Received → qualifying → quoted → submitted → won / lost / cancelled
            </p>
          </SectionCard>

          <SectionCard title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="muted">Reference</dt>
                <dd className="font-mono text-xs">{req.ref}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted">Customer</dt>
                <dd>{detail.customerName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted">Tender ref</dt>
                <dd>{req.tenderRef ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted">Enquiry ref</dt>
                <dd>{req.enquiryRef ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted">Required delivery</dt>
                <dd>{formatDate(req.requiredDeliveryDate)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted">Submission deadline</dt>
                <dd>{formatDateTime(req.submissionDeadline)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="muted">Received</dt>
                <dd>{formatDateTime(req.receivedAt)}</dd>
              </div>
            </dl>
            {req.technicalSpecs ? (
              <p className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{req.technicalSpecs}</p>
            ) : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs link">Edit summary</summary>
              <form action={updateRequirementAction} className="mt-2 space-y-2">
                <input type="hidden" name="requirementId" value={req.id} />
                <input className="input" name="title" defaultValue={req.title} />
                <input className="input" name="productSummary" defaultValue={req.productSummary ?? ""} placeholder="Product summary" />
                <input className="input" name="requiredDeliveryDate" type="date" defaultValue={req.requiredDeliveryDate ?? ""} />
                <select className="input" name="priority" defaultValue={req.priority}>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn-secondary w-full">Save</SubmitButton>
              </form>
            </details>
          </SectionCard>

          <SectionCard title="Orders">
            {detail.orders.length === 0 ? (
              <p className="text-sm muted">No order yet. Approve a quote to create a PO.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between">
                    <Link className="link" href={`/orders/${o.id}`}>
                      {o.orderNo}
                    </Link>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Documents">
            {detail.documents.length === 0 ? (
              <p className="text-sm muted">No documents linked.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span>
                      {d.title}
                      <span className="block text-xs muted">
                        {DOCUMENT_TYPE_LABELS[d.docType]} · exp {formatDate(d.expiryDate)}
                      </span>
                    </span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Approvals">
            {detail.approvals.length === 0 ? (
              <p className="text-sm muted">No approvals yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.approvals.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs">
                      {a.entityType} #{a.entityId}
                      {a.comment ? <span className="block muted">{a.comment}</span> : null}
                    </span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Follow-up tasks">
            {detail.followUps.length === 0 ? (
              <p className="text-sm muted">No open tasks.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.followUps.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs">
                      {f.title}
                      <span className="block muted">due {formatDate(f.dueDate)}</span>
                    </span>
                    <StatusBadge status={f.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Timeline" subtitle="One requirement, one timeline">
            <Timeline events={timeline} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
