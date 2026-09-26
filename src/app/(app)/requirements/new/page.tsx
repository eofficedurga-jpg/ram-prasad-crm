import Link from "next/link";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { asc } from "drizzle-orm";
import { createRequirementAction } from "@/app/actions/requirements";
import { SubmitButton } from "@/components/SubmitButton";
import { PRIORITY_LABELS } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function NewRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await getDbAsync();
  const customers = await db
    .select({ id: t.customers.id, name: t.customers.name })
    .from(t.customers)
    .orderBy(asc(t.customers.name));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Capture a requirement</h1>
        <p className="text-sm muted">
          One requirement carries many line items (up to 500 part numbers). Every quotation and PO
          will link back to this record.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "lines" ? "Add at least one line item." : decodeURIComponent(error)}
        </p>
      ) : null}

      <form action={createRequirementAction} className="card card-pad space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              Title *
            </label>
            <input className="input" id="title" name="title" required />
          </div>
          <div>
            <label className="label" htmlFor="customerId">
              Customer / agency
            </label>
            <select className="input" id="customerId" name="customerId" defaultValue="">
              <option value="">— none —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="priority">
              Priority
            </label>
            <select className="input" id="priority" name="priority" defaultValue="normal">
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="productSummary">
              Product summary
            </label>
            <input className="input" id="productSummary" name="productSummary" />
          </div>
          <div>
            <label className="label" htmlFor="requiredDeliveryDate">
              Required delivery date
            </label>
            <input className="input" id="requiredDeliveryDate" name="requiredDeliveryDate" type="date" />
          </div>
          <div>
            <label className="label" htmlFor="submissionDeadline">
              Submission deadline
            </label>
            <input className="input" id="submissionDeadline" name="submissionDeadline" type="datetime-local" />
          </div>
          <div>
            <label className="label" htmlFor="tenderRef">
              Tender reference
            </label>
            <input className="input" id="tenderRef" name="tenderRef" />
          </div>
          <div>
            <label className="label" htmlFor="enquiryRef">
              Enquiry reference
            </label>
            <input className="input" id="enquiryRef" name="enquiryRef" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="technicalSpecs">
              Technical specifications
            </label>
            <textarea className="input" id="technicalSpecs" name="technicalSpecs" rows={3} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="lines">
              Line items * — one per line: <code>partNumber, description, quantity, targetUnitPrice(optional)</code>
            </label>
            <textarea
              className="input font-mono text-xs"
              id="lines"
              name="lines"
              rows={6}
              placeholder={"STH-2200, Sonar transducer housing, 120, 23500\nHAB-770, Mounting bracket, 300, 5400"}
              required
            />
            <p className="mt-1 text-xs muted">Maximum 500 lines. A giant free-text field is not used.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link className="btn-secondary" href="/requirements">
            Cancel
          </Link>
          <SubmitButton>Create requirement</SubmitButton>
        </div>
      </form>
    </div>
  );
}
