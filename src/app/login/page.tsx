import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/auth";

const DEMO = [
  { email: "owner@ramprasad.in", role: "Owner / management" },
  { email: "sales@ramprasad.in", role: "Sales" },
  { email: "ops@ramprasad.in", role: "Operations" },
  { email: "finance@ramprasad.in", role: "Finance" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Ram Prasad CRM</h1>
          <p className="mt-1 text-sm muted">Defence contract consultancy</p>
        </div>
        <form action={loginAction} className="card card-pad space-y-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error === "missing"
                ? "Enter your email and password."
                : "Invalid email or password."}
            </p>
          ) : null}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              defaultValue="owner@ramprasad.in"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              defaultValue="password123"
              required
            />
          </div>
          <button className="btn-primary w-full" type="submit">
            Sign in
          </button>
        </form>
        <div className="card mt-4 card-pad">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Demo accounts · password123
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {DEMO.map((d) => (
              <li key={d.email} className="flex justify-between gap-3">
                <span className="font-mono text-xs">{d.email}</span>
                <span className="muted">{d.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
