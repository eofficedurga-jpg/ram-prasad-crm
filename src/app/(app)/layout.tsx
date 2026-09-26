import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { logoutAction } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/enums";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">Ram Prasad CRM</span>
            <span className="hidden text-xs muted sm:inline">one requirement · one record · one timeline</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <p className="font-medium text-slate-700">{user.name}</p>
              <p className="muted">{ROLE_LABELS[user.role] ?? user.role}</p>
            </div>
            <form action={logoutAction}>
              <button className="btn-secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-3">
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
