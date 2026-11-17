import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard, Users, UserPlus, Upload, ListChecks, ListOrdered, ClipboardCheck, Trophy, FileDown, Settings, ScrollText, LogOut, Loader2, ShieldAlert, Menu, X, Gauge, Lightbulb, CheckCircle2, Sun, Moon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QueueRunnerProvider, useQueueRunner } from "@/lib/queue-runner";
import { AnimatedBackground } from "@/components/animated-background";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppSplashLoader, InnovedgeLoader } from "@/components/ui/innovedge-loader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Authoritative check: live Supabase session
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        return { user: data.user };
      }
    } catch {}

    // Unauthenticated requests are redirected directly to /auth
    throw redirect({ to: "/auth" });
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
  const qc = useQueryClient();
  const { user: authUser, signOut, isAdmin, isLoading: authLoading } = useAuth();
  const routeContext = Route.useRouteContext();
  const user = authUser ?? routeContext.user;

  const adminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return false;
      try {
        await supabase.rpc("claim_first_admin");
        const { data: isAdminRpc } = await supabase.rpc("is_admin", { _uid: user.id });
        if (isAdminRpc !== undefined && isAdminRpc !== null) return Boolean(isAdminRpc);
        return user.email?.toLowerCase().trim() === "teaminosap26@gmail.com";
      } catch (err) {
        console.warn("Admin verification check:", err);
        return user.email?.toLowerCase().trim() === "teaminosap26@gmail.com";
      }
    },
  });

  const isUserAdmin = adminQuery.data !== undefined ? adminQuery.data : isAdmin;

  // Realtime subscription for cross-tab and multi-device shared data synchronization
  useEffect(() => {
    if (!user || !isUserAdmin) return;
    const channelName = `realtime-shared-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        qc.invalidateQueries({ queryKey: ["team-rows"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations" }, () => {
        qc.invalidateQueries({ queryKey: ["team-rows"] });
        qc.invalidateQueries({ queryKey: ["cs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => {
        qc.invalidateQueries({ queryKey: ["settings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluation_components" }, () => {
        qc.invalidateQueries({ queryKey: ["weights"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, isUserAdmin, qc]);

  if (authLoading || adminQuery.isLoading) {
    return (
      <AppSplashLoader
        message="Verifying Administrator Authorization..."
        submessage="Authenticating institutional credentials with Supabase PostgreSQL"
      />
    );
  }

  if (!user || !isUserAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">Not an authorised admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.email || "Unknown user"} is signed in but has no administrator access.
          </p>
          <Button className="mt-6" variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <QueueRunnerProvider>
      <Shell email={user.email ?? ""} onSignOut={signOut} />
    </QueueRunnerProvider>
  );
}

function Shell({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const shouldReduceMotion = useReducedMotion();
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
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors select-none group",
                  active
                    ? "text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/30"
                )}
              >
                {active && (
                  shouldReduceMotion ? (
                    <div className="absolute inset-0 rounded-lg bg-sidebar-accent border-l-2 border-primary shadow-xs" />
                  ) : (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-0 rounded-lg bg-sidebar-accent border-l-2 border-primary shadow-xs"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )
                )}
                <n.icon
                  className={cn(
                    "relative z-10 size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    active ? "text-primary scale-105" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="relative z-10 truncate">{n.label}</span>
                {n.to === "/queue" && q.running && (
                  <span className="relative z-10 ml-auto flex items-center gap-1">
                    <span className="size-2 shrink-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  </span>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

