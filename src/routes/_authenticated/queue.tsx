import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pause, Play, RotateCw, XCircle, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQueueRunner } from "@/lib/queue-runner";
import { useSettings } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { enqueue, fetchAll, logActivity } from "@/lib/db";
import { getPersistentTeams } from "@/lib/team-store";
import { evaluateAllTeams, runDirectEvaluation } from "@/lib/evaluation-engine";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Evaluation queue — Assessor" }, { name: "description", content: "Run, pause and monitor AI evaluations." }, { property: "og:title", content: "Evaluation queue — Assessor" }, { property: "og:description", content: "Run, pause and monitor AI evaluations." }] }),
  component: Queue,
});

function Queue() {
  const qc = useQueryClient();
  const runner = useQueueRunner();
  const settings = useSettings();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ current: 0, total: 0, teamName: "" });

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => (await supabase.from("evaluation_jobs").select("*, teams(name)").order("created_at", { ascending: false }).limit(1000)).data ?? [],
    refetchInterval: runner.running || isEvaluating ? 2000 : false,
  });
  useEffect(() => {
    const ch = supabase.channel(`jobs-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "evaluation_jobs" }, () => qc.invalidateQueries({ queryKey: ["jobs"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const list = jobs.data ?? [];
  const count = (s: string) => list.filter((j) => j.status === s).length;
  const total = list.length;
  const finished = count("done") + count("failed") + count("cancelled");

  const [selectedTarget, setSelectedTarget] = useState<"all" | Component>("all");

  const startFor = async (comps: Component[]) => {
    setIsEvaluating(true);
    const teams = getPersistentTeams();
    if (!teams.length) {
      setIsEvaluating(false);
      return toast.error("No teams registered yet.");
    }

    toast.info(`Starting evaluation of ${teams.length} team(s) across ${comps.map((c) => COMPONENT_LABEL[c]).join(", ")}...`);

    setEvalProgress({ current: 0, total: teams.length, teamName: teams[0]?.name || "" });

    try {
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        setEvalProgress({ current: i + 1, total: teams.length, teamName: team.name });
        await runDirectEvaluation(team, comps);
        qc.invalidateQueries();
      }
      toast.success(`Evaluation complete for ${teams.length} teams!`);
    } catch (err: any) {
      toast.error(`Evaluation error: ${err?.message || "Unknown error"}`);
    } finally {
      setIsEvaluating(false);
      qc.invalidateQueries();
    }
  };

  const handleRunEvaluation = () => {
    if (selectedTarget === "all") {
      startFor(COMPONENTS);
    } else {
      startFor([selectedTarget]);
    }
  };
  const retryFailed = async () => {
    const { data } = await supabase.from("evaluation_jobs").update({ status: "queued", attempts: 0, error: null }).eq("status", "failed").select("id");
    await logActivity("Retried failed jobs", `${data?.length ?? 0}`);
    qc.invalidateQueries();
  };
  const cancelPending = async () => {
    await runner.pause();
    const { data } = await supabase.from("evaluation_jobs").update({ status: "cancelled" }).eq("status", "queued").select("id");
    await logActivity("Cancelled pending jobs", `${data?.length ?? 0}`);
    qc.invalidateQueries();
  };
  const clearDone = async () => { await supabase.from("evaluation_jobs").delete().in("status", ["done", "cancelled"]); qc.invalidateQueries(); };
  const resumeQuota = async () => {
    await supabase.from("system_settings").update({ quota_exhausted: false, quota_message: null }).eq("id", 1);
    await logActivity("Cleared quota stop");
    qc.invalidateQueries();
    toast.success("Quota stop cleared — start the queue to resume");
  };

  return (
    <>
      <PageHeader title="Evaluation queue" desc={`Paced at ${settings.data?.rpm ?? 15} requests/min, ${settings.data?.concurrency ?? 2} at a time.`}>
        {runner.running || isEvaluating ? <Button variant="secondary" onClick={() => { runner.pause(); setIsEvaluating(false); }}><Pause className="size-4" />Pause</Button> : <Button onClick={() => startFor(COMPONENTS)} disabled={isEvaluating}><Play className="size-4" />Run queue now</Button>}
        <Button variant="secondary" onClick={retryFailed} disabled={!count("failed")}><RotateCw className="size-4" />Retry failed</Button>
        <Button variant="ghost" onClick={cancelPending} disabled={!count("queued")}><XCircle className="size-4" />Cancel pending</Button>
      </PageHeader>

      {/* Live Direct Evaluation Banner */}
      {isEvaluating && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-primary">
              <Loader2 className="size-4 animate-spin" />
              Live Evaluation in Progress: {evalProgress.teamName}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Team {evalProgress.current} of {evalProgress.total}
            </span>
          </div>
          <Progress
            className="mt-3 h-2"
            value={evalProgress.total ? (evalProgress.current / evalProgress.total) * 100 : 0}
          />
        </div>
      )}

      {settings.data?.quota_exhausted && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <span><strong>Processing stopped:</strong> {settings.data.quota_message ?? "AI quota exhausted"}. No further AI requests will be sent until you resume.</span>
          <Button size="sm" variant="secondary" onClick={resumeQuota}>Clear & allow resume</Button>
        </div>
      )}

      <div className="glass mb-4 rounded-2xl p-5">
        <div className="mb-2 text-sm font-medium">Select Evaluation Target</div>
        <p className="mb-3 text-xs text-muted-foreground">Click a component to target. Evaluations will only run when you explicitly click "Run Evaluation".</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedTarget === "all" ? "default" : "secondary"}
            onClick={() => setSelectedTarget("all")}
            type="button"
            className={selectedTarget === "all" ? "bg-primary text-primary-foreground font-semibold" : ""}
          >
            All components
          </Button>
          {COMPONENTS.map((c) => (
            <Button
              key={c}
              variant={selectedTarget === c ? "default" : "secondary"}
              onClick={() => setSelectedTarget(c)}
              type="button"
              className={selectedTarget === c ? "bg-primary text-primary-foreground font-semibold" : ""}
            >
              {COMPONENT_LABEL[c]} only
            </Button>
          ))}
          <Button
            onClick={handleRunEvaluation}
            disabled={isEvaluating}
            className="ml-auto bg-gradient-to-r from-terracotta to-amber-600 text-white font-bold shadow-md hover:opacity-95"
          >
            {isEvaluating ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Play className="size-4 mr-1.5" />}
            {isEvaluating
              ? "Evaluating..."
              : `Run Evaluation (${selectedTarget === "all" ? "All Components" : COMPONENT_LABEL[selectedTarget]})`}
          </Button>
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {(runner.running || isEvaluating) && <Loader2 className="size-4 animate-spin text-primary" />}
            {isEvaluating ? `Evaluating ${evalProgress.teamName}...` : runner.running ? `Running · ${runner.current} in flight` : "Idle"}
          </span>
          <span className="font-mono">{finished}/{total}</span>
        </div>
        <Progress className="mt-3" value={total ? (finished / total) * 100 : isEvaluating ? (evalProgress.current / evalProgress.total) * 100 : 0} />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {["queued", "processing", "done", "failed", "cancelled"].map((s) => <span key={s} className="capitalize">{s}: <span className="font-mono text-foreground">{count(s)}</span></span>)}
          <button className="ml-auto hover:text-foreground" onClick={clearDone}>Clear finished</button>
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Team</th><th className="p-3">Component</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Detail</th><th className="p-3">Updated</th></tr></thead>
          <tbody>
            {!list.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Queue is empty.</td></tr>}
            {list.slice(0, 300).map((j: any) => (
              <tr key={j.id} className="border-b border-border/50">
                <td className="p-3"><Link to="/teams/$id" params={{ id: j.team_id }} className="hover:text-primary">{j.teams?.name}</Link></td>
                <td className="p-3">{COMPONENT_LABEL[j.component as Component]}</td>
                <td className="p-3"><StatusBadge status={j.status} /></td>
                <td className="p-3 font-mono">{j.attempts}</td>
                <td className="max-w-80 truncate p-3 text-xs text-muted-foreground" title={j.error ?? ""}>{j.error}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(j.updated_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
