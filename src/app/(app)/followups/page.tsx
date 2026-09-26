import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { completeFollowUpAction, regenerateFollowUpsAction, snoozeFollowUpAction } from "@/app/actions/followups";
import { DataState, EmptyRow, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { FOLLOW_UP_RULE_LABELS, FOLLOW_UP_STATUS_LABELS } from "@/lib/enums";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const db = await getDbAsync();
  const tasks = await db
    .select({
      task: t.followUpTasks,
      requirementRef: t.requirements.ref,
      orderNo: t.orders.orderNo,
      invoiceNo: t.invoices.invoiceNo,
      documentTitle: t.documents.title,
      ownerName: t.users.name,
    })
    .from(t.followUpTasks)
    .leftJoin(t.requirements, eq(t.requirements.id, t.followUpTasks.requirementId))
    .leftJoin(t.orders, eq(t.orders.id, t.followUpTasks.orderId))
    .leftJoin(t.invoices, eq(t.invoices.id, t.followUpTasks.invoiceId))
    .leftJoin(t.documents, eq(t.documents.id, t.followUpTasks.documentId))
    .leftJoin(t.users, eq(t.users.id, t.followUpTasks.ownerUserId))
    .orderBy(asc(t.followUpTasks.dueDate));

  const open = tasks.filter((x) => x.task.status === "open");
  const closed = tasks.filter((x) => x.task.status !== "open");

  const renderTable = (rows: typeof tasks) => (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Rule</th>
            <th>Linked to</th>
            <th>Owner</th>
            <th>Due</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7} message="No tasks." />
          ) : (
            rows.map((x) => (
              <tr key={x.task.id}>
                <td>{x.task.title}</td>
                <td className="text-xs">{FOLLOW_UP_RULE_LABELS[x.task.rule]}</td>
                <td className="text-xs">
                  {x.requirementRef ? (
                    <Link className="link" href={`/requirements/${x.task.requirementId}`}>
                      {x.requirementRef}
                    </Link>
                  ) : null}
                  {x.orderNo ? (
                    <Link className="link" href={`/orders/${x.task.orderId}`}>
                      {x.orderNo}
                    </Link>
                  ) : null}
                  {x.invoiceNo ? <span>{x.invoiceNo}</span> : null}
                  {x.documentTitle ? <span>{x.documentTitle}</span> : null}
                </td>
                <td>{x.ownerName ?? "—"}</td>
                <td>{formatDate(x.task.dueDate)}</td>
                <td>
                  <StatusBadge status={x.task.status} label={FOLLOW_UP_STATUS_LABELS[x.task.status]} />
                </td>
                <td>
                  {x.task.status === "open" ? (
                    <div className="flex flex-wrap gap-1">
                      <form action={completeFollowUpAction}>
                        <input type="hidden" name="taskId" value={x.task.id} />
                        <input type="hidden" name="status" value="done" />
                        <button className="text-xs link" type="submit">
                          done
                        </button>
                      </form>
                      <form action={snoozeFollowUpAction}>
                        <input type="hidden" name="taskId" value={x.task.id} />
                        <input type="hidden" name="days" value="3" />
                        <button className="text-xs link" type="submit">
                          +3d
                        </button>
                      </form>
                      <form action={completeFollowUpAction}>
                        <input type="hidden" name="taskId" value={x.task.id} />
                        <input type="hidden" name="status" value="dismissed" />
                        <button className="text-xs text-slate-500 hover:underline" type="submit">
                          dismiss
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="text-xs muted">{formatDate(x.task.completedAt)}</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Follow-ups</h1>
          <p className="text-sm muted">
            Automatic tasks from rules: no response in 7 days, documents requested, deadlines, payments, expiry.
          </p>
        </div>
        <form action={regenerateFollowUpsAction}>
          <SubmitButton className="btn-secondary">Regenerate tasks</SubmitButton>
        </form>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Open ({open.length})
        </h2>
        <DataState status={open.length === 0 ? "empty" : "ok"} emptyTitle="No open follow-ups" emptyHint="Regenerate tasks to recompute from current data.">
          {renderTable(open)}
        </DataState>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Closed ({closed.length})
        </h2>
        {renderTable(closed)}
      </section>
    </div>
  );
}
