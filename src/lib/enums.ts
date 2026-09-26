// Human labels for every enumeration. Reference data (loss reasons) is also
// seeded into the DB so labels can be changed without code changes.

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  management: "Management",
  sales: "Sales",
  operations: "Operations",
  finance: "Finance",
};

export const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  qualifying: "Qualifying",
  quoted: "Quoted",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  cancelled: "Cancelled",
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Superseded",
};

export const GOVERNMENT_RESPONSE_LABELS: Record<string, string> = {
  submitted: "Submitted",
  clarification_requested: "Clarification requested",
  technical_clarification: "Technical clarification",
  commercial_negotiation: "Commercial negotiation",
  awaiting_approval: "Awaiting approval",
  won: "Won",
  lost: "Lost",
  cancelled: "Cancelled",
};

export const OEM_STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  not_approved: "Not approved",
  suspended: "Suspended",
};

export const OEM_RESPONSE_TYPE_LABELS: Record<string, string> = {
  firm_commitment: "Firm commitment",
  availability_indication: "Availability indication",
  quote_indication: "Quote indication",
  decline: "Declined",
};

export const SOURCING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  responded: "Responded",
  closed: "Closed",
  no_response: "No response",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  at_risk: "At risk",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  customer_tax_invoice: "Customer invoice (receivable)",
  supplier_invoice: "Supplier invoice (payable)",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const PAYMENT_DIRECTION_LABELS: Record<string, string> = {
  receivable_from_customer: "Receivable from customer",
  payable_to_oem: "Payable to OEM",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  earned: "Earned",
  invoiced: "Invoiced",
  received: "Received",
  cancelled: "Cancelled",
};

export const FULFILMENT_STAGE_LABELS: Record<string, string> = {
  oem_po_placed: "OEM PO placed",
  production_started: "Production started",
  production_done: "Production done",
  pdi_scheduled: "PDI scheduled",
  pdi_passed: "PDI passed",
  government_inspection: "Government inspection",
  dispatched: "Dispatched",
  delivered: "Delivered",
  accepted: "Accepted",
};

export const FULFILMENT_STATE_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};

export const FULFILMENT_ORDER: string[] = [
  "oem_po_placed",
  "production_started",
  "production_done",
  "pdi_scheduled",
  "pdi_passed",
  "government_inspection",
  "dispatched",
  "delivered",
  "accepted",
];

export const PDI_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  passed: "Passed",
  failed: "Failed",
  held: "Held",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_transit: "In transit",
  delivered: "Delivered",
  accepted: "Accepted",
  partially_rejected: "Partially rejected",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  compliance_certificate: "Compliance certificate",
  approved_item_list: "Approved item list",
  test_report: "Test report",
  datasheet: "Datasheet",
  license: "License",
  insurance: "Insurance",
  invoice: "Invoice",
  purchase_order: "Purchase order",
  other: "Other",
};

export const DOCUMENT_SOURCE_LABELS: Record<string, string> = {
  generated_from_data: "Generated from data",
  reused: "Reused",
  obtained_from_oem: "Obtained from OEM",
  prepared_by_hand: "Prepared by hand",
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  valid: "Valid",
  expiring: "Expiring",
  expired: "Expired",
  pending: "Pending",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPROVAL_ENTITY_LABELS: Record<string, string> = {
  quote: "Quote",
  document: "Document",
  order: "Order",
  compliance_item: "Compliance item",
  coverage_override: "Coverage override",
};

export const FOLLOW_UP_RULE_LABELS: Record<string, string> = {
  no_response_7d: "No response for 7 days",
  document_requested: "Document requested",
  clarification_overdue: "Clarification overdue",
  submission_deadline: "Submission deadline approaching",
  payment_due: "Payment due",
  document_expiring: "Document expiring",
  delivery_deadline: "Delivery deadline",
  oem_response_pending: "OEM response pending",
};

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  done: "Done",
  dismissed: "Dismissed",
};

export const LOSS_REASON_LABELS: Record<string, string> = {
  price: "Price",
  technical_non_compliance: "Technical non-compliance",
  delivery_timeline: "Delivery timeline",
  competitor_preference: "Competitor preference",
  quantity_capacity: "Quantity / capacity",
  cancelled: "Cancelled",
  not_pursued: "Not pursued",
  other: "Other",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
