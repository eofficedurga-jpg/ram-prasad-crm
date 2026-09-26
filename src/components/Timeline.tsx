import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "./ui";

export type TimelineEvent = {
  at: Date | string;
  title: string;
  detail?: string | null;
  actor?: string | null;
  status?: string | null;
  group?: string | null;
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm muted">
        No history recorded yet.
      </p>
    );
  }
  const sorted = [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {sorted.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs muted">{formatDateTime(e.at)}</span>
            {e.group ? (
              <span className="badge bg-slate-100 text-slate-600">{e.group}</span>
            ) : null}
            {e.status ? <StatusBadge status={e.status} /> : null}
          </div>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{e.title}</p>
          {e.detail ? <p className="text-sm muted">{e.detail}</p> : null}
          {e.actor ? <p className="text-xs muted">by {e.actor}</p> : null}
        </li>
      ))}
    </ol>
  );
}
