import Link from "next/link";
import { createOemAction } from "@/app/actions/oems";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default function NewOemPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New OEM</h1>
        <p className="text-sm muted">No OEM is auto-approved — approval is a human decision, audited.</p>
      </div>
      <form action={createOemAction} className="card card-pad grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            Name *
          </label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="code">
            Code
          </label>
          <input className="input" id="code" name="code" placeholder="auto" />
        </div>
        <div>
          <label className="label" htmlFor="typicalLeadTimeDays">
            Typical lead time (days)
          </label>
          <input className="input" id="typicalLeadTimeDays" name="typicalLeadTimeDays" type="number" min={0} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="productsSupplied">
            Products supplied
          </label>
          <input className="input" id="productsSupplied" name="productsSupplied" />
        </div>
        <div>
          <label className="label" htmlFor="categories">
            Categories (comma separated)
          </label>
          <input className="input" id="categories" name="categories" placeholder="optics,electronics" />
        </div>
        <div>
          <label className="label" htmlFor="capabilities">
            Capabilities
          </label>
          <input className="input" id="capabilities" name="capabilities" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="priceListNotes">
            Price list notes
          </label>
          <input className="input" id="priceListNotes" name="priceListNotes" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pastPerformance">
            Past performance
          </label>
          <textarea className="input" id="pastPerformance" name="pastPerformance" rows={2} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="address">
            Address
          </label>
          <input className="input" id="address" name="address" />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Link className="btn-secondary" href="/oems">
            Cancel
          </Link>
          <SubmitButton>Create OEM</SubmitButton>
        </div>
      </form>
    </div>
  );
}
