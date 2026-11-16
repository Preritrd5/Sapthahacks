import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle, Loader2, ShieldCheck, XCircle } from "lucide-react";

export function PageHeader({ title, desc, children }: { title: string; desc?: string | undefined; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3.5 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{desc}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2 w-full sm:w-auto">{children}</div>}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = status.toLowerCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case "processing":
      case "evaluating":
        return {
          classes: "bg-primary/15 text-primary border border-primary/30",
          icon: <Loader2 className="size-3 animate-spin mr-1" />,
        };
      case "completed":
        return {
          classes: "bg-violet/15 text-violet border border-violet/30",
          icon: <CheckCircle2 className="size-3 mr-1" />,
        };
      case "approved":
      case "done":
        return {
          classes: "bg-success/15 text-success border border-success/30",
          icon: <ShieldCheck className="size-3 mr-1" />,
        };
      case "failed":
      case "rejected":
        return {
          classes: "bg-destructive/15 text-destructive border border-destructive/30",
          icon: <XCircle className="size-3 mr-1" />,
        };
      case "stale":
      case "needs review":
        return {
          classes: "bg-warning/15 text-warning border border-warning/30",
          icon: <AlertTriangle className="size-3 mr-1" />,
        };
      case "pending":
      case "queued":
      case "cancelled":
      case "not started":
      default:
        return {
          classes: "bg-muted/80 text-muted-foreground border border-border/50",
          icon: <Clock className="size-3 mr-1 opacity-70" />,
        };
    }
  };

  const { classes, icon } = getStatusConfig();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize transition-all duration-300 shadow-xs",
        classes,
        className
      )}
    >
      {icon}
      <span>{status}</span>
    </span>
  );
}

export function Empty({ title, desc, children }: { title: string; desc?: string | undefined; children?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <p className="font-display font-medium">{title}</p>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export const fmt = (n: number | null | undefined, d = 1) => (n == null ? "—" : Number(n).toFixed(d).replace(/\.0+$/, ""));
