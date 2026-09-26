import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { createDocumentAction, recomputeDocumentStatusesAction } from "@/app/actions/documents";
import { DataState, EmptyRow, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DOCUMENT_SOURCE_LABELS, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/enums";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const db = await getDbAsync();
  const [docs, oems, requirements, orders] = await Promise.all([
    db
      .select({ document: t.documents, oemName: t.oems.name })
      .from(t.documents)
      .leftJoin(t.oems, eq(t.oems.id, t.documents.oemId))
      .orderBy(asc(t.documents.expiryDate)),
    db.select({ id: t.oems.id, name: t.oems.name }).from(t.oems).orderBy(asc(t.oems.name)),
    db.select({ id: t.requirements.id, ref: t.requirements.ref }).from(t.requirements).orderBy(desc(t.requirements.createdAt)),
    db.select({ id: t.orders.id, orderNo: t.orders.orderNo }).from(t.orders).orderBy(desc(t.orders.createdAt)),
  ]);

  const now = new Date();
  const bySource = new Map<string, { count: number; totalDays: number; withDays: number }>();
  for (const d of docs) {
    const agg = bySource.get(d.document.source) ?? { count: 0, totalDays: 0, withDays: 0 };
    agg.count += 1;
    if (d.document.processingDays !== null) {
      agg.totalDays += d.document.processingDays;
      agg.withDays += 1;
    }
    bySource.set(d.document.source, agg);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Documents & compliance vault</h1>
          <p className="text-sm muted">
            Type, supplier, issue/expiry, linked product and requirement. Expiry is trackable.
          </p>
        </div>
        <form action={recomputeDocumentStatusesAction}>
          <SubmitButton className="btn-secondary">Recompute expiry statuses</SubmitButton>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...bySource.entries()].map(([source, agg]) => (
          <div key={source} className="card card-pad">
            <p className="text-xs muted">{DOCUMENT_SOURCE_LABELS[source] ?? source}</p>
            <p className="text-lg font-semibold">{agg.count}</p>
            <p className="text-xs muted">
              avg {agg.withDays ? Math.round((agg.totalDays / agg.withDays) * 10) / 10 : 0} days to produce
            </p>
          </div>
        ))}
      </div>

      <DataState status={docs.length === 0 ? "empty" : "ok"} emptyTitle="No documents" emptyHint="Add compliance certificates, AILs, test reports and POs.">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Source</th>
                <th>Supplier / requirement</th>
                <th>Issue</th>
                <th>Expiry</th>
                <th>Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <EmptyRow colSpan={8} message="No documents." />
              ) : (
                docs.map(({ document: d, oemName }) => {
                  const days = d.expiryDate
                    ? Math.round((new Date(d.expiryDate).getTime() - now.getTime()) / 86_400_000)
                    : null;
                  return (
                    <tr key={d.id}>
                      <td>
                        {d.title}
                        {d.productName ? <span className="block text-xs muted">{d.productName}</span> : null}
                      </td>
                      <td className="text-xs">{DOCUMENT_TYPE_LABELS[d.docType]}</td>
                      <td className="text-xs">{DOCUMENT_SOURCE_LABELS[d.source]}</td>
                      <td className="text-xs">
                        {oemName ?? "—"}
                        {d.requirementId ? (
                          <Link className="link ml-1" href={`/requirements/${d.requirementId}`}>
                            req
                          </Link>
                        ) : null}
                        {d.orderId ? (
                          <Link className="link ml-1" href={`/orders/${d.orderId}`}>
                            order
                          </Link>
                        ) : null}
                      </td>
                      <td>{formatDate(d.issueDate)}</td>
                      <td>{formatDate(d.expiryDate)}</td>
                      <td className={`tabular-nums ${days !== null && days < 0 ? "text-red-700" : ""}`}>
                        {days === null ? "—" : days}
                      </td>
                      <td>
                        <StatusBadge status={d.status} label={DOCUMENT_STATUS_LABELS[d.status]} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DataState>

      <section className="card card-pad">
        <h2 className="card-title mb-3">Add a document</h2>
        <form action={createDocumentAction} className="grid gap-2 sm:grid-cols-4">
          <input className="input sm:col-span-2" name="title" placeholder="Title" required />
          <select className="input sm:col-span-2" name="docType" defaultValue="compliance_certificate">
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="input sm:col-span-2" name="source" defaultValue="obtained_from_oem">
            {Object.entries(DOCUMENT_SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input className="input sm:col-span-2" name="referenceNo" placeholder="Reference no" />
          <select className="input" name="oemId" defaultValue="">
            <option value="">Supplier…</option>
            {oems.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select className="input" name="requirementId" defaultValue="">
            <option value="">Requirement…</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ref}
              </option>
            ))}
          </select>
          <select className="input" name="orderId" defaultValue="">
            <option value="">Order…</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNo}
              </option>
            ))}
          </select>
          <input className="input" name="productName" placeholder="Linked product" />
          <input className="input" name="issueDate" type="date" />
          <input className="input" name="expiryDate" type="date" />
          <input className="input" name="renewAfterMonths" type="number" min={0} placeholder="Renew after months" />
          <input className="input" name="processingDays" type="number" min={0} placeholder="Days to produce" />
          <input className="input sm:col-span-2" name="fileUrl" placeholder="File URL" />
          <input className="input sm:col-span-2" name="notes" placeholder="Notes" />
          <div className="sm:col-span-4">
            <SubmitButton className="btn-primary">Add document</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
