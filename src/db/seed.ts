import bcrypt from "bcryptjs";
import { getDbAsync } from "./client";
import * as t from "./schema";
import { buildFollowUpTasks } from "@/domain/followups";

const rs = (rupees: number) => Math.round(rupees * 100);

function at(offsetDays: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d;
}
const iso = (offsetDays: number) => at(offsetDays).toISOString().slice(0, 10);

async function main() {
  const db = await getDbAsync();

  const existing = await db.select({ id: t.users.id }).from(t.users).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded. Nothing to do.");
    return;
  }

  // Reference data ---------------------------------------------------------
  await db.insert(t.lossReasons).values([
    { code: "price", label: "Price", sort: 1 },
    { code: "technical_non_compliance", label: "Technical non-compliance", sort: 2 },
    { code: "delivery_timeline", label: "Delivery timeline", sort: 3 },
    { code: "competitor_preference", label: "Competitor preference", sort: 4 },
    { code: "quantity_capacity", label: "Quantity / capacity", sort: 5 },
    { code: "cancelled", label: "Cancelled", sort: 6 },
    { code: "not_pursued", label: "Not pursued", sort: 7 },
    { code: "other", label: "Other", sort: 8 },
  ]);

  // Users ------------------------------------------------------------------
  const pass = bcrypt.hashSync("password123", 10);
  const [ram, priya, arjun, meera] = await db
    .insert(t.users)
    .values([
      { email: "owner@ramprasad.in", name: "Ram Prasad", role: "owner", passwordHash: pass },
      { email: "sales@ramprasad.in", name: "Priya Menon", role: "sales", passwordHash: pass },
      { email: "ops@ramprasad.in", name: "Arjun Rao", role: "operations", passwordHash: pass },
      { email: "finance@ramprasad.in", name: "Meera Iyer", role: "finance", passwordHash: pass },
    ])
    .returning({ id: t.users.id });
  const owner = ram.id;
  const sales = priya.id;
  const opsId = arjun.id;
  const finance = meera.id;

  // Customers --------------------------------------------------------------
  const custRows = await db
    .insert(t.customers)
    .values([
      { name: "Ministry of Defence — Directorate of Supplies", segment: "government", agencyCode: "MoD-DoS", contactName: "Wing Cdr S. Nair", contactEmail: "procurement@mod-dos.gov.in", contactPhone: "+91 11 2301 0000" },
      { name: "Indian Navy — Naval Dockyard, Mumbai", segment: "defence", agencyCode: "IN-NW", contactName: "Cdr R. Deshmukh", contactEmail: "purchase@navaldockyard.in", contactPhone: "+91 22 2275 0000" },
      { name: "Indian Army — Central Ordnance Depot", segment: "defence", agencyCode: "IA-COD", contactName: "Lt Col V. Singh", contactEmail: "cod.purchase@army.in" },
      { name: "Bharat Electronics Ltd", segment: "psu", agencyCode: "BEL", contactName: "S. Krishnan", contactEmail: "vendor.dev@bel.co.in" },
      { name: "Hindustan Aeronautics Ltd", segment: "psu", agencyCode: "HAL", contactName: "A. Bhattacharya", contactEmail: "scm@hal.co.in" },
    ])
    .returning({ id: t.customers.id });
  const [mod, navy, army, bel, hal] = custRows;

  // OEMs -------------------------------------------------------------------
  const oemRows = await db
    .insert(t.oems)
    .values([
      { name: "Shakti Precision Engineering", code: "SPE-001", status: "approved", approved: true, productsSupplied: "Machined housings, transducer bodies, actuator brackets", capabilities: "5-axis CNC, AS9100D, NADCAP heat treat", categories: "machined components,structures", typicalLeadTimeDays: 45, priceListNotes: "Volume discount above 300 units.", pastPerformance: "Delivered 14 orders since 2021, zero rejections on last 3 PDIs.", rating: 5 },
      { name: "Bharat Forge Components", code: "BFC-002", status: "approved", approved: true, productsSupplied: "Forgings, hydraulic brackets, structural parts", capabilities: "Closed-die forging up to 2T, MIL-spec material", categories: "forgings,structures", typicalLeadTimeDays: 60, pastPerformance: "Reliable but slow on documentation.", rating: 4 },
      { name: "Deccan Optics Pvt Ltd", code: "DOP-003", status: "approved", approved: true, productsSupplied: "Optical assemblies, periscope optics, thermal lenses", capabilities: "Optical grinding, coating, MIL-C-48497", categories: "optics", typicalLeadTimeDays: 75, pastPerformance: "Preferred optics vendor.", rating: 5 },
      { name: "Kaveri Electronics", code: "KAV-004", status: "approved", approved: true, productsSupplied: "Encryption modules, SDR boards, battery packs", capabilities: "MIL-STD-461/810 qualified, JSS 55555", categories: "electronics,power", typicalLeadTimeDays: 50, pastPerformance: "Strong on radio modules.", rating: 4 },
      { name: "Nova Defence Systems", code: "NDS-005", status: "pending", approved: false, productsSupplied: "Composite canisters, launch tubes", capabilities: "Filament winding, autoclave", categories: "composites", typicalLeadTimeDays: 90, pastPerformance: "Awaiting facility audit.", rating: 3 },
      { name: "Trident Composites", code: "TRI-006", status: "not_approved", approved: false, productsSupplied: "Composite structures", capabilities: "Hand lay-up only", categories: "composites", typicalLeadTimeDays: 120, pastPerformance: "Failed a prior PDI on voids.", rating: 2 },
    ])
    .returning({ id: t.oems.id });
  const [spe, bfc, dop, kav, nds, tri] = oemRows;

  await db.insert(t.oemContacts).values([
    { oemId: spe.id, name: "Rajesh Kumar", roleTitle: "Sales Head", email: "rajesh@shaktiprecision.in", phone: "+91 98200 11111", isPrimary: true },
    { oemId: bfc.id, name: "Sunil Mehta", roleTitle: "Defence Accounts", email: "sunil@bharatforge.in", phone: "+91 98220 22222", isPrimary: true },
    { oemId: dop.id, name: "Dr. Ananya Rao", roleTitle: "Technical Director", email: "ananya@deccanoptics.in", isPrimary: true },
    { oemId: kav.id, name: "Vikram Shetty", roleTitle: "Programme Manager", email: "vikram@kaverielectronics.in", isPrimary: true },
  ]);

  const productRows = await db
    .insert(t.oemProducts)
    .values([
      { oemId: spe.id, productName: "Sonar transducer housing", partNumber: "STH-2200", category: "machined components", unitPrice: rs(18500), leadTimeDays: 45, capacityPerMonth: 400 },
      { oemId: spe.id, productName: "Hydraulic actuator bracket", partNumber: "HAB-770", category: "machined components", unitPrice: rs(4200), leadTimeDays: 30, capacityPerMonth: 1200 },
      { oemId: bfc.id, productName: "Hydraulic actuator bracket (forged)", partNumber: "HAB-770F", category: "forgings", unitPrice: rs(3900), leadTimeDays: 60, capacityPerMonth: 800 },
      { oemId: dop.id, productName: "Periscope optical assembly", partNumber: "POA-500", category: "optics", unitPrice: rs(96000), leadTimeDays: 75, capacityPerMonth: 60 },
      { oemId: dop.id, productName: "Thermal imaging lens", partNumber: "TIL-330", category: "optics", unitPrice: rs(27500), leadTimeDays: 60, capacityPerMonth: 150 },
      { oemId: kav.id, productName: "SDR encryption module", partNumber: "SEM-900", category: "electronics", unitPrice: rs(21000), leadTimeDays: 50, capacityPerMonth: 500 },
      { oemId: kav.id, productName: "NVG battery pack", partNumber: "NBP-100", category: "power", unitPrice: rs(3200), leadTimeDays: 40, capacityPerMonth: 2000 },
      { oemId: nds.id, productName: "Missile canister tube", partNumber: "MCT-1200", category: "composites", unitPrice: rs(145000), leadTimeDays: 90, capacityPerMonth: 20 },
    ])
    .returning({ id: t.oemProducts.id });

  // -----------------------------------------------------------------------
  // Requirements
  // -----------------------------------------------------------------------

  type LineSeed = { partNumber: string; description: string; quantity: number; targetUnitPrice?: number };
  async function createRequirement(input: {
    ref: string;
    title: string;
    customerId: number;
    summary: string;
    status: (typeof t.requirementStatus.enumValues)[number];
    priority: (typeof t.requirementPriority.enumValues)[number];
    receivedOffset: number;
    requiredDeliveryOffset: number;
    submissionOffset: number;
    tenderRef?: string;
    enquiryRef?: string;
    specs: string;
    ownerUserId: number;
    loss?: Partial<{ lossReasonCode: any; lossReasonNotes: string; lossCompetitor: string; lossQuotedPrice: number; lossWinningPrice: number }>;
    lines: LineSeed[];
  }) {
    const total = input.lines.reduce((s, l) => s + l.quantity, 0);
    const [req] = await db
      .insert(t.requirements)
      .values({
        ref: input.ref,
        title: input.title,
        customerId: input.customerId,
        productSummary: input.summary,
        quantityTotal: total,
        requiredDeliveryDate: iso(input.requiredDeliveryOffset),
        submissionDeadline: at(input.submissionOffset),
        tenderRef: input.tenderRef,
        enquiryRef: input.enquiryRef,
        technicalSpecs: input.specs,
        status: input.status,
        priority: input.priority,
        ownerUserId: input.ownerUserId,
        receivedAt: at(input.receivedOffset),
        lossReasonCode: input.loss?.lossReasonCode ?? null,
        lossReasonNotes: input.loss?.lossReasonNotes ?? null,
        lossCompetitor: input.loss?.lossCompetitor ?? null,
        lossQuotedPrice: input.loss?.lossQuotedPrice ?? null,
        lossWinningPrice: input.loss?.lossWinningPrice ?? null,
      })
      .returning({ id: t.requirements.id });

    const lineRows = await db
      .insert(t.requirementLineItems)
      .values(
        input.lines.map((l, i) => ({
          requirementId: req.id,
          lineNo: i + 1,
          partNumber: l.partNumber,
          description: l.description,
          quantity: l.quantity,
          unit: "nos",
          targetUnitPrice: l.targetUnitPrice ? rs(l.targetUnitPrice) : null,
          technicalSpecs: `${l.description}. Material and inspection per tender.`,
        })),
      )
      .returning({ id: t.requirementLineItems.id, partNumber: t.requirementLineItems.partNumber, quantity: t.requirementLineItems.quantity });

    await db.insert(t.requirementStatusEvents).values({
      requirementId: req.id,
      fromStatus: null,
      toStatus: input.status,
      note: "Seeded requirement",
      actorUserId: input.ownerUserId,
      createdAt: at(input.receivedOffset),
    });

    return { id: req.id, lines: lineRows };
  }

  const req1 = await createRequirement({
    ref: "REQ-2026-001",
    title: "Naval sonar transducer housings",
    customerId: navy.id,
    summary: "Housings and brackets for hull-mounted sonar",
    status: "submitted",
    priority: "high",
    receivedOffset: -40,
    requiredDeliveryOffset: 70,
    submissionOffset: -12,
    tenderRef: "NW/SONAR/2026/114",
    specs: "Aluminium bronze housings, pressure tested to 25 bar, AS9100D supplier only.",
    ownerUserId: sales,
    lines: [
      { partNumber: "STH-2200", description: "Sonar transducer housing", quantity: 120, targetUnitPrice: 23500 },
      { partNumber: "HAB-770", description: "Mounting bracket", quantity: 300, targetUnitPrice: 5400 },
    ],
  });

  const req2 = await createRequirement({
    ref: "REQ-2026-002",
    title: "Army SDR encryption modules",
    customerId: army.id,
    summary: "Software-defined radio encryption modules and battery packs",
    status: "quoted",
    priority: "urgent",
    receivedOffset: -25,
    requiredDeliveryOffset: 90,
    submissionOffset: 4,
    enquiryRef: "COD/SDR/2026/078",
    specs: "JSS 55555 qualified, 256-bit encryption, MIL-STD-810H.",
    ownerUserId: sales,
    lines: [
      { partNumber: "SEM-900", description: "SDR encryption module", quantity: 250, targetUnitPrice: 26500 },
      { partNumber: "NBP-100", description: "NVG battery pack", quantity: 600, targetUnitPrice: 4100 },
    ],
  });

  const req3 = await createRequirement({
    ref: "REQ-2026-003",
    title: "Aircraft hydraulic actuator brackets",
    customerId: hal.id,
    summary: "Forged and machined actuator brackets",
    status: "won",
    priority: "normal",
    receivedOffset: -85,
    requiredDeliveryOffset: 20,
    submissionOffset: -50,
    tenderRef: "HAL/AC/HYD/2025/331",
    specs: "Ti-6Al-4V forgings, machined to drawing HAL-HYD-9932.",
    ownerUserId: sales,
    lines: [
      { partNumber: "HAB-770", description: "Hydraulic actuator bracket", quantity: 900, targetUnitPrice: 5100 },
    ],
  });

  const req4 = await createRequirement({
    ref: "REQ-2026-004",
    title: "Radar waveguide assemblies",
    customerId: bel.id,
    summary: "Precision waveguide assemblies for ground radar",
    status: "lost",
    priority: "normal",
    receivedOffset: -120,
    requiredDeliveryOffset: -10,
    submissionOffset: -80,
    tenderRef: "BEL/RAD/WG/2025/220",
    specs: "WR-90 waveguide, silver plated, VSWR < 1.05.",
    ownerUserId: sales,
    loss: {
      lossReasonCode: "price",
      lossReasonNotes: "Quoted 22% above the winning bid; customer prioritised price over delivery.",
      lossCompetitor: "Precision Waveguides India",
      lossQuotedPrice: rs(1840000),
      lossWinningPrice: rs(1495000),
    },
    lines: [
      { partNumber: "WG-90-A", description: "Waveguide assembly", quantity: 200, targetUnitPrice: 9200 },
    ],
  });

  const req5 = await createRequirement({
    ref: "REQ-2026-005",
    title: "Thermal imaging sight components",
    customerId: army.id,
    summary: "Thermal lenses and sight housings",
    status: "lost",
    priority: "high",
    receivedOffset: -150,
    requiredDeliveryOffset: -20,
    submissionOffset: -110,
    enquiryRef: "COD/TIS/2025/664",
    specs: "LWIR lenses, MIL-C-48497 coatings, 8–12 µm band.",
    ownerUserId: sales,
    loss: {
      lossReasonCode: "competitor_preference",
      lossReasonNotes: "Incumbent supplier retained on a technical preference despite higher price.",
      lossCompetitor: "Opto Defence Systems",
      lossQuotedPrice: rs(9650000),
      lossWinningPrice: rs(10450000),
    },
    lines: [
      { partNumber: "TIL-330", description: "Thermal imaging lens", quantity: 150, targetUnitPrice: 62000 },
    ],
  });

  const req6 = await createRequirement({
    ref: "REQ-2026-006",
    title: "Missile canister composite tubes",
    customerId: mod.id,
    summary: "Filament-wound composite canister tubes",
    status: "qualifying",
    priority: "high",
    receivedOffset: -10,
    requiredDeliveryOffset: 140,
    submissionOffset: 18,
    tenderRef: "MoD/STR/2026/045",
    specs: "Filament wound composite, burst pressure 30 bar, NDT required.",
    ownerUserId: sales,
    lines: [
      { partNumber: "MCT-1200", description: "Missile canister tube", quantity: 60, targetUnitPrice: 178000 },
    ],
  });

  const req7 = await createRequirement({
    ref: "REQ-2026-007",
    title: "Night vision goggle battery packs",
    customerId: army.id,
    summary: "Rechargeable NVG battery packs",
    status: "received",
    priority: "normal",
    receivedOffset: -2,
    requiredDeliveryOffset: 60,
    submissionOffset: 12,
    enquiryRef: "COD/NVG/2026/091",
    specs: "Li-ion packs, MIL-STD-810H, 12 h runtime.",
    ownerUserId: sales,
    lines: [
      { partNumber: "NBP-100", description: "NVG battery pack", quantity: 1000, targetUnitPrice: 3900 },
    ],
  });

  const req8 = await createRequirement({
    ref: "REQ-2026-008",
    title: "Submarine periscope optics",
    customerId: navy.id,
    summary: "Periscope optical assemblies",
    status: "won",
    priority: "urgent",
    receivedOffset: -55,
    requiredDeliveryOffset: 45,
    submissionOffset: -30,
    tenderRef: "NW/PERI/2026/088",
    specs: "Optical assemblies to Navy spec NW-OPT-77.",
    ownerUserId: sales,
    lines: [
      { partNumber: "POA-500", description: "Periscope optical assembly", quantity: 40, targetUnitPrice: 128000 },
    ],
  });

  // -----------------------------------------------------------------------
  // Sourcing: OEM requests + responses (firm commitments vs indications)
  // -----------------------------------------------------------------------

  async function oemRequest(input: {
    requirementId: number;
    lineItemId: number;
    oemId: number;
    status: (typeof t.sourcingRequestStatus.enumValues)[number];
    sentOffset: number;
    requestedQuantity: number;
    dueOffset?: number;
    method?: string;
  }) {
    const [row] = await db
      .insert(t.oemRequests)
      .values({
        requirementId: input.requirementId,
        requirementLineItemId: input.lineItemId,
        oemId: input.oemId,
        status: input.status,
        requestRef: `RFQ-${input.requirementId}-${input.lineItemId}-${input.oemId}`,
        method: input.method ?? "email",
        sentAt: at(input.sentOffset),
        dueBy: input.dueOffset ? iso(input.dueOffset) : null,
        requestedQuantity: input.requestedQuantity,
        createdBy: sales,
      })
      .returning({ id: t.oemRequests.id });
    return row.id;
  }

  async function oemResponse(input: {
    oemRequestId: number;
    oemId: number;
    requirementId: number;
    lineItemId: number;
    responseType: (typeof t.oemResponseType.enumValues)[number];
    responseOffset: number;
    firmQuantity?: number;
    availableQuantity?: number;
    unitPrice?: number;
    leadTimeDays?: number;
    notes?: string;
  }) {
    await db.insert(t.oemResponses).values({
      oemRequestId: input.oemRequestId,
      oemId: input.oemId,
      requirementId: input.requirementId,
      requirementLineItemId: input.lineItemId,
      responseType: input.responseType,
      responseDate: iso(input.responseOffset),
      firmQuantity: input.firmQuantity ?? 0,
      availableQuantity: input.availableQuantity ?? null,
      unitPrice: input.unitPrice ? rs(input.unitPrice) : null,
      leadTimeDays: input.leadTimeDays ?? null,
      notes: input.notes ?? null,
      createdBy: sales,
    });
  }

  // req1 fully covered by two OEMs (the example in the brief: 600 + 400)
  const r1l1 = req1.lines[0];
  const r1l2 = req1.lines[1];
  const rr1 = await oemRequest({ requirementId: req1.id, lineItemId: r1l1.id, oemId: spe.id, status: "responded", sentOffset: -35, requestedQuantity: 120, dueOffset: -20 });
  await oemResponse({ oemRequestId: rr1, oemId: spe.id, requirementId: req1.id, lineItemId: r1l1.id, responseType: "firm_commitment", responseOffset: -30, firmQuantity: 50, unitPrice: 18200, leadTimeDays: 42, notes: "Firm: 50 units in first lot, balance on rolling schedule." });
  const rr1b = await oemRequest({ requirementId: req1.id, lineItemId: r1l1.id, oemId: dop.id, status: "responded", sentOffset: -35, requestedQuantity: 70, dueOffset: -20 });
  await oemResponse({ oemRequestId: rr1b, oemId: dop.id, requirementId: req1.id, lineItemId: r1l1.id, responseType: "firm_commitment", responseOffset: -29, firmQuantity: 70, unitPrice: 18900, leadTimeDays: 48, notes: "Firm commitment for the balance 70." });
  const rr2 = await oemRequest({ requirementId: req1.id, lineItemId: r1l2.id, oemId: spe.id, status: "responded", sentOffset: -35, requestedQuantity: 300, dueOffset: -20 });
  await oemResponse({ oemRequestId: rr2, oemId: spe.id, requirementId: req1.id, lineItemId: r1l2.id, responseType: "firm_commitment", responseOffset: -30, firmQuantity: 300, unitPrice: 4100, leadTimeDays: 30 });

  // req2 partially covered — 250 required, 150 firm, 100 mere availability (does NOT cover)
  const r2l1 = req2.lines[0];
  const r2l2 = req2.lines[1];
  const rr3 = await oemRequest({ requirementId: req2.id, lineItemId: r2l1.id, oemId: kav.id, status: "responded", sentOffset: -20, requestedQuantity: 250, dueOffset: -5 });
  await oemResponse({ oemRequestId: rr3, oemId: kav.id, requirementId: req2.id, lineItemId: r2l1.id, responseType: "firm_commitment", responseOffset: -15, firmQuantity: 150, unitPrice: 20500, leadTimeDays: 55, notes: "Firm 150; remaining 100 subject to component availability." });
  await oemResponse({ oemRequestId: rr3, oemId: kav.id, requirementId: req2.id, lineItemId: r2l1.id, responseType: "availability_indication", responseOffset: -14, availableQuantity: 100, unitPrice: 20800, leadTimeDays: 70, notes: "Indicative only — not committed." });
  const rr4 = await oemRequest({ requirementId: req2.id, lineItemId: r2l2.id, oemId: kav.id, status: "sent", sentOffset: -6, requestedQuantity: 600, dueOffset: 1 });
  // no response yet -> pending follow-up

  // req3 fully covered (won)
  const r3l1 = req3.lines[0];
  const rr5 = await oemRequest({ requirementId: req3.id, lineItemId: r3l1.id, oemId: bfc.id, status: "responded", sentOffset: -80, requestedQuantity: 900, dueOffset: -60 });
  await oemResponse({ oemRequestId: rr5, oemId: bfc.id, requirementId: req3.id, lineItemId: r3l1.id, responseType: "firm_commitment", responseOffset: -75, firmQuantity: 900, unitPrice: 3850, leadTimeDays: 55 });

  // req6 completely uncovered — demonstrates the dangerous gap
  const r6l1 = req6.lines[0];
  const rr6 = await oemRequest({ requirementId: req6.id, lineItemId: r6l1.id, oemId: nds.id, status: "sent", sentOffset: -4, requestedQuantity: 60, dueOffset: 3 });
  await oemResponse({ oemRequestId: rr6, oemId: nds.id, requirementId: req6.id, lineItemId: r6l1.id, responseType: "availability_indication", responseOffset: -3, availableQuantity: 25, unitPrice: 172000, leadTimeDays: 95, notes: "Can indicate 25 if audit clears; no firm commitment." });

  // req7 uncovered + no request yet
  // req8 fully covered (won)
  const r8l1 = req8.lines[0];
  const rr7 = await oemRequest({ requirementId: req8.id, lineItemId: r8l1.id, oemId: dop.id, status: "responded", sentOffset: -50, requestedQuantity: 40, dueOffset: -35 });
  await oemResponse({ oemRequestId: rr7, oemId: dop.id, requirementId: req8.id, lineItemId: r8l1.id, responseType: "firm_commitment", responseOffset: -45, firmQuantity: 40, unitPrice: 94000, leadTimeDays: 70 });

  // -----------------------------------------------------------------------
  // Quotes
  // -----------------------------------------------------------------------

  async function createQuote(input: {
    quoteNo: string;
    requirementId: number;
    version: number;
    status: (typeof t.quotationStatus.enumValues)[number];
    submittedOffset?: number;
    approvedOffset?: number;
    approvedBy?: number;
    lines: { requirementLineItemId: number; description: string; quantity: number; oemId: number; oemUnitPrice: number; freight: number; other: number; margin: number; finalUnitPrice: number; leadTimeDays: number }[];
  }) {
    let totalCost = 0;
    let totalRecommended = 0;
    let totalFinal = 0;
    for (const l of input.lines) {
      const cost = l.oemUnitPrice + l.freight + l.other;
      const rec = Math.round(cost / (1 - Math.min(99, l.margin) / 100));
      totalCost += cost * l.quantity;
      totalRecommended += rec * l.quantity;
      totalFinal += l.finalUnitPrice * l.quantity;
    }
    const [q] = await db
      .insert(t.quotes)
      .values({
        quoteNo: input.quoteNo,
        requirementId: input.requirementId,
        version: input.version,
        status: input.status,
        targetMarginPercent: String(input.lines[0]?.margin ?? 15),
        totalCost,
        totalRecommendedPrice: totalRecommended,
        totalFinalPrice: totalFinal,
        validUntil: iso(30),
        submittedAt: input.submittedOffset !== undefined ? at(input.submittedOffset) : null,
        approvedAt: input.approvedOffset !== undefined ? at(input.approvedOffset) : null,
        approvedBy: input.approvedBy ?? null,
        createdBy: sales,
        notes: input.status === "approved" ? "Approved for issue." : null,
      })
      .returning({ id: t.quotes.id });
    await db.insert(t.quoteLineItems).values(
      input.lines.map((l) => {
        const cost = l.oemUnitPrice + l.freight + l.other;
        const rec = Math.round(cost / (1 - Math.min(99, l.margin) / 100));
        return {
          quoteId: q.id,
          requirementLineItemId: l.requirementLineItemId,
          description: l.description,
          quantity: l.quantity,
          oemId: l.oemId,
          oemUnitPrice: l.oemUnitPrice,
          freightUnit: l.freight,
          otherUnit: l.other,
          unitCost: cost,
          targetMarginPercent: String(l.margin),
          recommendedUnitPrice: rec,
          finalUnitPrice: l.finalUnitPrice,
          leadTimeDays: l.leadTimeDays,
        };
      }),
    );
    return q.id;
  }

  const q1 = await createQuote({
    quoteNo: "QT-2026-001",
    requirementId: req1.id,
    version: 1,
    status: "approved",
    submittedOffset: -11,
    approvedOffset: -10,
    approvedBy: owner,
    lines: [
      { requirementLineItemId: r1l1.id, description: "Sonar transducer housing", quantity: 120, oemId: spe.id, oemUnitPrice: rs(18500), freight: rs(600), other: rs(200), margin: 18, finalUnitPrice: rs(23600), leadTimeDays: 45 },
      { requirementLineItemId: r1l2.id, description: "Mounting bracket", quantity: 300, oemId: spe.id, oemUnitPrice: rs(4100), freight: rs(120), other: rs(30), margin: 18, finalUnitPrice: rs(5250), leadTimeDays: 30 },
    ],
  });

  const q2 = await createQuote({
    quoteNo: "QT-2026-002",
    requirementId: req2.id,
    version: 1,
    status: "pending_approval",
    submittedOffset: undefined,
    lines: [
      { requirementLineItemId: r2l1.id, description: "SDR encryption module", quantity: 250, oemId: kav.id, oemUnitPrice: rs(20500), freight: rs(500), other: rs(100), margin: 20, finalUnitPrice: rs(26500), leadTimeDays: 55 },
      { requirementLineItemId: r2l2.id, description: "NVG battery pack", quantity: 600, oemId: kav.id, oemUnitPrice: rs(3200), freight: rs(90), other: rs(20), margin: 20, finalUnitPrice: rs(4100), leadTimeDays: 40 },
    ],
  });

  const q3 = await createQuote({
    quoteNo: "QT-2026-003",
    requirementId: req3.id,
    version: 1,
    status: "approved",
    submittedOffset: -49,
    approvedOffset: -48,
    approvedBy: owner,
    lines: [
      { requirementLineItemId: r3l1.id, description: "Hydraulic actuator bracket", quantity: 900, oemId: bfc.id, oemUnitPrice: rs(3850), freight: rs(110), other: rs(40), margin: 16, finalUnitPrice: rs(4800), leadTimeDays: 55 },
    ],
  });

  const q4 = await createQuote({
    quoteNo: "QT-2026-004",
    requirementId: req4.id,
    version: 1,
    status: "superseded",
    submittedOffset: -79,
    approvedOffset: -78,
    approvedBy: owner,
    lines: [
      { requirementLineItemId: req4.lines[0].id, description: "Waveguide assembly", quantity: 200, oemId: bel.id, oemUnitPrice: rs(8200), freight: rs(300), other: rs(120), margin: 22, finalUnitPrice: rs(9200), leadTimeDays: 50 },
    ],
  });
  const q4b = await createQuote({
    quoteNo: "QT-2026-005",
    requirementId: req4.id,
    version: 2,
    status: "rejected",
    submittedOffset: -79,
    lines: [
      { requirementLineItemId: req4.lines[0].id, description: "Waveguide assembly (revised down)", quantity: 200, oemId: bel.id, oemUnitPrice: rs(8200), freight: rs(300), other: rs(120), margin: 16, finalUnitPrice: rs(8900), leadTimeDays: 50 },
    ],
  });

  const q5 = await createQuote({
    quoteNo: "QT-2026-006",
    requirementId: req8.id,
    version: 1,
    status: "approved",
    submittedOffset: -29,
    approvedOffset: -28,
    approvedBy: owner,
    lines: [
      { requirementLineItemId: r8l1.id, description: "Periscope optical assembly", quantity: 40, oemId: dop.id, oemUnitPrice: rs(96000), freight: rs(2500), other: rs(500), margin: 22, finalUnitPrice: rs(128000), leadTimeDays: 70 },
    ],
  });

  // -----------------------------------------------------------------------
  // Government responses
  // -----------------------------------------------------------------------
  await db.insert(t.governmentResponses).values([
    { requirementId: req1.id, quoteId: q1, status: "commercial_negotiation", responseDate: iso(-6), notes: "Negotiating freight component; technical accepted.", createdBy: sales },
    { requirementId: req2.id, quoteId: q2, status: "technical_clarification", responseDate: iso(-3), notes: "Clarification sought on encryption certification.", createdBy: sales },
    { requirementId: req4.id, quoteId: q4b, status: "lost", responseDate: iso(-60), notes: "Lost on price.", createdBy: sales },
    { requirementId: req5.id, status: "lost", responseDate: iso(-95), notes: "Incumbent retained.", createdBy: sales },
    { requirementId: req8.id, quoteId: q5, status: "won", responseDate: iso(-25), notes: "Awarded.", createdBy: sales },
  ]);

  // -----------------------------------------------------------------------
  // Orders + line items
  // -----------------------------------------------------------------------

  async function createOrder(input: {
    orderNo: string;
    quoteId: number;
    requirementId: number;
    customerId: number;
    poNumber: string;
    poOffset: number;
    status: (typeof t.orderStatus.enumValues)[number];
    totalValue: number;
    deliveryDeadlineOffset: number;
    expectedCompletionOffset: number;
    oemId: number;
    supplierPoNumber: string;
    supplierPoOffset: number;
    compliance: string;
    inspection: string;
    pdi: string;
    lines: { requirementLineItemId: number; quoteLineItemId?: number; partNumber: string; description: string; quantity: number; unitPrice: number; oemId: number }[];
  }) {
    const [o] = await db
      .insert(t.orders)
      .values({
        orderNo: input.orderNo,
        quoteId: input.quoteId,
        requirementId: input.requirementId,
        customerId: input.customerId,
        poNumber: input.poNumber,
        poDate: iso(input.poOffset),
        status: input.status,
        totalValue: input.totalValue,
        deliveryDeadline: iso(input.deliveryDeadlineOffset),
        expectedCompletionDate: iso(input.expectedCompletionOffset),
        oemId: input.oemId,
        supplierPoNumber: input.supplierPoNumber,
        supplierPoDate: iso(input.supplierPoOffset),
        complianceRequirements: input.compliance,
        inspectionRequirements: input.inspection,
        pdiRequirements: input.pdi,
        createdBy: opsId,
      })
      .returning({ id: t.orders.id });
    await db.insert(t.orderLineItems).values(
      input.lines.map((l) => ({
        orderId: o.id,
        quoteLineItemId: l.quoteLineItemId ?? null,
        requirementLineItemId: l.requirementLineItemId,
        partNumber: l.partNumber,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        oemId: l.oemId,
      })),
    );
    return o.id;
  }

  const ord1 = await createOrder({
    orderNo: "ORD-2026-001",
    quoteId: q3,
    requirementId: req3.id,
    customerId: hal.id,
    poNumber: "HAL/PO/2026/7781",
    poOffset: -45,
    status: "at_risk",
    totalValue: rs(4320000),
    deliveryDeadlineOffset: 12,
    expectedCompletionOffset: 18,
    oemId: bfc.id,
    supplierPoNumber: "BFC/SPO/2026/441",
    supplierPoOffset: -42,
    compliance: "Material certs, AS9100D, heat treat certs",
    inspection: "HAL resident inspector witness",
    pdi: "Dimensional + NDT, 900 units",
    lines: [
      { requirementLineItemId: r3l1.id, partNumber: "HAB-770", description: "Hydraulic actuator bracket", quantity: 900, unitPrice: rs(4800), oemId: bfc.id },
    ],
  });

  const ord2 = await createOrder({
    orderNo: "ORD-2026-002",
    quoteId: q1,
    requirementId: req1.id,
    customerId: navy.id,
    poNumber: "NW/PO/2026/2201",
    poOffset: -9,
    status: "in_progress",
    totalValue: rs(4397000),
    deliveryDeadlineOffset: 55,
    expectedCompletionOffset: 50,
    oemId: spe.id,
    supplierPoNumber: "SPE/SPO/2026/889",
    supplierPoOffset: -8,
    compliance: "AS9100D, pressure test report",
    inspection: "Navy QA at OEM works",
    pdi: "Pressure + dimensional, 120 + 300",
    lines: [
      { requirementLineItemId: r1l1.id, partNumber: "STH-2200", description: "Sonar transducer housing", quantity: 120, unitPrice: rs(23600), oemId: spe.id },
      { requirementLineItemId: r1l2.id, partNumber: "HAB-770", description: "Mounting bracket", quantity: 300, unitPrice: rs(5250), oemId: spe.id },
    ],
  });

  const ord3 = await createOrder({
    orderNo: "ORD-2026-003",
    quoteId: q5,
    requirementId: req8.id,
    customerId: navy.id,
    poNumber: "NW/PO/2026/1990",
    poOffset: -24,
    status: "completed",
    totalValue: rs(5120000),
    deliveryDeadlineOffset: -2,
    expectedCompletionOffset: -6,
    oemId: dop.id,
    supplierPoNumber: "DOP/SPO/2026/115",
    supplierPoOffset: -22,
    compliance: "Optical coating cert, MIL-C-48497",
    inspection: "Navy optical QA",
    pdi: "Optical + dimensional, 40 units",
    lines: [
      { requirementLineItemId: r8l1.id, partNumber: "POA-500", description: "Periscope optical assembly", quantity: 40, unitPrice: rs(128000), oemId: dop.id },
    ],
  });

  // -----------------------------------------------------------------------
  // Fulfilment timeline + PDI
  // -----------------------------------------------------------------------

  async function fulfilment(orderId: number, stages: { stage: any; state: any; expectedOffset?: number; actualOffset?: number; owner?: number; notes?: string }[]) {
    for (const s of stages) {
      await db.insert(t.fulfilmentEvents).values({
        orderId,
        stage: s.stage,
        state: s.state,
        ownerUserId: s.owner ?? opsId,
        expectedDate: s.expectedOffset !== undefined ? iso(s.expectedOffset) : null,
        actualDate: s.actualOffset !== undefined ? iso(s.actualOffset) : null,
        notes: s.notes ?? null,
        createdBy: opsId,
      });
    }
  }

  await fulfilment(ord1, [
    { stage: "oem_po_placed", state: "done", expectedOffset: -42, actualOffset: -42 },
    { stage: "production_started", state: "done", expectedOffset: -35, actualOffset: -33 },
    { stage: "production_done", state: "done", expectedOffset: -8, actualOffset: -7 },
    { stage: "pdi_scheduled", state: "done", expectedOffset: -4, actualOffset: -4 },
    { stage: "pdi_passed", state: "blocked", expectedOffset: 1, notes: "PDI failed on 120 units — dimensional deviation. Rework in progress." },
  ]);

  await fulfilment(ord2, [
    { stage: "oem_po_placed", state: "done", expectedOffset: -8, actualOffset: -8 },
    { stage: "production_started", state: "in_progress", expectedOffset: -3, actualOffset: -3 },
    { stage: "production_done", state: "pending", expectedOffset: 30 },
    { stage: "pdi_scheduled", state: "pending", expectedOffset: 38 },
    { stage: "pdi_passed", state: "pending", expectedOffset: 44 },
    { stage: "government_inspection", state: "pending", expectedOffset: 48 },
    { stage: "dispatched", state: "pending", expectedOffset: 50 },
    { stage: "delivered", state: "pending", expectedOffset: 54 },
    { stage: "accepted", state: "pending", expectedOffset: 55 },
  ]);

  await fulfilment(ord3, [
    { stage: "oem_po_placed", state: "done", expectedOffset: -22, actualOffset: -22 },
    { stage: "production_started", state: "done", expectedOffset: -18, actualOffset: -18 },
    { stage: "production_done", state: "done", expectedOffset: -12, actualOffset: -12 },
    { stage: "pdi_scheduled", state: "done", expectedOffset: -10, actualOffset: -10 },
    { stage: "pdi_passed", state: "done", expectedOffset: -9, actualOffset: -9 },
    { stage: "government_inspection", state: "done", expectedOffset: -8, actualOffset: -8 },
    { stage: "dispatched", state: "done", expectedOffset: -7, actualOffset: -7 },
    { stage: "delivered", state: "done", expectedOffset: -5, actualOffset: -5 },
    { stage: "accepted", state: "done", expectedOffset: -2, actualOffset: -2 },
  ]);

  // PDI records
  await db.insert(t.pdiRecords).values([
    { orderId: ord1, pdiRef: "PDI-ORD1-01", status: "failed", scheduledDate: iso(-4), completedDate: iso(-3), quantityOffered: 300, quantityCleared: 180, quantityRejected: 120, inspector: "HAL QA — S. Pillai", notes: "120 units out of tolerance; rework and re-offer." },
    { orderId: ord3, pdiRef: "PDI-ORD3-01", status: "passed", scheduledDate: iso(-10), completedDate: iso(-9), quantityOffered: 40, quantityCleared: 40, quantityRejected: 0, inspector: "Navy Optical QA", notes: "All 40 cleared." },
  ]);

  // Deliveries
  await db.insert(t.deliveryEvents).values([
    { orderId: ord3, stage: "delivered", status: "accepted", quantity: 40, scheduledDate: iso(-5), actualDate: iso(-5), ownerUserId: opsId, receivedBy: "Naval Dockyard stores", notes: "All 40 accepted." },
  ]);

  // -----------------------------------------------------------------------
  // Invoices, payments, commission
  // -----------------------------------------------------------------------

  async function createInvoice(input: {
    invoiceNo: string;
    orderId: number;
    invoiceType: (typeof t.invoiceType.enumValues)[number];
    invoiceOffset: number;
    dueOffset: number;
    amount: number;
    tax: number;
    status: (typeof t.invoiceStatus.enumValues)[number];
  }) {
    const [inv] = await db
      .insert(t.invoices)
      .values({
        invoiceNo: input.invoiceNo,
        orderId: input.orderId,
        invoiceType: input.invoiceType,
        invoiceDate: iso(input.invoiceOffset),
        dueDate: iso(input.dueOffset),
        amount: input.amount,
        tax: input.tax,
        total: input.amount + input.tax,
        status: input.status,
        createdBy: finance,
      })
      .returning({ id: t.invoices.id });
    return inv.id;
  }

  const inv1 = await createInvoice({ invoiceNo: "INV-2026-101", orderId: ord1, invoiceType: "customer_tax_invoice", invoiceOffset: -30, dueOffset: 5, amount: rs(3816000), tax: rs(685080), status: "partially_paid" });
  const inv2 = await createInvoice({ invoiceNo: "INV-2026-102", orderId: ord1, invoiceType: "supplier_invoice", invoiceOffset: -40, dueOffset: -5, amount: rs(3465000), tax: rs(623700), status: "overdue" });
  const inv3 = await createInvoice({ invoiceNo: "INV-2026-103", orderId: ord2, invoiceType: "customer_tax_invoice", invoiceOffset: -5, dueOffset: 25, amount: rs(4397000), tax: rs(791460), status: "issued" });
  const inv4 = await createInvoice({ invoiceNo: "INV-2026-104", orderId: ord3, invoiceType: "customer_tax_invoice", invoiceOffset: -20, dueOffset: 10, amount: rs(5120000), tax: rs(921600), status: "paid" });
  const inv5 = await createInvoice({ invoiceNo: "INV-2026-105", orderId: ord3, invoiceType: "supplier_invoice", invoiceOffset: -19, dueOffset: 5, amount: rs(3860000), tax: rs(694800), status: "paid" });

  const payRows = await db
    .insert(t.payments)
    .values([
      { invoiceId: inv1, orderId: ord1, direction: "receivable_from_customer", amount: rs(2000000), paidAt: iso(-12), status: "paid", reference: "RTGS/99881", method: "RTGS", createdBy: finance },
      { invoiceId: inv2, orderId: ord1, direction: "payable_to_oem", amount: rs(3465000), paidAt: iso(-2), status: "paid", reference: "RTGS/99890", method: "RTGS", createdBy: finance },
      { invoiceId: inv4, orderId: ord3, direction: "receivable_from_customer", amount: rs(6031600), paidAt: iso(-4), status: "paid", reference: "RTGS/99700", method: "RTGS", createdBy: finance },
      { invoiceId: inv5, orderId: ord3, direction: "payable_to_oem", amount: rs(4554800), paidAt: iso(-3), status: "paid", reference: "RTGS/99701", method: "RTGS", createdBy: finance },
      { invoiceId: inv3, orderId: ord2, direction: "receivable_from_customer", amount: rs(1500000), dueDate: iso(25), status: "pending", reference: "advance expected", createdBy: finance },
    ])
    .returning({ id: t.payments.id });

  await db.insert(t.commissionEntries).values([
    // Earned on the OEM-payment milestone for ORD-2026-003
    { orderId: ord3, oemId: dop.id, oemPaymentId: payRows[3].id, milestone: "oem_payment_paid", baseAmount: rs(5120000), ratePercent: "3.50", amount: rs(179200), status: "received", earnedAt: at(-3), createdBy: finance, notes: "Commission earned when OEM payment cleared." },
    // ORD-2026-001 OEM payment made, commission now earned
    { orderId: ord1, oemId: bfc.id, oemPaymentId: payRows[1].id, milestone: "oem_payment_paid", baseAmount: rs(4320000), ratePercent: "3.00", amount: rs(129600), status: "earned", earnedAt: at(-2), createdBy: finance, notes: "Earned on OEM payment milestone." },
    // ORD-2026-002 OEM not yet paid -> commission pending
    { orderId: ord2, oemId: spe.id, milestone: "oem_payment_paid", baseAmount: rs(4397000), ratePercent: "3.00", amount: rs(131910), status: "pending", createdBy: finance, notes: "Awaiting OEM payment milestone." },
  ]);

  // -----------------------------------------------------------------------
  // Documents vault
  // -----------------------------------------------------------------------
  await db.insert(t.documents).values([
    { title: "AS9100D Certificate — Shakti Precision", docType: "compliance_certificate", source: "obtained_from_oem", status: "expiring", referenceNo: "AS9100D-2023-1188", oemId: spe.id, requirementId: req1.id, productName: "Sonar transducer housing", issueDate: iso(-1050), expiryDate: iso(40), renewAfterMonths: 36, processingDays: 9, notes: "Renewal audit scheduled.", uploadedBy: finance },
    { title: "MIL-C-48497 Coating Cert — Deccan Optics", docType: "test_report", source: "obtained_from_oem", status: "valid", oemId: dop.id, productName: "Periscope optical assembly", issueDate: iso(-200), expiryDate: iso(500), uploadedBy: finance },
    { title: "JSS 55555 Qualification — Kaveri Electronics", docType: "license", source: "obtained_from_oem", status: "valid", oemId: kav.id, requirementId: req2.id, productName: "SDR encryption module", issueDate: iso(-400), expiryDate: iso(700), renewAfterMonths: 48, processingDays: 12, uploadedBy: finance },
    { title: "Approved Item List — Naval sonar spares", docType: "approved_item_list", source: "reused", status: "expiring", customerId: navy.id, productName: "Sonar spares", issueDate: iso(-1500), expiryDate: iso(70), renewAfterMonths: 60, notes: "AIL renews every 5 years.", uploadedBy: finance },
    { title: "Supplier PO — Bharat Forge (ORD-2026-001)", docType: "purchase_order", source: "generated_from_data", status: "valid", oemId: bfc.id, orderId: ord1, issueDate: iso(-42), processingDays: 1, uploadedBy: opsId },
    { title: "Tender response pack — REQ-2026-001", docType: "other", source: "prepared_by_hand", status: "valid", requirementId: req1.id, issueDate: iso(-12), processingDays: 6, notes: "Six days of manual assembly and formatting.", uploadedBy: sales },
    { title: "Insurance — Deccan Optics transit cover", docType: "insurance", source: "obtained_from_oem", status: "expired", oemId: dop.id, issueDate: iso(-400), expiryDate: iso(-15), renewAfterMonths: 12, uploadedBy: finance },
  ]);

  // -----------------------------------------------------------------------
  // Approvals
  // -----------------------------------------------------------------------
  await db.insert(t.approvalRequests).values([
    { entityType: "quote", entityId: q2, requirementId: req2.id, status: "pending", requestedBy: sales, payload: { note: "Submit for approval despite 100 uncovered units." } },
    { entityType: "quote", entityId: q1, requirementId: req1.id, status: "approved", requestedBy: sales, decidedBy: owner, requestedAt: at(-11), decidedAt: at(-10), comment: "Approved." },
    { entityType: "document", entityId: 1, requirementId: req1.id, status: "pending", requestedBy: finance, payload: { title: "AS9100D Certificate — Shakti Precision" } },
    { entityType: "coverage_override", entityId: req2.id, requirementId: req2.id, status: "pending", requestedBy: sales, payload: { uncovered: 100, reason: "Availability indication received; awaiting firm commitment." } },
  ]);

  // -----------------------------------------------------------------------
  // Follow-up tasks (generated by the real rule engine)
  // -----------------------------------------------------------------------

  const generated = buildFollowUpTasks({
    noResponseQuotes: [
      { requirementId: req1.id, requirementRef: req1 ? "REQ-2026-001" : "", submittedAt: at(-11), ownerUserId: sales },
    ],
    governmentResponses: [
      { requirementId: req2.id, requirementRef: "REQ-2026-002", status: "technical_clarification", responseDate: iso(-3), documentId: null, ownerUserId: sales },
    ],
    pendingOemRequests: [
      { id: rr4, requirementId: req2.id, requirementRef: "REQ-2026-002", oemName: "Kaveri Electronics", sentAt: at(-6), dueBy: iso(1), ownerUserId: sales },
      { id: rr6, requirementId: req6.id, requirementRef: "REQ-2026-006", oemName: "Nova Defence Systems", sentAt: at(-4), dueBy: iso(3), ownerUserId: sales },
    ],
    upcomingDeadlines: [
      { requirementId: req2.id, requirementRef: "REQ-2026-002", title: req2 ? "Army SDR encryption modules" : "", submissionDeadline: at(4), ownerUserId: sales },
      { requirementId: req7.id, requirementRef: "REQ-2026-007", title: "Night vision goggle battery packs", submissionDeadline: at(12), ownerUserId: sales },
    ],
    invoices: [
      { id: inv3, invoiceNo: "INV-2026-103", orderId: ord2, dueDate: iso(25), balance: rs(2898460), ownerUserId: finance },
      { id: inv1, invoiceNo: "INV-2026-101", orderId: ord1, dueDate: iso(5), balance: rs(2501080), ownerUserId: finance },
    ],
    expiringDocuments: [
      { id: 1, title: "AS9100D Certificate — Shakti Precision", expiryDate: iso(40), ownerUserId: finance },
      { id: 4, title: "Approved Item List — Naval sonar spares", expiryDate: iso(70), ownerUserId: finance },
      { id: 7, title: "Insurance — Deccan Optics transit cover", expiryDate: iso(-15), ownerUserId: finance },
    ],
    atRiskOrders: [
      { id: ord1, orderNo: "ORD-2026-001", deliveryDeadline: iso(12), outstandingQuantity: 900, riskLevel: "at_risk", ownerUserId: opsId },
    ],
  });

  for (const task of generated) {
    await db.insert(t.followUpTasks).values({
      rule: task.rule,
      title: task.title,
      requirementId: task.requirementId ?? null,
      orderId: task.orderId ?? null,
      invoiceId: task.invoiceId ?? null,
      documentId: task.documentId ?? null,
      ownerUserId: task.ownerUserId ?? null,
      dueDate: task.dueDate,
      notes: task.notes ?? null,
      dedupeKey: task.dedupeKey,
    });
  }

  // -----------------------------------------------------------------------
  // Audit samples
  // -----------------------------------------------------------------------
  await db.insert(t.auditLogs).values([
    { entityType: "quote", entityId: q1, action: "quote.approved", actorUserId: owner, actorRole: "owner", before: { status: "pending_approval" }, after: { status: "approved" }, reason: "Coverage complete for all line items." },
    { entityType: "order", entityId: ord1, action: "order.created_from_quote", actorUserId: opsId, actorRole: "operations", after: { orderNo: "ORD-2026-001", quoteId: q3 }, reason: "Approved quote converted to PO." },
    { entityType: "requirement", entityId: req4.id, action: "requirement.lost", actorUserId: sales, actorRole: "sales", before: { status: "submitted" }, after: { status: "lost" }, reason: "price" },
    { entityType: "pdi_record", entityId: 1, action: "pdi.failed", actorUserId: opsId, actorRole: "operations", after: { offered: 300, cleared: 180, rejected: 120 }, reason: "Dimensional deviation; dispatch blocked." },
    { entityType: "document", entityId: 1, action: "document.expiring", actorUserId: finance, actorRole: "finance", after: { expiryDate: iso(40) }, reason: "Within 90-day renewal window." },
  ]);

  console.log("Seed complete.");
  console.log("Users: owner@ramprasad.in / sales@ramprasad.in / ops@ramprasad.in / finance@ramprasad.in — password: password123");
  console.log(`Inserted: 8 requirements, 3 orders, ${payRows.length} payments.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
