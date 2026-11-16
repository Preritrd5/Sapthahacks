import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pause, Play, RotateCw, XCircle, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn, StaggerContainer, StaggerItem, PulsingScanner } from "@/components/ui/motion-primitives";
import { useQueueRunner } from "@/lib/queue-runner";
import { useSettings } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { enqueue, fetchAll, logActivity } from "@/lib/db";
import { getPersistentTeams } from "@/lib/team-store";
import { evaluateAllTeams, runDirectEvaluation } from "@/lib/evaluation-engine";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Evaluation queue — Assessor" },
      { name: "description", content: "Run, pause and monitor AI evaluations." },
      { property: "og:title", content: "Evaluation queue — Assessor" },
      { property: "og:description", content: "Run, pause and monitor AI evaluations." },
    ],
  }),
  component: Queue,
});

function Queue() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const runner = useQueueRunner();
  const settings = useSettings();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ current: 0, total: 0, teamName: "", currentComponent: "" });

  const jobs = useQuery({
    queryKey: ["jobs", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("evaluation_jobs")
          .select("*, teams(name)")
          .order("created_at", { ascending: false })
          .limit(1000)
      ).data ?? [],
    refetchInterval: runner.running || isEvaluating ? 2000 : false,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`jobs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluation_jobs" }, () =>
        qc.invalidateQueries({ queryKey: ["jobs", user?.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
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
    const firstCompLabel = comps.length > 0 && comps[0] ? COMPONENT_LABEL[comps[0]] : "";
    setEvalProgress({ current: 0, total: teams.length, teamName: teams[0]?.name || "", currentComponent: firstCompLabel });

    try {
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        if (!team) continue;
        setEvalProgress({
          current: i + 1,
          total: teams.length,
          teamName: team.name,
          currentComponent: comps.map((c) => COMPONENT_LABEL[c]).join(", "),
        });
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
    const { data } = await supabase
      .from("evaluation_jobs")
      .update({ status: "queued", attempts: 0, error: null })
      .eq("status", "failed")
      .select("id");
    await logActivity("Retried failed jobs", `${data?.length ?? 0}`);
    qc.invalidateQueries();
  };

  const cancelPending = async () => {
    await runner.pause();
    const { data } = await supabase
      .from("evaluation_jobs")
      .update({ status: "cancelled" })
      .eq("status", "queued")
      .select("id");
    await logActivity("Cancelled pending jobs", `${data?.length ?? 0}`);
    qc.invalidateQueries();
  };

  const clearDone = async () => {
    await supabase.from("evaluation_jobs").delete().in("status", ["done", "cancelled"]);
    qc.invalidateQueries();
  };

  const resumeQuota = async () => {
    await supabase.from("system_settings").update({ quota_exhausted: false, quota_message: null }).eq("id", 1);
    await logActivity("Cleared quota stop");
    qc.invalidateQueries();
    toast.success("Quota stop cleared — start the queue to resume");
  };

  const evalPercent = isEvaluating && evalProgress.total
    ? (evalProgress.current / evalProgress.total) * 100
    : total
    ? (finished / total) * 100
    : 0;

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Evaluation Queue"
          desc={`Paced at ${settings.data?.rpm ?? 15} requests/min, ${settings.data?.concurrency ?? 2} concurrent workers.`}
        >
          {runner.running || isEvaluating ? (
            <Button
              variant="secondary"
              onClick={() => {
                runner.pause();
                setIsEvaluating(false);
              }}
            >
              <Pause className="size-4 mr-1.5" /> Pause
            </Button>
          ) : (
            <Button
              onClick={() => startFor(COMPONENTS)}
              disabled={isEvaluating}
              className="bg-primary text-primary-foreground font-semibold"
            >
              <Play className="size-4 mr-1.5 fill-current" /> Run Queue Now
            </Button>
          )}
          <Button variant="secondary" onClick={retryFailed} disabled={!count("failed")}>
            <RotateCw className="size-4 mr-1.5" /> Retry Failed
          </Button>
          <Button variant="ghost" onClick={cancelPending} disabled={!count("queued")}>
            <XCircle className="size-4 mr-1.5" /> Cancel Pending
          </Button>
        </PageHeader>
      </FadeIn>

      {/* Live Direct Evaluation Banner */}
      {isEvaluating && (
        <FadeIn className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-5 shadow-lg backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-primary">
              <Loader2 className="size-4 animate-spin" />
              Live Evaluation in Progress: {evalProgress.teamName}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Team {evalProgress.current} of {evalProgress.total} ({Math.round(evalPercent)}%)
            </span>
          </div>

          <AnimatedProgress value={evalPercent} isProcessing={true} size="md" variant="primary" />

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Target components: {evalProgress.currentComponent}</span>
          </div>
        </FadeIn>
      )}

      {settings.data?.quota_exhausted && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <span>
            <strong>Processing stopped:</strong> {settings.data.quota_message ?? "AI quota exhausted"}. No further AI
            requests will be sent until you resume.
          </span>
          <Button size="sm" variant="secondary" onClick={resumeQuota}>
            Clear & allow resume
          </Button>
        </div>
      )}

      <div className="glass mb-4 rounded-2xl p-5">
        <div className="mb-1 text-sm font-semibold">Select Evaluation Target</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose to evaluate all rubric components or focus on specific elements.
        </p>
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
            {isEvaluating ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Play className="size-4 mr-1.5 fill-current" />}
            {isEvaluating
              ? "Evaluating..."
              : `Run Evaluation (${selectedTarget === "all" ? "All Components" : COMPONENT_LABEL[selectedTarget]})`}
          </Button>
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            {(runner.running || isEvaluating) && <Loader2 className="size-4 animate-spin text-primary" />}
            {isEvaluating
              ? `Evaluating ${evalProgress.teamName}...`
              : runner.running
              ? `Running · ${runner.current} in flight`
              : "Idle"}
          </span>
          <span className="font-mono text-xs font-semibold">
            <AnimatedNumber value={finished} precision={0} /> / <AnimatedNumber value={total} precision={0} /> Completed
          </span>
        </div>

        <AnimatedProgress
          value={evalPercent}
          isProcessing={runner.running || isEvaluating}
          size="md"
          variant="primary"
        />

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
          {["queued", "processing", "done", "failed", "cancelled"].map((s) => (
            <span key={s} className="capitalize">
              {s}:{" "}
              <span className="font-mono font-bold text-foreground">
                <AnimatedNumber value={count(s)} precision={0} />
              </span>
            </span>
          ))}
          <button className="ml-auto text-xs hover:text-foreground underline" onClick={clearDone}>
            Clear finished
          </button>
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
            <tr className="border-b border-border/80">
              <th className="p-3 pl-4">Team</th>
              <th className="p-3">Component</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Attempts</th>
              <th className="p-3">Detail</th>
              <th className="p-3 pr-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Queue is empty.
                </td>
              </tr>
            )}
            {list.slice(0, 300).map((j: any) => (
              <tr key={j.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="p-3 pl-4 font-medium">{j.teams?.name ?? j.team_id}</td>
                <td className="p-3 capitalize">{COMPONENT_LABEL[j.component as Component] ?? j.component}</td>
                <td className="p-3">
                  <StatusBadge status={j.status} />
                </td>
                <td className="p-3 text-center font-mono text-xs">{j.attempts}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{j.error ?? "—"}</td>
                <td className="p-3 pr-4 text-xs font-mono text-muted-foreground">
                  {new Date(j.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
