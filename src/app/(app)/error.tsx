"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card card-pad">
      <h2 className="text-lg font-semibold text-red-700">Something failed to load</h2>
      <p className="mt-1 text-sm muted">
        This is a failed state, not an empty one. The page did not render the requested data.
      </p>
      <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
        {error.message}
      </pre>
      <button className="btn-primary mt-3" onClick={() => reset()}>
        Retry
      </button>
    </div>
  );
}
