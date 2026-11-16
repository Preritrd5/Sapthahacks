import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ExternalLink,
  FileText,
  Github,
  Globe,
  Pencil,
  Printer,
  Trash2,
  Play,
  Lightbulb,
  Loader2,
  Trophy,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { EvalCard } from "@/components/eval-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { EvaluationProgressModal } from "@/components/evaluation-progress-modal";
import { ScoreBreakdownModal } from "@/components/score-breakdown-modal";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-primitives";
import { useTeamRows, useWeights } from "@/lib/queries";
import { updatePersistentTeam, deletePersistentTeam, getPersistentMembers } from "@/lib/team-store";
import { DeleteTeamModal } from "@/components/delete-team-modal";
import { TeamReportCard } from "@/components/team-report-card";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { runComprehensivePlagiarismScan } from "@/lib/plagiarism";
import { enqueue, logActivity } from "@/lib/db";
import { useQueueRunner } from "@/lib/queue-runner";
import { runDirectEvaluation, type EvaluationProgress } from "@/lib/evaluation-engine";

export const Route = createFileRoute("/_authenticated/teams/$id/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Team evaluation — Assessor" },
      { name: "description", content: "Team details and evaluation." },
      { property: "og:title", content: "Team evaluation — Assessor" },
      { property: "og:description", content: "Team details and evaluation." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runner = useQueueRunner();
  const rows = useTeamRows();
  const weights = useWeights();
  const shouldReduceMotion = useReducedMotion();
  const t = rows.data?.find((x) => x.id === id);
  const plagiarismMap = useMemo(() => runComprehensivePlagiarismScan(rows.data ?? []), [rows.data]);

  const members = useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", id)
          .order("position");
        if (!error && data && data.length > 0) return data;
      } catch {}
      return getPersistentMembers(id);
    },
  });

  const history = useQuery({
    queryKey: ["history", id],
    queryFn: async () =>
      (
        await supabase
          .from("evaluation_history")
          .select("*")
          .eq("team_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });

  const pdfUrl = useQuery({
    queryKey: ["pdf-url", t?.pdf_path],
    enabled: !!t?.pdf_path,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.storage.from("project-pdfs").createSignedUrl(t!.pdf_path!, 3600);
        if (error) {
          console.warn("Could not generate signed URL for PDF preview:", error.message);
          return null;
        }
        return data?.signedUrl ?? null;
      } catch (err) {
        console.warn("Failed to fetch PDF signed URL:", err);
        return null;
      }
    },
  });

  const [remarks, setRemarks] = useState("");
  const [override, setOverride] = useState("");
  const [reason, setReason] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);

  // Live evaluation modal states
  const [evaluatingAll, setEvaluatingAll] = useState(false);
  const [evalProgress, setEvalProgress] = useState<EvaluationProgress | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  useEffect(() => {
    if (t) {
      setRemarks(t.remarks ?? "");
      setOverride(t.final_override?.toString() ?? "");
      setReason(t.override_reason ?? "");
    }
  }, [t?.id]);

  if (rows.isLoading) return <div className="glass h-96 animate-pulse rounded-2xl" />;
  if (!t) return <p className="p-8 text-center text-muted-foreground">Team not found.</p>;

  const uid = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const setFinal = async (status: "approved" | "rejected" | "pending") => {
    if (status === "approved" && t.approvedFinal == null && !t.final_override)
      return toast.error(
        `Approve all components first (missing: ${t.missing.map((m) => COMPONENT_LABEL[m]).join(", ")}) or set an override.`
      );
    updatePersistentTeam(id, { final_status: status });
    try {
      await supabase.from("teams").update({ final_status: status }).eq("id", id);
      await supabase.from("evaluation_history").insert({
        team_id: id,
        action: `final ${status}`,
        actor: await uid(),
        details: { score: t.officialFinal },
      });
      await logActivity(`Final evaluation ${status}`, t.name);
    } catch {}
    qc.invalidateQueries();
  };

  const saveOverride = async () => {
    const v = override === "" ? null : Number(override);
    if (v != null && (!Number.isFinite(v) || v < 0 || v > 100)) return toast.error("Override must be 0–100");
    if (v != null && !reason.trim()) return toast.error("A reason is required for overrides");
    updatePersistentTeam(id, { final_override: v, override_reason: v == null ? null : reason, remarks });
    try {
      await supabase
        .from("teams")
        .update({ final_override: v, override_reason: v == null ? null : reason, remarks })
        .eq("id", id);
      await supabase.from("admin_score_overrides").insert({
        team_id: id,
        field: "final_score",
        previous_value: t.final_override ?? t.approvedFinal,
        new_value: v,
        reason: v == null ? "Override removed" : reason,
        edited_by: await uid(),
      });
      await supabase.from("evaluation_history").insert({
        team_id: id,
        action: v == null ? "override removed" : "final override",
        actor: await uid(),
        details: { value: v, reason },
      });
    } catch {}
    toast.success("Saved");
    qc.invalidateQueries();
  };

  const evalAll = async () => {
    setEvaluatingAll(true);
    setEvalError(null);
    setShowProgressModal(true);
    setEvalProgress({
      teamId: t.id,
      component: "pdf",
      status: "processing",
      progressPct: 10,
      message: `Starting live multi-modal evaluation for ${t.name}...`,
    });

    try {
      await runDirectEvaluation(t, [...COMPONENTS], {
        forceRerun: true,
        onProgress: (p) => setEvalProgress(p),
      });
      toast.success(`Evaluations completed for ${t.name}!`);
      qc.invalidateQueries();
    } catch (err: any) {
      setEvalError(err?.message || "Failed to run evaluation");
      toast.error(err?.message || "Failed to run evaluation");
    } finally {
      setEvaluatingAll(false);
    }
  };

  const finalScoreValue = t.officialFinal ?? t.aiFinal;
  const scorePercent = finalScoreValue != null ? Math.min(100, Math.max(0, finalScoreValue)) : 0;

  return (
    <>
      <FadeIn>
        <PageHeader title={t.name} desc={t.project_title ?? undefined}>
          <Button
            variant="default"
            className="bg-primary text-primary-foreground font-semibold"
            onClick={evalAll}
            disabled={evaluatingAll}
          >
            {evaluatingAll ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Play className="size-4 mr-1.5 fill-current" />}
            {evaluatingAll ? "Evaluating…" : "Evaluate all"}
          </Button>
          <Button variant="secondary" onClick={() => setShowReportCard(true)}>
            <Printer className="size-4 mr-1.5" /> PDF report
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/teams/$id/edit" params={{ id }}>
              <Pencil className="size-4 mr-1.5" /> Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            onClick={() => setShowDeleteModal(true)}
            title="Delete team"
          >
            <Trash2 className="size-4 mr-1.5" />
            <span>Delete Team</span>
          </Button>
        </PageHeader>
      </FadeIn>

      <StaggerContainer className="grid gap-4 lg:grid-cols-3">
        {/* Team & Project Overview Card */}
        <StaggerItem className="glass rounded-2xl p-5 lg:col-span-2">
          {t.project_title && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary">
              <Lightbulb className="size-3.5" />
              <span>Problem Statement: {t.project_title}</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {t.project_description || "No description provided."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {t.email && <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-mono">{t.email}</span>}
            {t.github_url && (
              <a
                href={t.github_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs hover:text-primary transition-colors"
              >
                <Github className="size-3.5" /> Repository <ExternalLink className="size-3" />
              </a>
            )}
            {t.website_url && (
              <a
                href={t.website_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs hover:text-primary transition-colors"
              >
                <Globe className="size-3.5" /> Website <ExternalLink className="size-3" />
              </a>
            )}
            {t.pdf_path ? (
              <button
                onClick={() => setShowPdf(!showPdf)}
                className="no-print flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs hover:text-primary transition-colors"
              >
                <FileText className="size-3.5 text-rose-500" /> {showPdf ? "Hide" : "Preview"} PDF
              </button>
            ) : (
              <span className="rounded-lg bg-warning/10 px-2.5 py-1 text-xs text-warning border border-warning/20">
                No PDF
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Team Members ({members.data?.length ?? 0})
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {members.data?.map((m: any, idx: number) => (
                <span
                  key={m.id || idx}
                  className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 text-xs font-medium"
                >
                  {m.name}
                  {m.email && <span className="text-muted-foreground font-normal"> · {m.email}</span>}
                </span>
              ))}
            </div>
          </div>
        </StaggerItem>

        {/* Overall Score Card */}
        <StaggerItem className="glass rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <span>Overall Certified Score</span>
              <Trophy className="size-4 text-primary" />
            </div>

            <div className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground flex items-baseline">
              <AnimatedNumber value={finalScoreValue} precision={1} duration={1} />
              <span className="text-lg font-normal text-muted-foreground ml-1.5">/ 100</span>
            </div>

            <div className="mt-3">
              <AnimatedProgress value={scorePercent} size="sm" variant="primary" />
            </div>

            <div className="mt-3 space-y-1 text-xs text-muted-foreground font-mono">
              <div className="flex justify-between">
                <span className="font-sans">AI-generated:</span>
                <span>{fmt(t.aiFinal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans">Admin-approved:</span>
                <span>
                  {t.approvedFinal != null
                    ? fmt(t.approvedFinal)
                    : `Incomplete`}
                </span>
              </div>
              {t.final_override != null && (
                <div className="text-violet flex justify-between font-sans">
                  <span>Override: {fmt(t.final_override)}</span>
                  <span className="text-[10px] truncate max-w-[120px]" title={t.override_reason ?? ""}>
                    ({t.override_reason})
                  </span>
                </div>
              )}
              <div className="pt-1 text-[11px] text-muted-foreground/80 font-sans border-t border-border/40">
                Weights: PDF {weights.data?.pdf}% · GitHub {weights.data?.github}% · Website {weights.data?.website}%
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status:</span>
              <StatusBadge status={t.final_status} />
            </div>

            <div className="no-print flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setFinal("approved")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 text-xs"
                onClick={() => setFinal("rejected")}
              >
                Reject
              </Button>
              {t.final_status !== "pending" && (
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setFinal("pending")}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* PDF Document Preview Collapsible */}
      <AnimatePresence>
        {showPdf && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="no-print mt-4 rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm flex items-center gap-2">
                <FileText className="size-4 text-rose-500" /> Project PDF Document Preview
              </span>
              {pdfUrl.data && (
                <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                  <a href={pdfUrl.data} target="_blank" rel="noreferrer">
                    Open PDF File
                  </a>
                </Button>
              )}
            </div>
            {pdfUrl.data && (
              <iframe
                title="PDF"
                src={pdfUrl.data}
                className="h-[65vh] w-full rounded-xl border border-border"
              />
            )}
            {t.pdf_text && (
              <div className="rounded-xl bg-muted/30 p-3 border border-border/40">
                <div className="text-xs font-bold uppercase text-muted-foreground mb-1.5">
                  Extracted Document Text
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed select-text text-foreground/90">
                  {t.pdf_text}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Component Evaluation Cards Grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {COMPONENTS.map((c) => (
          <EvalCard key={c} teamId={id} component={c} evaluation={t.evals?.[c]} />
        ))}
      </div>

      {/* Remarks, Overrides, and Evaluation History */}
      <div className="no-print mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass space-y-3 rounded-2xl p-5">
          <h3 className="font-semibold text-sm">Remarks & Final Override</h3>
          <Textarea
            placeholder="Admin remarks and observations"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="text-xs min-h-[80px]"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Override (0–100)"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Reason for override"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <Button size="sm" onClick={saveOverride} className="text-xs font-semibold">
            Save Remarks & Override
          </Button>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-sm">Evaluation Audit Trail</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs pr-1">
            {!history.data?.length && <p className="text-muted-foreground">No history records yet.</p>}
            {history.data?.map((h) => (
              <div key={h.id} className="flex gap-3 border-b border-border/40 pb-2">
                <span className="w-28 shrink-0 text-muted-foreground font-mono text-[11px]">
                  {new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium capitalize text-foreground">{h.action}</span>
                  {h.component && (
                    <span className="text-muted-foreground"> · {COMPONENT_LABEL[h.component as "pdf"]}</span>
                  )}
                  {h.details && (
                    <span className="block text-muted-foreground text-[11px] truncate">
                      {summarize(h.details)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Evaluation Progress & Completion Modal */}
      <EvaluationProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        team={t}
        isEvaluating={evaluatingAll}
        progress={evalProgress}
        error={evalError}
        onRetry={evalAll}
        onViewBreakdown={() => setShowBreakdownModal(true)}
      />

      {/* Detailed Score Breakdown Modal */}
      <ScoreBreakdownModal
        team={t}
        isOpen={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
      />

      {/* Delete Team Modal */}
      <DeleteTeamModal
        team={t}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => navigate({ to: "/teams" })}
      />

      {/* 1-Page Official Scorecard / Report Modal */}
      <TeamReportCard
        team={t}
        isOpen={showReportCard}
        onClose={() => setShowReportCard(false)}
        plagiarismScore={t ? plagiarismMap.get(t.id)?.overallSimilarity : undefined}
        plagiarismResult={t ? plagiarismMap.get(t.id) : undefined}
      />
    </>
  );
}

function summarize(d: any) {
  if (d.criterion)
    return `${d.criterion}${d.previous != null ? `: ${d.previous} → ${d.new}` : ""}${d.reason ? ` (${d.reason})` : ""}`;
  if (d.ai_score != null) return `AI score ${d.ai_score}/${d.max}`;
  if (d.value !== undefined) return `Value ${d.value ?? "none"}${d.reason ? ` — ${d.reason}` : ""}`;
  return "";
}
