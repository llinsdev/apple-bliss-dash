import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, ListPlus, Target, User, LogOut, Store, ShieldCheck,
} from "lucide-react";
import { authApi } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const baseItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Lançamentos", icon: ListPlus },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();

  const items = isAdmin
    ? [...baseItems, { to: "/admin" as const, label: "Admin", icon: ShieldCheck }]
    : baseItems;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm tracking-wide text-foreground">VM STORE</div>
            <div className="text-xs text-muted-foreground">Dashboard</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await authApi.signOut();
            navigate({ to: "/" });
          }}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>
    </div>
  );
}
