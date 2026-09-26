export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
      <p className="text-center text-sm muted">Loading from Postgres…</p>
    </div>
  );
}
