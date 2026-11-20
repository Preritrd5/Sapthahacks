import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pause, Play, RotateCw, XCircle, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { InnovedgeLoader } from "@/components/ui/innovedge-loader";
import { FadeIn, StaggerContainer, StaggerItem, PulsingScanner, Magnetic, BorderBeam, MagicCard, NumberTicker, ShimmerButton } from "@/components/ui/motion-primitives";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { FileText, Github, Globe, Award } from "lucide-react";
import { useQueueRunner } from "@/lib/queue-runner";
import { useSettings, type TeamRow, type Team } from "@/lib/queries";
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
    let teams: TeamRow[] = [];
    try {
      const dbTeams = await fetchAll<Team>("teams");
      if (dbTeams && dbTeams.length > 0) {
        teams = dbTeams.map((t) => ({
          ...t,
          evals: {},
          aiFinal: null,
          approvedFinal: null,
          officialFinal: t.final_override ?? null,
          missing: [...COMPONENTS],
          overall: "pending",
        }));
      }
    } catch {}

    if (!teams.length) {
      teams = getPersistentTeams();
    }

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
        await runDirectEvaluation(team, comps, { forceRerun: true });
        qc.invalidateQueries({ queryKey: ["team-rows"] });
        qc.invalidateQueries({ queryKey: ["team-evaluation", team.id] });
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
            <Magnetic strength={4}>
              <Button
                variant="secondary"
                onClick={() => {
                  runner.pause();
                  setIsEvaluating(false);
                }}
              >
                <Pause className="size-4 mr-1.5" /> Pause
              </Button>
            </Magnetic>
          ) : (
            <Magnetic strength={4}>
              <Button
                onClick={() => startFor(COMPONENTS)}
                disabled={isEvaluating}
                className="bg-primary text-primary-foreground font-semibold"
              >
                <Play className="size-4 mr-1.5 fill-current" /> Run Queue Now
              </Button>
            </Magnetic>
          )}
          <Magnetic strength={4}>
            <Button variant="secondary" onClick={retryFailed} disabled={!count("failed")}>
              <RotateCw className="size-4 mr-1.5" /> Retry Failed
            </Button>
          </Magnetic>
          <Button variant="ghost" onClick={cancelPending} disabled={!count("queued")}>
            <XCircle className="size-4 mr-1.5" /> Cancel Pending
          </Button>
        </PageHeader>
      </FadeIn>

      {/* Top 4 Realtime Queue Stat Cards */}
      <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <StaggerItem>
          <MagicCard
            gradientColor="rgba(245, 158, 11, 0.2)"
            gradientFrom="rgba(245, 158, 11, 0.35)"
            gradientTo="rgba(217, 119, 6, 0.15)"
            className="p-4 border-border/80 group"
          >
            <div className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Queued Jobs</span>
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-500">
              <NumberTicker value={count("queued")} decimalPlaces={0} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Awaiting worker pickup</div>
          </MagicCard>
        </StaggerItem>

        <StaggerItem>
          <MagicCard
            gradientColor="rgba(56, 189, 248, 0.22)"
            gradientFrom="rgba(56, 189, 248, 0.4)"
            gradientTo="rgba(14, 165, 233, 0.15)"
            className="p-4 border-sky-500/25 bg-sky-500/5 group"
          >
            <div className="text-[11px] font-semibold uppercase text-sky-500 flex items-center justify-between">
              <span>In Flight / Active</span>
              <Loader2 className={`size-3.5 text-sky-500 ${runner.running || isEvaluating ? "animate-spin" : ""}`} />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-sky-500">
              <NumberTicker value={count("processing")} decimalPlaces={0} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Active parallel workers</div>
          </MagicCard>
        </StaggerItem>

        <StaggerItem>
          <MagicCard
            gradientColor="rgba(16, 185, 129, 0.22)"
            gradientFrom="rgba(16, 185, 129, 0.4)"
            gradientTo="rgba(5, 150, 105, 0.15)"
            className="p-4 border-emerald-500/25 bg-emerald-500/5 group"
          >
            <div className="text-[11px] font-semibold uppercase text-emerald-500 flex items-center justify-between">
              <span>Completed Jobs</span>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-500">
              <NumberTicker value={count("done")} decimalPlaces={0} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Evaluated & saved</div>
          </MagicCard>
        </StaggerItem>

        <StaggerItem>
          <MagicCard
            gradientColor="rgba(244, 63, 94, 0.22)"
            gradientFrom="rgba(244, 63, 94, 0.4)"
            gradientTo="rgba(225, 29, 72, 0.15)"
            className="p-4 border-rose-500/25 bg-rose-500/5 group"
          >
            <div className="text-[11px] font-semibold uppercase text-rose-500 flex items-center justify-between">
              <span>Failed / Needs Retry</span>
              <XCircle className="size-3.5 text-rose-500" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-rose-500">
              <NumberTicker value={count("failed")} decimalPlaces={0} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Automated fallback available</div>
          </MagicCard>
        </StaggerItem>
      </StaggerContainer>

      {/* Multi-Modal AI Evaluation Pipeline Visualizer */}
      <FadeIn className="mb-5 rounded-2xl border border-border/80 bg-card/85 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Multi-Modal AI Pipeline Architecture</span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground uppercase bg-muted/60 px-2 py-0.5 rounded border border-border/40">
            gemini-3.1-flash-lite engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
          {/* Stage 1: PDF Deck */}
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 relative overflow-hidden group hover:border-rose-500/50 transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Stage 1 · 30%</span>
              <FileText className="size-3.5 text-rose-500" />
            </div>
            <div className="text-xs font-bold text-foreground">Project PDF Deck</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Multi-page PDF extraction, problem alignment & novelty.
            </div>
          </div>

          {/* Stage 2: GitHub Code */}
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 relative overflow-hidden group hover:border-sky-500/50 transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Stage 2 · 40%</span>
              <Github className="size-3.5 text-sky-500" />
            </div>
            <div className="text-xs font-bold text-foreground">GitHub Code Analysis</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              AST parsing, repo architecture, DRY & modularity.
            </div>
          </div>

          {/* Stage 3: Website */}
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Stage 3 · 30%</span>
              <Globe className="size-3.5 text-emerald-500" />
            </div>
            <div className="text-xs font-bold text-foreground">Live Web Application</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Responsiveness, interactivity & UI design polish.
            </div>
          </div>

          {/* Stage 4: Certified Scorecard */}
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 relative overflow-hidden group hover:border-primary/60 transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Final Output</span>
              <Award className="size-3.5 text-primary" />
            </div>
            <div className="text-xs font-bold text-foreground">Official Scorecard</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Weighted aggregate score & 1-page certified report.
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Live Direct Evaluation Banner */}
      {isEvaluating && (
        <FadeIn className="relative overflow-hidden mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-5 shadow-lg backdrop-blur-md space-y-3">
          <BorderBeam colorFrom="#d95a2b" colorTo="#f59e0b" duration={4} borderWidth={1.5} borderRadius={16} />
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
          <Magnetic strength={4}>
            <Button
              onClick={handleRunEvaluation}
              disabled={isEvaluating}
              variant={isEvaluating ? "default" : "shimmer"}
              className="ml-auto font-bold shadow-md hover:opacity-95"
            >
              {isEvaluating ? <InnovedgeLoader size="xs" /> : <Play className="size-4 mr-1.5 fill-current" />}
              {isEvaluating
                ? "Evaluating..."
                : `Run Evaluation (${selectedTarget === "all" ? "All Components" : COMPONENT_LABEL[selectedTarget]})`}
            </Button>
          </Magnetic>
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            {(runner.running || isEvaluating) && <InnovedgeLoader size="xs" />}
            {isEvaluating
              ? `Evaluating ${evalProgress.teamName}...`
              : runner.running
              ? `Running · ${runner.current} in flight`
              : "Idle"}
          </span>
          <span className="font-mono text-xs font-semibold">
            {isEvaluating && evalProgress.total ? (
              <>
                <AnimatedNumber value={evalProgress.current} precision={0} /> /{" "}
                <AnimatedNumber value={evalProgress.total} precision={0} /> Teams Completed
              </>
            ) : (
              <>
                <AnimatedNumber value={finished} precision={0} /> /{" "}
                <AnimatedNumber value={total} precision={0} /> Completed
              </>
            )}
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

      {jobs.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
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
      )}
    </>
  );
}
