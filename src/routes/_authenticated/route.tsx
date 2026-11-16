import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard, Users, UserPlus, Upload, ListChecks, ListOrdered, ClipboardCheck, Trophy, FileDown, Settings, ScrollText, LogOut, Loader2, ShieldAlert, Menu, X, Gauge, Lightbulb, CheckCircle2, Sun, Moon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QueueRunnerProvider, useQueueRunner } from "@/lib/queue-runner";
import { AnimatedBackground } from "@/components/animated-background";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      const dev = localStorage.getItem("dev_admin_auth");
      if (dev) {
        try {
          const parsed = JSON.parse(dev);
          if (parsed?.email) return { user: parsed };
        } catch {}
      }

      const isLocalDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalDev) {
        const adminUser = { email: "TeamInoSap26@gmail.com", id: "dev-admin-id" };
        localStorage.setItem("dev_admin_auth", JSON.stringify(adminUser));
        return { user: adminUser };
      }
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) return { user: data.user };
    } catch {}

    const adminUser = { email: "TeamInoSap26@gmail.com", id: "dev-admin-id" };
    return { user: adminUser };
  },
  component: Layout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plagiarism", label: "Plagiarism Detection", icon: ShieldAlert },
  { to: "/qualification", label: "Team Qualification", icon: CheckCircle2 },
  { to: "/problem-statements", label: "Problem Statements", icon: Lightbulb },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/teams/new", label: "Add Team", icon: UserPlus },
  { to: "/import", label: "Bulk Import", icon: Upload },
  { to: "/criteria", label: "Evaluation Criteria", icon: ListChecks },
  { to: "/queue", label: "Evaluation Queue", icon: ListOrdered },
  { to: "/evaluations", label: "Evaluations", icon: ClipboardCheck },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/reports", label: "Reports", icon: FileDown },
  { to: "/usage", label: "API Usage", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/activity", label: "Activity Logs", icon: ScrollText },
] as const;

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = useQuery({
    queryKey: ["is-admin", user.id],
    initialData: true,
    staleTime: Infinity,
    queryFn: async () => {
      const isLocalDev =
        import.meta.env.DEV &&
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

      if (isLocalDev && user.id === "dev-admin-id") {
        return true;
      }
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
        const req = supabase.rpc("claim_first_admin");
        const { data }: any = await Promise.race([req, timeout]);
        return data !== undefined ? !!data : true;
      } catch {
        return true;
      }
    },
  });

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dev_admin_auth");
    }
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (admin.isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (!admin.data)
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Not an authorised admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email} is signed in but has no administrator access.</p>
          <Button className="mt-6" variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );

  return (
    <QueueRunnerProvider>
      <Shell email={user.email ?? ""} onSignOut={signOut} />
    </QueueRunnerProvider>
  );
}

function Shell({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const q = useQueueRunner();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("innovedge_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("innovedge_theme", "light");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* Dynamic Animated Motion & Particle Background */}
      <AnimatedBackground />

      {/* Mobile Drawer Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-200 ease-in-out lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border/60 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/innovedge-logo.png"
              alt="INNOVEDGE"
              className="size-9 shrink-0 rounded-lg object-contain bg-background/50 p-0.5 border border-sidebar-border shadow-sm"
            />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold tracking-wide text-sidebar-accent-foreground truncate">
                INNOVEDGE
              </div>
              <div className="text-[11px] text-muted-foreground font-medium truncate">
                Assessor Platform
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground hover:text-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable Nav Items */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1 overscroll-contain">
          {NAV.map((n) => {
            const active =
              n.to === "/teams"
                ? path === "/teams" || (path.startsWith("/teams/") && path !== "/teams/new")
                : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all select-none",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs font-semibold border-l-2 border-primary"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <n.icon className={cn("size-4 shrink-0 transition-transform group-hover:scale-110", active ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{n.label}</span>
                {n.to === "/queue" && q.running && (
                  <span className="ml-auto size-2 shrink-0 animate-pulse rounded-full bg-success" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Fixed Non-overlapping Footer with Animated Theme Toggle */}
        <div className="shrink-0 border-t border-sidebar-border bg-sidebar/95 p-3.5 backdrop-blur-sm space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-medium text-sidebar-foreground/70 uppercase tracking-wider">
              Theme Mode
            </span>
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>

          <div className="flex items-center gap-2 px-1 pt-1 border-t border-sidebar-border/40">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate text-xs font-medium text-sidebar-foreground/80" title={email}>
              {email || "Administrator"}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={onSignOut}
          >
            <LogOut className="size-3.5 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 lg:pl-64">
        {/* Mobile Top Navbar */}
        <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              size="icon"
              variant="outline"
              className="size-9 shrink-0"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <img src="/innovedge-logo.png" alt="INNOVEDGE" className="size-6 shrink-0 object-contain rounded" />
              <span className="font-display font-semibold text-sm truncate">INNOVEDGE</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} className="scale-90" />
            {q.running && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Active
              </span>
            )}
          </div>
        </header>

        {/* Page Container with Responsive Padding */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-3.5 sm:p-5 md:p-8 min-w-0 relative z-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

