"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/domain/audit";

export async function createDocumentAction(formData: FormData): Promise<void> {
  const user = await requirePermission("documents:write");
  const db = await getDbAsync();
  const expiry = String(formData.get("expiryDate") ?? "");
  const oemRaw = String(formData.get("oemId") ?? "");
  const reqRaw = String(formData.get("requirementId") ?? "");
  const orderRaw = String(formData.get("orderId") ?? "");
  const custRaw = String(formData.get("customerId") ?? "");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(t.documents)
      .values({
        title: String(formData.get("title") ?? "").trim(),
        docType: String(formData.get("docType") ?? "other") as any,
        source: String(formData.get("source") ?? "obtained_from_oem") as any,
        status: expiry ? "valid" : "pending",
        referenceNo: String(formData.get("referenceNo") ?? "") || null,
        oemId: oemRaw ? Number(oemRaw) : null,
        customerId: custRaw ? Number(custRaw) : null,
        requirementId: reqRaw ? Number(reqRaw) : null,
        orderId: orderRaw ? Number(orderRaw) : null,
        productName: String(formData.get("productName") ?? "") || null,
        issueDate: String(formData.get("issueDate") ?? "") || null,
        expiryDate: expiry || null,
        renewAfterMonths: formData.get("renewAfterMonths")
          ? Number(formData.get("renewAfterMonths"))
          : null,
        fileUrl: String(formData.get("fileUrl") ?? "") || null,
        processingDays: formData.get("processingDays")
          ? Number(formData.get("processingDays"))
          : null,
        notes: String(formData.get("notes") ?? "") || null,
        uploadedBy: user.id,
      })
      .returning({ id: t.documents.id });
    await writeAudit(tx, {
      entityType: "document",
      entityId: row.id,
      action: "document.created",
      actor: { userId: user.id, role: user.role },
      after: {
        title: String(formData.get("title") ?? ""),
        source: String(formData.get("source") ?? ""),
        expiryDate: expiry || null,
      },
    });
  });

  revalidatePath("/documents");
}

export async function recomputeDocumentStatusesAction(): Promise<void> {
  const user = await requirePermission("documents:write");
  const db = await getDbAsync();
  const docs = await db.select().from(t.documents);
  const now = new Date();
  let expired = 0;
  let expiring = 0;
  await db.transaction(async (tx) => {
    for (const d of docs) {
      if (!d.expiryDate) continue;
      const days = Math.round((new Date(d.expiryDate).getTime() - now.getTime()) / 86_400_000);
      const status = days < 0 ? "expired" : days <= 90 ? "expiring" : "valid";
      if (days < 0) expired += 1;
      else if (days <= 90) expiring += 1;
      if (status !== d.status) {
        await tx.update(t.documents).set({ status: status as any }).where(eq(t.documents.id, d.id));
      }
    }
    await writeAudit(tx, {
      entityType: "documents",
      entityId: 0,
      action: "documents.statuses_recomputed",
      actor: { userId: user.id, role: user.role },
      after: { expired, expiring, checked: docs.length },
    });
  });
  revalidatePath("/documents");
  revalidatePath("/dashboard");
}
