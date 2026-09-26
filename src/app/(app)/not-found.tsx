import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card card-pad text-center">
      <h2 className="text-lg font-semibold">Not found</h2>
      <p className="mt-1 text-sm muted">That record does not exist (or was removed).</p>
      <Link className="btn-primary mt-4" href="/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
