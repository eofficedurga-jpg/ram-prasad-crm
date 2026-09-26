import type { QnaFacts } from "@/domain/qna";
import { getDashboardFacts } from "./dashboard";

export async function getQnaFacts(): Promise<QnaFacts> {
  const f = await getDashboardFacts();
  const openOrders = f.orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled" && o.status !== "delivered",
  );
  const atRisk = f.orders.filter((o) => o.risk === "at_risk" || o.risk === "late");
  const documentsExpiring = f.documents.filter(
    (d) => d.status === "expired" || (d.daysToExpiry !== null && d.daysToExpiry <= 90),
  ).length;

  return {
    monthLabel: f.monthLabel,
    orders: {
      total: f.orders.length,
      open: openOrders.length,
      atRisk: atRisk.length,
      byState: f.ordersByState,
    },
    requirements: {
      total: f.requirementTotal,
      byStatus: f.requirementsByStatus,
      wonThisMonth: f.wonThisMonth,
      lostThisMonth: f.lostThisMonth,
      openNow: f.requirementOpen,
    },
    losses: {
      totalAllTime: f.losses.totalAllTime,
      thisMonth: f.losses.thisMonth,
      byReason: f.losses.byReason,
      recent: f.losses.recent,
    },
    payments: {
      receivableOutstanding: f.receivableOutstanding,
      payableOutstanding: f.payableOutstanding,
      overdueInvoices: f.overdueInvoices,
    },
    oemResponsesPending: f.oemPending.length,
    documentsExpiring,
    quotesAwaitingResponse: f.quotesAwaitingResponse.length,
  };
}
