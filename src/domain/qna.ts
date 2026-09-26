// Plain-language Q&A over stored data only.
// The model is a deterministic intent matcher, not a generative one: every
// answer is rendered from a facts bundle computed from the database, so the
// system can never invent a number. Unmatched questions say so explicitly.

import { formatMoney } from "@/lib/format";

export type QnaFacts = {
  monthLabel: string;
  orders: {
    total: number;
    open: number;
    atRisk: number;
    byState: { state: string; label: string; count: number }[];
  };
  requirements: {
    total: number;
    byStatus: { status: string; label: string; count: number }[];
    wonThisMonth: number;
    lostThisMonth: number;
    openNow: number;
  };
  losses: {
    totalAllTime: number;
    thisMonth: number;
    byReason: { code: string; label: string; count: number; value: number }[];
    recent: { ref: string; title: string; reason: string; notes: string | null }[];
  };
  payments: {
    receivableOutstanding: number;
    payableOutstanding: number;
    overdueInvoices: number;
  };
  oemResponsesPending: number;
  documentsExpiring: number;
  quotesAwaitingResponse: number;
};

export type QnaAnswer = {
  intent: string;
  answered: boolean;
  answer: string;
  detail?: string[];
};

type Intent = {
  name: string;
  patterns: RegExp[];
  render: (f: QnaFacts) => QnaAnswer;
};

const INTENTS: Intent[] = [
  {
    name: "why_lost",
    patterns: [/why.*(lose|lost|loss)/i, /(reasons?|reason).*(lose|lost|loss)/i],
    render: (f) => {
      if (f.losses.byReason.length === 0) {
        return {
          intent: "why_lost",
          answered: true,
          answer: `No structured loss reasons recorded yet. This month: ${f.losses.thisMonth} loss(es).`,
        };
      }
      return {
        intent: "why_lost",
        answered: true,
        answer: `Losses by reason (all time, ${f.losses.totalAllTime} total): ${f.losses.byReason
          .map((r) => `${r.label} ×${r.count}${r.value ? ` (${formatMoney(r.value)})` : ""}`)
          .join("; ")}.`,
        detail: f.losses.recent.map(
          (l) => `${l.ref} — ${l.title}: ${l.reason}${l.notes ? ` (${l.notes})` : ""}`,
        ),
      };
    },
  },
  {
    name: "lost_list",
    patterns: [/what did we lose/i, /\blost\b/i, /loss(es)?\b/i, /which.*(lost|lose)/i],
    render: (f) => {
      if (f.losses.totalAllTime === 0) {
        return {
          intent: "lost_list",
          answered: true,
          answer: "No opportunities have been marked lost yet.",
        };
      }
      return {
        intent: "lost_list",
        answered: true,
        answer: `${f.losses.totalAllTime} opportunit${f.losses.totalAllTime === 1 ? "y has" : "ies have"} been lost; ${f.losses.thisMonth} this month (${f.monthLabel}).`,
        detail: f.losses.recent.map(
          (l) => `${l.ref} — ${l.title}: ${l.reason}${l.notes ? ` (${l.notes})` : ""}`,
        ),
      };
    },
  },
  {
    name: "won_this_month",
    patterns: [/won.*(this month|month)/i, /win(s|ning)?.*month/i, /contracts?.*won/i, /won contracts/i],
    render: (f) => ({
      intent: "won_this_month",
      answered: true,
      answer: `${f.requirements.wonThisMonth} requirement(s) marked won in ${f.monthLabel}. ${f.requirements.lostThisMonth} lost in the same period.`,
    }),
  },
  {
    name: "orders_count",
    patterns: [/how many orders/i, /number of orders/i, /orders.*(are there|count|total)/i, /\borders\b/i],
    render: (f) => ({
      intent: "orders_count",
      answered: true,
      answer: `${f.orders.total} order(s) total; ${f.orders.open} open; ${f.orders.atRisk} at delivery risk.`,
      detail: f.orders.byState.map((s) => `${s.label}: ${s.count}`),
    }),
  },
  {
    name: "at_risk",
    patterns: [/at risk/i, /delivery risk/i, /where is.*order/i, /late/i],
    render: (f) => ({
      intent: "at_risk",
      answered: true,
      answer: f.orders.atRisk
        ? `${f.orders.atRisk} order(s) are at delivery risk or late.`
        : "No orders are currently at delivery risk.",
    }),
  },
  {
    name: "payments_pending",
    patterns: [/payment/i, /receivable/i, /payable/i, /money/i, /outstanding/i],
    render: (f) => ({
      intent: "payments_pending",
      answered: true,
      answer: `Receivable from customers: ${formatMoney(f.payments.receivableOutstanding)}. Payable to OEMs: ${formatMoney(f.payments.payableOutstanding)}. ${f.payments.overdueInvoices} overdue invoice(s).`,
    }),
  },
  {
    name: "oem_pending",
    patterns: [/oem.*(pending|response)/i, /responses?.*pending/i, /awaiting.*oem/i],
    render: (f) => ({
      intent: "oem_pending",
      answered: true,
      answer: `${f.oemResponsesPending} OEM request(s) are awaiting a response.`,
    }),
  },
  {
    name: "documents_expiring",
    patterns: [/document.*expir/i, /expir.*document/i, /documents?.*(due|renew)/i],
    render: (f) => ({
      intent: "documents_expiring",
      answered: true,
      answer: `${f.documentsExpiring} document(s) are expired or expiring within 90 days.`,
    }),
  },
  {
    name: "quotes_awaiting",
    patterns: [/quote.*(response|waiting|pending|awaiting)/i, /awaiting.*quote/i, /submitted.*quote/i],
    render: (f) => ({
      intent: "quotes_awaiting",
      answered: true,
      answer: `${f.quotesAwaitingResponse} submitted quote(s) are awaiting a government/agency response.`,
    }),
  },
  {
    name: "requirements_count",
    patterns: [/how many (requirements|enquiries|rfis)/i, /number of (requirements|enquiries|rfis)/i, /\brequirements?\b/i, /\benquiries\b/i],
    render: (f) => ({
      intent: "requirements_count",
      answered: true,
      answer: `${f.requirements.total} requirement(s) total; ${f.requirements.openNow} open now. ${f.requirements.byStatus
        .map((s) => `${s.label}: ${s.count}`)
        .join(", ")}.`,
    }),
  },
];

export function answerQuestion(question: string, facts: QnaFacts): QnaAnswer {
  const q = question.trim();
  if (!q) {
    return { intent: "empty", answered: false, answer: "Ask a question about your data." };
  }
  for (const intent of INTENTS) {
    if (intent.patterns.some((p) => p.test(q))) {
      return intent.render(facts);
    }
  }
  return {
    intent: "unknown",
    answered: false,
    answer:
      "I can only answer from stored data and I could not match that question to a known query. Try: orders, won this month, what did we lose, why did we lose, delivery risk, payments pending, OEM responses pending, documents expiring.",
  };
}

export function suggestedQuestions(): string[] {
  return [
    "How many orders are there?",
    "How many contracts did we win this month?",
    "What did we lose?",
    "Why did we lose them?",
    "Which orders are at delivery risk?",
    "Payments pending?",
    "OEM responses pending?",
    "Documents expiring?",
  ];
}
