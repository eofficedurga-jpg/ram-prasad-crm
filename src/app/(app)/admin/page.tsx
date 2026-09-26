import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDbAsync } from "@/db/client";
import * as t from "@/db/schema";
import { createUserAction, decideApprovalAction, updateUserRoleAction } from "@/app/actions/admin";
import { DataState, EmptyRow, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { APPROVAL_ENTITY_LABELS, LOSS_REASON_LABELS, ROLE_LABELS } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePermission("audit:view");
  const db = await getDbAsync();

  const [approvals, users, audits, lossReasons] = await Promise.all([
    db
      .select({ approval: t.approvalRequests, requirementRef: t.requirements.ref, requester: t.users.name })
      .from(t.approvalRequests)
      .leftJoin(t.requirements, eq(t.requirements.id, t.approvalRequests.requirementId))
      .leftJoin(t.users, eq(t.users.id, t.approvalRequests.requestedBy))
      .orderBy(desc(t.approvalRequests.requestedAt)),
    db.select().from(t.users).orderBy(asc(t.users.name)),
    db
      .select({ audit: t.auditLogs, actor: t.users.name })
      .from(t.auditLogs)
      .leftJoin(t.users, eq(t.users.id, t.auditLogs.actorUserId))
      .orderBy(desc(t.auditLogs.createdAt))
      .limit(100),
    db.select().from(t.lossReasons).orderBy(asc(t.lossReasons.sort)),
  ]);

  const pending = approvals.filter((a) => a.approval.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm muted">Approvals, roles, loss-reason reference data and the audit trail.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Approval queue ({pending.length} pending)
        </h2>
        <DataState status={approvals.length === 0 ? "empty" : "ok"} emptyTitle="No approval requests">
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Requirement</th>
                  <th>Requested by</th>
                  <th>Comment / payload</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <EmptyRow colSpan={7} message="No approvals." />
                ) : (
                  approvals.map((a) => (
                    <tr key={a.approval.id}>
                      <td>{APPROVAL_ENTITY_LABELS[a.approval.entityType] ?? a.approval.entityType}</td>
                      <td className="font-mono text-xs">#{a.approval.entityId}</td>
                      <td className="text-xs">
                        {a.requirementRef ? (
                          <Link className="link" href={`/requirements/${a.approval.requirementId}`}>
                            {a.requirementRef}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-xs">{a.requester ?? "—"}</td>
                      <td className="text-xs">{a.approval.comment ?? JSON.stringify(a.approval.payload) ?? "—"}</td>
                      <td>
                        <StatusBadge status={a.approval.status} />
                      </td>
                      <td>
                        {a.approval.status === "pending" ? (
                          <div className="flex flex-wrap gap-1">
                            <form action={decideApprovalAction} className="flex gap-1">
                              <input type="hidden" name="approvalId" value={a.approval.id} />
                              <input type="hidden" name="decision" value="approve" />
                              <input className="input w-32 text-xs" name="comment" placeholder="comment" />
                              <button className="btn-primary text-xs" type="submit">
                                approve
                              </button>
                            </form>
                            <form action={decideApprovalAction}>
                              <input type="hidden" name="approvalId" value={a.approval.id} />
                              <input type="hidden" name="decision" value="reject" />
                              <button className="btn-danger text-xs" type="submit">
                                reject
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs muted">{formatDateTime(a.approval.decidedAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="card-title mb-3">Users & roles</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="font-mono text-xs">{u.email}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.active ? "yes" : "no"}</td>
                  <td>
                    <form action={updateUserRoleAction} className="flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <select className="input w-28 text-xs" name="role" defaultValue={u.role}>
                        {Object.entries(ROLE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <select className="input w-20 text-xs" name="active" defaultValue={String(u.active)}>
                        <option value="true">active</option>
                        <option value="false">off</option>
                      </select>
                      <button className="text-xs link" type="submit">
                        set
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={createUserAction} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className="input" name="name" placeholder="Name" required />
            <input className="input" name="email" type="email" placeholder="Email" required />
            <input className="input" name="password" type="password" placeholder="Password" required />
            <select className="input" name="role" defaultValue="sales">
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <SubmitButton className="btn-secondary">Add user</SubmitButton>
            </div>
          </form>
        </section>

        <section className="card card-pad">
          <h2 className="card-title mb-3">Loss-reason reference data</h2>
          <ul className="space-y-1 text-sm">
            {lossReasons.map((l) => (
              <li key={l.id} className="flex items-center justify-between">
                <span>{l.label}</span>
                <span className="font-mono text-xs muted">{l.code}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs muted">
            Labels are editable reference data so his actual vocabulary can replace them without code changes.
          </p>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Audit trail (latest 100)</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Before → After</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <EmptyRow colSpan={6} message="No audit entries." />
              ) : (
                audits.map((a) => (
                  <tr key={a.audit.id}>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(a.audit.createdAt)}</td>
                    <td className="text-xs">
                      {a.audit.entityType} #{a.audit.entityId}
                    </td>
                    <td className="text-xs font-medium">{a.audit.action}</td>
                    <td className="text-xs">
                      {a.actor ?? "—"}
                      {a.audit.actorRole ? <span className="muted"> ({a.audit.actorRole})</span> : null}
                    </td>
                    <td className="max-w-[240px] truncate text-xs muted">
                      {a.audit.before ? JSON.stringify(a.audit.before) : "—"} →{" "}
                      {a.audit.after ? JSON.stringify(a.audit.after) : "—"}
                    </td>
                    <td className="text-xs">{a.audit.reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
