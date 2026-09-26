"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";
import { toMinor } from "@/lib/format";

async function nextOemCode(): Promise<string> {
  const db = await getDbAsync();
  const rows = await db.select({ code: t.oems.code }).from(t.oems);
  const max = rows.reduce((acc, r) => {
    const n = Number(r.code.split("-").pop());
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `OEM-${String(max + 1).padStart(3, "0")}`;
}

export async function createOemAction(formData: FormData): Promise<void> {
  const user = await requirePermission("oems:write");
  const db = await getDbAsync();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/oems/new?error=name");
  const code = String(formData.get("code") ?? "").trim() || (await nextOemCode());

  const oemId = await db.transaction(async (tx) => {
    const [oem] = await tx
      .insert(t.oems)
      .values({
        name,
        code,
        status: "pending",
        approved: false,
        productsSupplied: String(formData.get("productsSupplied") ?? "") || null,
        capabilities: String(formData.get("capabilities") ?? "") || null,
        categories: String(formData.get("categories") ?? "") || null,
        typicalLeadTimeDays: formData.get("typicalLeadTimeDays")
          ? Number(formData.get("typicalLeadTimeDays"))
          : null,
        priceListNotes: String(formData.get("priceListNotes") ?? "") || null,
        pastPerformance: String(formData.get("pastPerformance") ?? "") || null,
        address: String(formData.get("address") ?? "") || null,
      })
      .returning({ id: t.oems.id });
    await writeAudit(tx, {
      entityType: "oem",
      entityId: oem.id,
      action: "oem.created",
      actor: { userId: user.id, role: user.role },
      after: { name, code },
    });
    return oem.id;
  });

  revalidatePath("/oems");
  redirect(`/oems/${oemId}`);
}

export async function updateOemStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("oems:write");
  const db = await getDbAsync();
  const oemId = Number(formData.get("oemId"));
  const status = String(formData.get("status"));
  const approved = status === "approved";
  const [current] = await db.select().from(t.oems).where(eq(t.oems.id, oemId)).limit(1);
  if (!current) throw new Error("OEM not found.");
  await db.transaction(async (tx) => {
    await tx
      .update(t.oems)
      .set({ status: status as any, approved, updatedAt: new Date() })
      .where(eq(t.oems.id, oemId));
    await writeAudit(tx, {
      entityType: "oem",
      entityId: oemId,
      action: "oem.status_changed",
      actor: { userId: user.id, role: user.role },
      before: { status: current.status, approved: current.approved },
      after: { status, approved },
    });
  });
  revalidatePath(`/oems/${oemId}`);
  revalidatePath("/oems");
}

export async function addOemContactAction(formData: FormData): Promise<void> {
  const user = await requirePermission("oems:write");
  const db = await getDbAsync();
  const oemId = Number(formData.get("oemId"));
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.oemContacts)
      .values({
        oemId,
        name: String(formData.get("name") ?? "").trim(),
        roleTitle: String(formData.get("roleTitle") ?? "") || null,
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
      })
      .returning({ id: t.oemContacts.id });
    await writeAudit(tx, {
      entityType: "oem_contact",
      entityId: row.id,
      action: "oem.contact_added",
      actor: { userId: user.id, role: user.role },
      after: { oemId },
    });
  });
  revalidatePath(`/oems/${oemId}`);
}

export async function addOemProductAction(formData: FormData): Promise<void> {
  const user = await requirePermission("oems:write");
  const db = await getDbAsync();
  const oemId = Number(formData.get("oemId"));
  const priceText = String(formData.get("unitPrice") ?? "");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.oemProducts)
      .values({
        oemId,
        productName: String(formData.get("productName") ?? "").trim(),
        partNumber: String(formData.get("partNumber") ?? "") || null,
        category: String(formData.get("category") ?? "") || null,
        unitPrice: priceText ? toMinor(priceText) : null,
        leadTimeDays: formData.get("leadTimeDays") ? Number(formData.get("leadTimeDays")) : null,
        capacityPerMonth: formData.get("capacityPerMonth")
          ? Number(formData.get("capacityPerMonth"))
          : null,
        notes: String(formData.get("notes") ?? "") || null,
      })
      .returning({ id: t.oemProducts.id });
    await writeAudit(tx, {
      entityType: "oem_product",
      entityId: row.id,
      action: "oem.product_added",
      actor: { userId: user.id, role: user.role },
      after: { oemId, productName: String(formData.get("productName") ?? "") },
    });
  });
  revalidatePath(`/oems/${oemId}`);
}

export async function addOemDocumentAction(formData: FormData): Promise<void> {
  const user = await requirePermission("documents:write");
  const db = await getDbAsync();
  const oemId = Number(formData.get("oemId"));
  const expiry = String(formData.get("expiryDate") ?? "");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.documents)
      .values({
        title: String(formData.get("title") ?? "").trim(),
        docType: (String(formData.get("docType") ?? "compliance_certificate") as any),
        source: "obtained_from_oem",
        status: expiry ? "valid" : "pending",
        oemId,
        productName: String(formData.get("productName") ?? "") || null,
        referenceNo: String(formData.get("referenceNo") ?? "") || null,
        issueDate: String(formData.get("issueDate") ?? "") || null,
        expiryDate: expiry || null,
        renewAfterMonths: formData.get("renewAfterMonths")
          ? Number(formData.get("renewAfterMonths"))
          : null,
        fileUrl: String(formData.get("fileUrl") ?? "") || null,
        processingDays: formData.get("processingDays") ? Number(formData.get("processingDays")) : null,
        uploadedBy: user.id,
      })
      .returning({ id: t.documents.id });
    await writeAudit(tx, {
      entityType: "document",
      entityId: row.id,
      action: "document.created",
      actor: { userId: user.id, role: user.role },
      after: { oemId, title: String(formData.get("title") ?? "") },
    });
    return row.id;
  });
  revalidatePath(`/oems/${oemId}`);
  revalidatePath("/documents");
}
