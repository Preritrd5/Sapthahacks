import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/ui/motion-primitives";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Activity logs — Assessor" }, { name: "description", content: "Audit trail of admin actions." }, { property: "og:title", content: "Activity logs — Assessor" }, { property: "og:description", content: "Audit trail of admin actions." }] }),
  component: Activity,
});

function Activity() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const logs = useQuery({
    queryKey: ["activity", user?.id],
    queryFn: async () => (await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const overrides = useQuery({
    queryKey: ["overrides", user?.id],
    queryFn: async () => (await supabase.from("admin_score_overrides").select("*, teams(name)").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  const list = (logs.data ?? []).filter((l) => !q || `${l.action} ${l.details} ${l.actor_email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <FadeIn>
        <PageHeader title="Activity logs" desc="Every admin action and score change is recorded." />
      </FadeIn>
      <Input className="mb-4 w-72" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Admin activity</h3>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
            {logs.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-b border-border/40 pb-2.5 space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              ))
            ) : !list.length ? (
              <p className="text-muted-foreground">No activity yet.</p>
            ) : (
              list.map((l, idx) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                  className="border-b border-border/50 pb-2 hover:bg-muted/20 px-1 rounded transition-colors"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{l.action}</span>
                    <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{l.actor_email}{l.details && ` · ${l.details}`}</div>
                </motion.div>
              ))
            )}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Score changes</h3>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
            {overrides.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-b border-border/40 pb-2.5 space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-3 w-40 rounded" />
                </div>
              ))
            ) : !overrides.data?.length ? (
              <p className="text-muted-foreground">No score edits yet.</p>
            ) : (
              overrides.data?.map((o: any, idx: number) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                  className="border-b border-border/50 pb-2 hover:bg-muted/20 px-1 rounded transition-colors"
                >
                  <div className="flex justify-between">
                    <span>{o.teams?.name} · {o.field}</span>
                    <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{o.previous_value ?? "—"} → {o.new_value ?? "—"}</span> · {o.reason}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
