import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-primitives";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/skeleton";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { EvaluationProgressModal } from "@/components/evaluation-progress-modal";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import {
  FileText,
  Eye,
  Search,
  FileDown,
  Play,
  Loader2,
  Sliders,
  Github,
  Globe,
  ExternalLink,
  RotateCw,
  Trophy,
  Target,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { TeamReportCard } from "@/components/team-report-card";
import { ScoreBreakdownModal } from "@/components/score-breakdown-modal";
import { EditScoreModal } from "@/components/edit-score-modal";
import { TeamSubmissionModal } from "@/components/team-submission-modal";
import { evaluateSingleTeam, type EvaluationProgress } from "@/lib/evaluation-engine";
import { COMPONENTS } from "@/lib/scoring";
import { runComprehensivePlagiarismScan } from "@/lib/plagiarism";

export const Route = createFileRoute("/_authenticated/evaluations")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Evaluations — INNOVEDGE Assessor" },
      { name: "description", content: "Consolidated team evaluation scores across PDF, GitHub code, and website." },
      { property: "og:title", content: "Evaluations — INNOVEDGE Assessor" },
      { property: "og:description", content: "Consolidated team evaluation scores across PDF, GitHub code, and website." },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const qc = useQueryClient();
  const rows = useTeamRows();
  const teams = rows.data ?? [];
  const [status, setStatus] = useState("all");

  const plagiarismMap = useMemo(() => runComprehensivePlagiarismScan(teams), [teams]);
  const [q, setQ] = useState("");
  const [evaluatingIds, setEvaluatingIds] = useState<Set<string>>(new Set());

  // Live evaluation modal states
  const [liveEvalTeam, setLiveEvalTeam] = useState<TeamRow | null>(null);
  const [liveEvalProgress, setLiveEvalProgress] = useState<EvaluationProgress | null>(null);
  const [showLiveEvalModal, setShowLiveEvalModal] = useState(false);
  const [liveEvalError, setLiveEvalError] = useState<string | null>(null);

  const [selectedReportTeam, setSelectedReportTeam] = useState<TeamRow | null>(null);
  const [selectedBreakdownTeam, setSelectedBreakdownTeam] = useState<TeamRow | null>(null);
  const [selectedManualTeam, setSelectedManualTeam] = useState<TeamRow | null>(null);
  const [submissionModal, setSubmissionModal] = useState<{ team: TeamRow; tab: "pdf" | "github" | "website" } | null>(null);

  const handleEvaluate = async (team: TeamRow) => {
    if (evaluatingIds.has(team.id)) return;
    setEvaluatingIds((prev) => new Set(prev).add(team.id));
    setLiveEvalTeam(team);
    setLiveEvalError(null);
    setShowLiveEvalModal(true);
    setLiveEvalProgress({
      teamId: team.id,
      component: "pdf",
      status: "processing",
      progressPct: 15,
      message: `Running live evaluation for "${team.name}"...`,
    });

    try {
      const res = await evaluateSingleTeam(team, [...COMPONENTS], {
        forceRerun: true,
        onProgress: (p) => setLiveEvalProgress(p),
      });
      setLiveEvalTeam(res);
      toast.success(`Evaluation complete for "${team.name}"!`);
      qc.invalidateQueries();
    } catch (err: any) {
      setLiveEvalError(err?.message || "Evaluation failed");
      toast.error(err?.message || "Evaluation failed");
    } finally {
      setEvaluatingIds((prev) => {
        const next = new Set(prev);
        next.delete(team.id);
        return next;
      });
      qc.invalidateQueries();
    }
  };

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return teams
      .filter((t) => !s || t.name.toLowerCase().includes(s) || t.project_title?.toLowerCase().includes(s) || t.email?.toLowerCase().includes(s))
      .filter((t) => status === "all" || t.overall === status)
      .sort((a, b) => {
        const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
        const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
        return scoreB - scoreA;
      });
  }, [teams, q, status]);

  const getScoreColor = (val: number | null | undefined) => {
    if (val == null) return "text-muted-foreground";
    if (val >= 75) return "text-emerald-500 font-bold";
    if (val >= 50) return "text-amber-500 font-bold";
    return "text-rose-500 font-bold";
  };

  const evaluatedCount = useMemo(() => {
    return teams.filter((t) => t.officialFinal != null || t.aiFinal != null).length;
  }, [teams]);

  const topScore = useMemo(() => {
    const scores = teams.map((t) => t.officialFinal ?? t.aiFinal ?? 0);
    return scores.length ? Math.max(...scores) : 0;
  }, [teams]);

  const moderatedCount = useMemo(() => {
    return teams.filter((t) => t.officialFinal != null || t.final_status === "approved").length;
  }, [teams]);

  const flaggedCount = useMemo(() => {
    return teams.filter((t) => {
      const plag = plagiarismMap.get(t.id);
      return (plag?.overallSimilarity ?? 0) >= 35 || t.final_status === "rejected";
    }).length;
  }, [teams, plagiarismMap]);

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Team Evaluations"
          desc="Consolidated final scores for every registered team across all rubric components."
        >
          <Button size="sm" variant="outline" asChild className="transition-all hover:scale-105">
            <Link to="/reports">
              <FileDown className="size-4 mr-1.5" /> Export Reports
            </Link>
          </Button>
        </PageHeader>
      </FadeIn>

      {/* Top 4 Interactive 3D Showcase Cards */}
      <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <StaggerItem>
          <GlassCard3D glowColor="primary" className="p-4 sm:p-5 h-full flex flex-col justify-between group">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Evaluated Projects
              </span>
              <div className="size-7 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                <Target className="size-3.5" />
              </div>
            </div>
            <div className="my-2 font-mono text-2xl font-bold">{evaluatedCount} / {teams.length}</div>
            <div className="text-[11px] text-muted-foreground">Scored submissions</div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D glowColor="amber" className="p-4 sm:p-5 h-full flex flex-col justify-between group">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                Top Score Achieved
              </span>
              <div className="size-7 rounded-lg bg-amber-500/15 border border-amber-500/30 grid place-items-center text-amber-500 shrink-0 group-hover:scale-110 transition-transform">
                <Trophy className="size-3.5" />
              </div>
            </div>
            <div className="my-2 font-mono text-2xl font-bold text-amber-500">{fmt(topScore)} <span className="text-xs text-muted-foreground font-normal">/ 100</span></div>
            <div className="text-[11px] text-muted-foreground">Highest event mark</div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D glowColor="emerald" className="p-4 sm:p-5 h-full flex flex-col justify-between group">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
                Finalized / Approved
              </span>
              <div className="size-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 grid place-items-center text-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="size-3.5" />
              </div>
            </div>
            <div className="my-2 font-mono text-2xl font-bold text-emerald-500">{moderatedCount}</div>
            <div className="text-[11px] text-muted-foreground">Official decisions locked</div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D glowColor="rose" className="p-4 sm:p-5 h-full flex flex-col justify-between group">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
                Review Required
              </span>
              <div className="size-7 rounded-lg bg-rose-500/15 border border-rose-500/30 grid place-items-center text-rose-500 shrink-0 group-hover:scale-110 transition-transform">
                <AlertTriangle className="size-3.5" />
              </div>
            </div>
            <div className="my-2 font-mono text-2xl font-bold text-rose-500">{flaggedCount}</div>
            <div className="text-[11px] text-muted-foreground">Integrity or score flags</div>
          </GlassCard3D>
        </StaggerItem>
      </StaggerContainer>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9 text-xs"
            placeholder="Search team name, email, or project title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {["all", "pending", "processing", "completed", "approved", "failed"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Friendly Cards (< md) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {rows.isLoading ? (
          <CardGridSkeleton count={4} className="grid-cols-1" />
        ) : !list.length ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-xs">
            No evaluations found matching your filters.
          </div>
        ) : (
          list.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-4 border border-border/60 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to="/teams/$id" params={{ id: t.id }} className="font-bold text-foreground text-sm hover:text-primary truncate block">
                    {t.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground truncate">{t.project_title || "Project Proposal"}</div>
                  
                  {/* Quick Submission Artifacts */}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {t.pdf_text || t.pdf_path ? (
                      <button
                        onClick={() => setSubmissionModal({ team: t, tab: "pdf" })}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500"
                      >
                        <FileText className="size-2.5" /> PDF
                      </button>
                    ) : null}
                    {t.github_url ? (
                      <a
                        href={t.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-500"
                      >
                        <Github className="size-2.5" /> Code
                      </a>
                    ) : null}
                    {t.website_url ? (
                      <a
                        href={t.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500"
                      >
                        <Globe className="size-2.5" /> Web
                      </a>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={evaluatingIds.has(t.id) ? "evaluating" : t.overall} />
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/40 text-center text-xs">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">PDF</div>
                  <div className={`font-mono font-semibold ${getScoreColor(t.evals?.pdf?.final_score)}`}>
                    <AnimatedNumber value={t.evals?.pdf?.final_score} precision={0} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Code</div>
                  <div className={`font-mono font-semibold ${getScoreColor(t.evals?.github?.final_score)}`}>
                    <AnimatedNumber value={t.evals?.github?.final_score} precision={0} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Site</div>
                  <div className={`font-mono font-semibold ${getScoreColor(t.evals?.website?.final_score)}`}>
                    <AnimatedNumber value={t.evals?.website?.final_score} precision={0} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-bold text-primary">Final</div>
                  <div className="font-mono font-black text-primary">
                    <AnimatedNumber value={t.officialFinal ?? t.aiFinal} precision={1} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-border/40">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEvaluate(t)}
                  disabled={evaluatingIds.has(t.id)}
                  className="text-xs h-7"
                >
                  {evaluatingIds.has(t.id) ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Play className="size-3 mr-1 fill-current" />
                  )}
                  AI Eval
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedManualTeam(t)}
                  className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Sliders className="size-3 mr-1" /> Manual
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedBreakdownTeam(t)} className="text-xs h-7">
                  <Eye className="size-3 mr-1" /> Breakdown
                </Button>
                <Button size="sm" onClick={() => setSelectedReportTeam(t)} className="text-xs h-7">
                  <FileText className="size-3 mr-1" /> Report
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      {rows.isLoading ? (
        <div className="hidden md:block">
          <TableSkeleton rows={7} cols={7} />
        </div>
      ) : (
        <div className="hidden md:block glass overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
              <tr className="border-b border-border/80">
                <th className="p-3.5 pl-4">Team & Project</th>
                <th className="p-3.5 text-center">Project PDF (30%)</th>
                <th className="p-3.5 text-center">GitHub Code (40%)</th>
                <th className="p-3.5 text-center">Deployed Website (30%)</th>
                <th className="p-3.5 text-center font-bold text-foreground">Final Score / 100</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 pr-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!list.length ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No evaluations found matching your filters.
                  </td>
                </tr>
              ) : (
              list.map((t) => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-muted/35 transition-all duration-200 group">
                  <td className="p-3.5 pl-4 max-w-xs">
                    <Link to="/teams/$id" params={{ id: t.id }} className="font-bold text-foreground hover:text-primary truncate block">
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">{t.project_title || "Project Proposal"}</div>

                    {/* Quick Submission Artifacts */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {t.pdf_text || t.pdf_path ? (
                        <button
                          onClick={() => setSubmissionModal({ team: t, tab: "pdf" })}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                          title="View PDF Document & Content"
                        >
                          <FileText className="size-3" /> PDF
                        </button>
                      ) : null}
                      {t.github_url ? (
                        <a
                          href={t.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors"
                          title={`GitHub: ${t.github_url}`}
                        >
                          <Github className="size-3" /> Code <ExternalLink className="size-2.5" />
                        </a>
                      ) : null}
                      {t.website_url ? (
                        <a
                          href={t.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title={`Website: ${t.website_url}`}
                        >
                          <Globe className="size-3" /> Website <ExternalLink className="size-2.5" />
                        </a>
                      ) : null}
                    </div>
                  </td>

                  {/* PDF Deck Score */}
                  <td className="p-3.5 text-center font-mono">
                    <span className={getScoreColor(t.evals?.pdf?.final_score)}>
                      <AnimatedNumber value={t.evals?.pdf?.final_score} precision={1} />
                    </span>
                  </td>

                  {/* GitHub Code Score */}
                  <td className="p-3.5 text-center font-mono">
                    <span className={getScoreColor(t.evals?.github?.final_score)}>
                      <AnimatedNumber value={t.evals?.github?.final_score} precision={1} />
                    </span>
                  </td>

                  {/* Website Score */}
                  <td className="p-3.5 text-center font-mono">
                    <span className={getScoreColor(t.evals?.website?.final_score)}>
                      <AnimatedNumber value={t.evals?.website?.final_score} precision={1} />
                    </span>
                  </td>

                  {/* Final Score */}
                  <td className="p-3.5 text-center font-mono">
                    <div className="text-base font-black text-primary">
                      <AnimatedNumber value={t.officialFinal ?? t.aiFinal} precision={1} />
                    </div>
                    {t.final_override != null && (
                      <span className="text-[10px] text-amber-500 font-medium block">
                        Overridden
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="p-3.5 text-center">
                    <StatusBadge status={evaluatingIds.has(t.id) ? "evaluating" : t.overall} />
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 pr-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant={t.overall === "completed" || t.overall === "approved" ? "outline" : "default"}
                        disabled={evaluatingIds.has(t.id)}
                        onClick={() => handleEvaluate(t)}
                        className={`text-xs h-7 px-2 font-semibold ${
                          t.overall !== "completed" && t.overall !== "approved"
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : ""
                        }`}
                        title="Run multi-modal evaluation"
                      >
                        {evaluatingIds.has(t.id) ? (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        ) : t.overall === "completed" || t.overall === "approved" ? (
                          <RotateCw className="size-3 mr-1" />
                        ) : (
                          <Play className="size-3 mr-1 fill-current" />
                        )}
                        {evaluatingIds.has(t.id) ? "Evaluating" : t.overall === "completed" || t.overall === "approved" ? "Re-eval" : "Evaluate"}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => setSelectedBreakdownTeam(t)}
                        title="View rubric criteria breakdown"
                      >
                        <Eye className="size-3 mr-1 text-muted-foreground" /> Criteria
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => setSelectedManualTeam(t)}
                        title="Override or edit scores manually"
                      >
                        <Sliders className="size-3 mr-1" /> Override
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => setSelectedReportTeam(t)}
                        title="Generate official 1-page printable certificate scorecard"
                      >
                        <FileText className="size-3 mr-1 text-rose-500" /> Scorecard
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Live Evaluation Progress & Completion Modal */}
      <EvaluationProgressModal
        isOpen={showLiveEvalModal}
        onClose={() => setShowLiveEvalModal(false)}
        team={liveEvalTeam}
        isEvaluating={evaluatingIds.has(liveEvalTeam?.id ?? "")}
        progress={liveEvalProgress}
        error={liveEvalError}
        onRetry={() => liveEvalTeam && handleEvaluate(liveEvalTeam)}
        onViewBreakdown={() => liveEvalTeam && setSelectedBreakdownTeam(liveEvalTeam)}
      />

      {/* Printable Scorecard Modal */}
      <TeamReportCard
        team={selectedReportTeam}
        isOpen={!!selectedReportTeam}
        onClose={() => setSelectedReportTeam(null)}
        plagiarismScore={selectedReportTeam ? plagiarismMap.get(selectedReportTeam.id)?.overallSimilarity : undefined}
        plagiarismResult={selectedReportTeam ? plagiarismMap.get(selectedReportTeam.id) : undefined}
      />

      {/* Score Breakdown Modal */}
      <ScoreBreakdownModal
        team={selectedBreakdownTeam}
        isOpen={!!selectedBreakdownTeam}
        onClose={() => setSelectedBreakdownTeam(null)}
      />

      {/* Manual Override Edit Modal */}
      <EditScoreModal
        team={selectedManualTeam}
        isOpen={!!selectedManualTeam}
        onClose={() => setSelectedManualTeam(null)}
      />

      {/* Team Submission Modal */}
      <TeamSubmissionModal
        team={submissionModal?.team ?? null}
        defaultTab={submissionModal?.tab}
        isOpen={!!submissionModal}
        onClose={() => setSubmissionModal(null)}
      />
    </>
  );
}
