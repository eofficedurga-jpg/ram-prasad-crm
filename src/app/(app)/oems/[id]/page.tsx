import Link from "next/link";
import { notFound } from "next/navigation";
import { getOemDetail } from "@/server/oems";
import {
  addOemContactAction,
  addOemDocumentAction,
  addOemProductAction,
  updateOemStatusAction,
} from "@/app/actions/oems";
import { Money, SectionCard, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DOCUMENT_TYPE_LABELS, OEM_RESPONSE_TYPE_LABELS, OEM_STATUS_LABELS } from "@/lib/enums";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOemDetail(Number(id));
  if (!detail) notFound();
  const { oem } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{oem.name}</h1>
            <StatusBadge status={oem.status} label={OEM_STATUS_LABELS[oem.status]} />
          </div>
          <p className="text-sm muted">
            {oem.code} · {oem.categories ?? "no categories"} · typical lead {oem.typicalLeadTimeDays ?? "—"} days
          </p>
        </div>
        <Link className="btn-secondary" href="/oems">
          Back
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Profile">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="muted">Products supplied</dt>
                <dd>{oem.productsSupplied ?? "—"}</dd>
              </div>
              <div>
                <dt className="muted">Capabilities</dt>
                <dd>{oem.capabilities ?? "—"}</dd>
              </div>
              <div>
                <dt className="muted">Price list notes</dt>
                <dd>{oem.priceListNotes ?? "—"}</dd>
              </div>
              <div>
                <dt className="muted">Rating</dt>
                <dd>{oem.rating ? `${oem.rating}/5` : "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="muted">Past performance</dt>
                <dd>{oem.pastPerformance ?? "—"}</dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title={`Products & capacity (${detail.products.length})`}>
            {detail.products.length === 0 ? (
              <p className="text-sm muted">No products registered.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Part</th>
                    <th>Category</th>
                    <th>Unit price</th>
                    <th>Lead</th>
                    <th>Capacity/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.productName}</td>
                      <td className="font-mono text-xs">{p.partNumber ?? "—"}</td>
                      <td>{p.category ?? "—"}</td>
                      <td>{p.unitPrice ? <Money minor={p.unitPrice} currency={p.currency} /> : "—"}</td>
                      <td>{p.leadTimeDays ? `${p.leadTimeDays} d` : "—"}</td>
                      <td className="tabular-nums">{p.capacityPerMonth ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form action={addOemProductAction} className="mt-4 grid gap-2 sm:grid-cols-6">
              <input type="hidden" name="oemId" value={oem.id} />
              <input className="input sm:col-span-2" name="productName" placeholder="Product" required />
              <input className="input" name="partNumber" placeholder="Part no" />
              <input className="input" name="category" placeholder="Category" />
              <input className="input" name="unitPrice" placeholder="Unit price" />
              <input className="input" name="leadTimeDays" type="number" min={0} placeholder="Lead days" />
              <input className="input" name="capacityPerMonth" type="number" min={0} placeholder="Capacity/mo" />
              <div className="sm:col-span-6">
                <SubmitButton className="btn-secondary">Add product</SubmitButton>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Response history">
            {detail.responses.length === 0 ? (
              <p className="text-sm muted">No responses recorded yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Requirement</th>
                    <th>Type</th>
                    <th>Firm</th>
                    <th>Indicated</th>
                    <th>Price</th>
                    <th>Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.responses.map((r) => (
                    <tr key={r.id}>
                      <td>{r.responseDate}</td>
                      <td>
                        <Link className="link text-xs" href={`/requirements/${r.requirementId}`}>
                          {r.requirementRef}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={r.responseType} label={OEM_RESPONSE_TYPE_LABELS[r.responseType]} />
                      </td>
                      <td className="tabular-nums">{r.responseType === "firm_commitment" ? formatQty(r.firmQuantity) : "—"}</td>
                      <td className="tabular-nums">{r.availableQuantity !== null ? formatQty(r.availableQuantity) : "—"}</td>
                      <td>{r.unitPrice ? formatMoney(r.unitPrice) : "—"}</td>
                      <td>{r.leadTimeDays ? `${r.leadTimeDays} d` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard title="Compliance documents">
            {detail.documents.length === 0 ? (
              <p className="text-sm muted">No documents on file.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Issue</th>
                    <th>Expiry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.title}
                        <span className="block text-xs muted">{DOCUMENT_TYPE_LABELS[d.docType]}</span>
                      </td>
                      <td>{d.referenceNo ?? "—"}</td>
                      <td>{formatDate(d.issueDate)}</td>
                      <td>{formatDate(d.expiryDate)}</td>
                      <td>
                        <StatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs link">Add compliance document</summary>
              <form action={addOemDocumentAction} className="mt-2 grid gap-2 sm:grid-cols-6">
                <input type="hidden" name="oemId" value={oem.id} />
                <input className="input sm:col-span-3" name="title" placeholder="Title" required />
                <select className="input sm:col-span-2" name="docType" defaultValue="compliance_certificate">
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input className="input" name="referenceNo" placeholder="Ref no" />
                <input className="input" name="productName" placeholder="Linked product" />
                <input className="input" name="issueDate" type="date" />
                <input className="input" name="expiryDate" type="date" />
                <input className="input" name="renewAfterMonths" type="number" min={0} placeholder="Renew after (months)" />
                <input className="input" name="processingDays" type="number" min={0} placeholder="Days to produce" />
                <div className="sm:col-span-6">
                  <SubmitButton className="btn-secondary">Add document</SubmitButton>
                </div>
              </form>
            </details>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Approval">
            <form action={updateOemStatusAction} className="space-y-2">
              <input type="hidden" name="oemId" value={oem.id} />
              <select className="input" name="status" defaultValue={oem.status}>
                {Object.entries(OEM_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <SubmitButton className="btn-primary w-full">Update status</SubmitButton>
            </form>
            <p className="mt-2 text-xs muted">No OEM is chosen without human approval.</p>
          </SectionCard>

          <SectionCard title={`Contacts (${detail.contacts.length})`}>
            <ul className="space-y-2 text-sm">
              {detail.contacts.map((c) => (
                <li key={c.id}>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs muted">
                    {c.roleTitle ?? "—"} {c.email ? `· ${c.email}` : ""} {c.phone ? `· ${c.phone}` : ""}
                  </p>
                </li>
              ))}
              {detail.contacts.length === 0 ? <li className="muted">No contacts.</li> : null}
            </ul>
            <form action={addOemContactAction} className="mt-3 space-y-2">
              <input type="hidden" name="oemId" value={oem.id} />
              <input className="input" name="name" placeholder="Name" required />
              <input className="input" name="roleTitle" placeholder="Role" />
              <input className="input" name="email" placeholder="Email" />
              <input className="input" name="phone" placeholder="Phone" />
              <SubmitButton className="btn-secondary w-full">Add contact</SubmitButton>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
