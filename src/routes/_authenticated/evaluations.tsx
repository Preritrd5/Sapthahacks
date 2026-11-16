import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { FileText, Eye, Search, FileDown, Play, Loader2, Sliders, Github, Globe, ExternalLink } from "lucide-react";
import { TeamReportCard } from "@/components/team-report-card";
import { ScoreBreakdownModal } from "@/components/score-breakdown-modal";
import { EditScoreModal } from "@/components/edit-score-modal";
import { TeamSubmissionModal } from "@/components/team-submission-modal";
import { evaluateSingleTeam } from "@/lib/evaluation-engine";
import { COMPONENTS } from "@/lib/scoring";

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
  const [q, setQ] = useState("");
  const [evaluatingIds, setEvaluatingIds] = useState<Set<string>>(new Set());

  const [selectedReportTeam, setSelectedReportTeam] = useState<TeamRow | null>(null);
  const [selectedBreakdownTeam, setSelectedBreakdownTeam] = useState<TeamRow | null>(null);
  const [selectedManualTeam, setSelectedManualTeam] = useState<TeamRow | null>(null);
  const [submissionModal, setSubmissionModal] = useState<{ team: TeamRow; tab: "pdf" | "github" | "website" } | null>(null);

  const handleEvaluate = async (team: TeamRow) => {
    if (evaluatingIds.has(team.id)) return;
    setEvaluatingIds((prev) => new Set(prev).add(team.id));
    toast.info(`Evaluating "${team.name}" across all components...`);
    try {
      await evaluateSingleTeam(team, [...COMPONENTS], { forceRerun: true });
      toast.success(`Evaluation complete for "${team.name}"!`);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err?.message || "Evaluation failed");
    } finally {
      setEvaluatingIds((prev) => {
        const next = new Set(prev);
        next.delete(team.id);
        return next;
      });
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

  return (
    <>
      <PageHeader
        title="Team Evaluations"
        desc="Consolidated final scores for every registered team across all rubric components."
      >
        <Button size="sm" variant="outline" asChild>
          <Link to="/reports">
            <FileDown className="size-4 mr-1.5" /> Export Reports
          </Link>
        </Button>
      </PageHeader>

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
        {!list.length ? (
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
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                      >
                        <FileText className="size-2.5" /> PDF
                      </button>
                    ) : null}
                    {t.github_url ? (
                      <a
                        href={t.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
                      >
                        <Github className="size-2.5" /> Code <ExternalLink className="size-2" />
                      </a>
                    ) : null}
                    {t.website_url ? (
                      <a
                        href={t.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                      >
                        <Globe className="size-2.5" /> Site <ExternalLink className="size-2" />
                      </a>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={t.overall} />
              </div>

              {/* 4 Score Pills Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                <div className="rounded-lg bg-card border border-border/50 p-2">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">PDF (30%)</div>
                  <div className={`font-mono text-xs mt-0.5 ${getScoreColor(t.evals?.pdf?.final_score)}`}>
                    {t.evals?.pdf?.final_score != null ? fmt(t.evals.pdf.final_score) : "—"}
                  </div>
                </div>

                <div className="rounded-lg bg-card border border-border/50 p-2">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">GitHub (40%)</div>
                  <div className={`font-mono text-xs mt-0.5 ${getScoreColor(t.evals?.github?.final_score)}`}>
                    {t.evals?.github?.final_score != null ? fmt(t.evals.github.final_score) : "—"}
                  </div>
                </div>

                <div className="rounded-lg bg-card border border-border/50 p-2">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Web (30%)</div>
                  <div className={`font-mono text-xs mt-0.5 ${getScoreColor(t.evals?.website?.final_score)}`}>
                    {t.evals?.website?.final_score != null ? fmt(t.evals.website.final_score) : "—"}
                  </div>
                </div>

                <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
                  <div className="text-[9px] uppercase font-bold text-primary">Final /100</div>
                  <div className="font-mono text-xs font-black text-primary mt-0.5">
                    {fmt(t.officialFinal ?? t.aiFinal)}
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
                    <Play className="size-3 mr-1" />
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
                <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
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

                  <td className="p-3.5 text-center font-mono">
                    <span className={getScoreColor(t.evals?.pdf?.final_score)}>
                      {t.evals?.pdf?.final_score != null ? fmt(t.evals.pdf.final_score) : "—"}
                    </span>
                  </td>

                  <td className="p-3.5 text-center font-mono">
                    <span className={getScoreColor(t.evals?.github?.final_score)}>
                      {t.evals?.github?.final_score != null ? fmt(t.evals.github.final_score) : "—"}
                    </span>
                  </td>

                  <td className="p-3.5 text-center font-mono">
                    <span className={getScoreColor(t.evals?.website?.final_score)}>
                      {t.evals?.website?.final_score != null ? fmt(t.evals.website.final_score) : "—"}
                    </span>
                  </td>

                  <td className="p-3.5 text-center">
                    <div className="font-mono text-base font-black text-primary">
                      {fmt(t.officialFinal ?? t.aiFinal)}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    <StatusBadge status={t.overall} />
                  </td>

                  <td className="p-3.5 pr-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEvaluate(t)}
                        disabled={evaluatingIds.has(t.id)}
                        className="h-7 px-2 text-xs hover:border-primary hover:text-primary"
                        title="Run automated AI evaluation across PDF, GitHub, and Website"
                      >
                        {evaluatingIds.has(t.id) ? (
                          <Loader2 className="size-3.5 animate-spin mr-1" />
                        ) : (
                          <Play className="size-3.5 mr-1" />
                        )}
                        AI Eval
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedManualTeam(t)}
                        className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
                        title="Manually enter marks or fill dummy benchmark scores"
                      >
                        <Sliders className="size-3.5 mr-1" /> Manual
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedBreakdownTeam(t)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="size-3.5 mr-1" /> Breakdown
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedReportTeam(t)}
                        className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <FileText className="size-3.5 mr-1" /> View Report
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Official 1-Page Scorecard Modal */}
      <TeamReportCard
        team={selectedReportTeam}
        isOpen={!!selectedReportTeam}
        onClose={() => setSelectedReportTeam(null)}
      />

      {/* Criteria Breakdown Modal */}
      <ScoreBreakdownModal
        team={selectedBreakdownTeam}
        isOpen={!!selectedBreakdownTeam}
        onClose={() => setSelectedBreakdownTeam(null)}
      />

      {/* Manual Evaluation & Score Override Modal */}
      <EditScoreModal
        team={selectedManualTeam}
        isOpen={!!selectedManualTeam}
        onClose={() => setSelectedManualTeam(null)}
      />

      {/* Team Submission Artifacts & Links Modal */}
      <TeamSubmissionModal
        team={submissionModal?.team ?? null}
        defaultTab={submissionModal?.tab}
        isOpen={!!submissionModal}
        onClose={() => setSubmissionModal(null)}
      />
    </>
  );
}
