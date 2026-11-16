import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Users,
  ClipboardCheck,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Play,
  RotateCw,
  Eye,
  Sliders,
  FileText,
  Search,
  ListChecks,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ArrowUpDown,
  FileDown,
  Github,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-primitives";
import { EvaluationProgressModal } from "@/components/evaluation-progress-modal";
import { useTeamRows, useSettings, type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { evaluateSingleTeam, type EvaluationProgress } from "@/lib/evaluation-engine";
import { runComprehensivePlagiarismScan } from "@/lib/plagiarism";
import { ScoreBreakdownModal } from "@/components/score-breakdown-modal";
import { EditScoreModal } from "@/components/edit-score-modal";
import { TeamReportCard } from "@/components/team-report-card";
import { TeamSubmissionModal } from "@/components/team-submission-modal";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Team Evaluation Dashboard — INNOVEDGE Assessor" },
      { name: "description", content: "Event-wide team evaluation dashboard, score breakdowns, and manual evaluation triggers." },
      { property: "og:title", content: "Team Evaluation Dashboard — INNOVEDGE Assessor" },
      { property: "og:description", content: "Event-wide team evaluation dashboard, score breakdowns, and manual evaluation triggers." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const rows = useTeamRows(user?.id);
  const settings = useSettings();
  const shouldReduceMotion = useReducedMotion();
  const teams = rows.data ?? [];

  // Filter & Search states
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "name_asc">("score_desc");

  // Track currently evaluating teams in local state
  const [evaluatingTeamIds, setEvaluatingTeamIds] = useState<Set<string>>(new Set());

  // Live evaluation modal states
  const [liveEvalTeam, setLiveEvalTeam] = useState<TeamRow | null>(null);
  const [liveEvalProgress, setLiveEvalProgress] = useState<EvaluationProgress | null>(null);
  const [showLiveEvalModal, setShowLiveEvalModal] = useState(false);
  const [liveEvalError, setLiveEvalError] = useState<string | null>(null);

  // Modal targets
  const [breakdownTeam, setBreakdownTeam] = useState<TeamRow | null>(null);
  const [editScoreTeam, setEditScoreTeam] = useState<TeamRow | null>(null);
  const [reportCardTeam, setReportCardTeam] = useState<TeamRow | null>(null);
  const [submissionModal, setSubmissionModal] = useState<{ team: TeamRow; tab: "pdf" | "github" | "website" } | null>(null);

  // Plagiarism quick lookup
  const plagiarismMap = useMemo(() => runComprehensivePlagiarismScan(teams), [teams]);

  // Overall Statistics
  const totalTeams = teams.length;
  const completedTeams = teams.filter((t) => t.overall === "completed" || t.overall === "approved").length;
  const pendingTeams = teams.filter((t) => t.overall === "pending").length;
  const flaggedTeams = Array.from(plagiarismMap.values()).filter((p) => p.isFlagged).length;

  const validScores = teams
    .map((t) => t.officialFinal ?? t.aiFinal)
    .filter((s): s is number => s != null && !isNaN(s));
  const avgScore = validScores.length
    ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1))
    : 0;

  // Manual Evaluation Trigger for Single Team
  const handleManualEvaluate = async (team: TeamRow, forceRerun: boolean = false) => {
    if (evaluatingTeamIds.has(team.id)) return;

    setEvaluatingTeamIds((prev) => new Set(prev).add(team.id));
    setLiveEvalTeam(team);
    setLiveEvalError(null);
    setShowLiveEvalModal(true);
    setLiveEvalProgress({
      teamId: team.id,
      component: "pdf",
      status: "processing",
      progressPct: 15,
      message: `Analyzing "${team.name}" across PDF deck, GitHub repository & deployed website...`,
    });

    try {
      const res = await evaluateSingleTeam(team, [...COMPONENTS], {
        forceRerun,
        onProgress: (p) => setLiveEvalProgress(p),
      });
      setLiveEvalTeam(res);
      toast.success(`Evaluation completed for "${team.name}"!`);
      qc.invalidateQueries();
    } catch (err: any) {
      setLiveEvalError(err?.message || `Failed to evaluate "${team.name}"`);
      toast.error(err?.message || `Failed to evaluate "${team.name}"`);
    } finally {
      setEvaluatingTeamIds((prev) => {
        const next = new Set(prev);
        next.delete(team.id);
        return next;
      });
      qc.invalidateQueries();
    }
  };

  // Filtered & Sorted Teams
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return teams
      .filter((t) => {
        const matchesQuery =
          !s ||
          t.name.toLowerCase().includes(s) ||
          t.email?.toLowerCase().includes(s) ||
          t.project_title?.toLowerCase().includes(s);

        const isEvaluating = evaluatingTeamIds.has(t.id) || t.overall === "processing";
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "evaluating" && isEvaluating) ||
          (statusFilter === "completed" && (t.overall === "completed" || t.overall === "approved")) ||
          (statusFilter === "pending" && t.overall === "pending") ||
          (statusFilter === "failed" && t.overall === "failed");

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
        const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
        if (sortBy === "score_asc") return scoreA - scoreB;
        return scoreB - scoreA;
      });
  }, [teams, q, statusFilter, sortBy, evaluatingTeamIds]);

  const getScoreColor = (val: number | null | undefined) => {
    if (val == null) return "text-muted-foreground";
    if (val >= 75) return "text-emerald-500 font-bold";
    if (val >= 50) return "text-amber-500 font-bold";
    return "text-rose-500 font-bold";
  };

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Team Evaluation Dashboard"
          desc={`Independent AI evaluations, score breakdowns, and moderation for ${totalTeams} teams.`}
        >
          <Button variant="outline" size="sm" asChild>
            <Link to="/criteria">
              <ListChecks className="size-4 mr-1.5" /> Manage Criteria
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/reports">
              <FileDown className="size-4 mr-1.5" /> Export Reports
            </Link>
          </Button>
        </PageHeader>
      </FadeIn>

      {/* Top InnovJudge Metric Cards with Staggered Entrance */}
      <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-5">
        <StaggerItem className="glass rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
            <span>Total Teams</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold">
            <AnimatedNumber value={totalTeams} precision={0} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Registered hackathon teams</div>
        </StaggerItem>

        <StaggerItem className="glass rounded-2xl p-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="text-[11px] font-semibold uppercase text-emerald-500 flex items-center justify-between">
            <span>Completed</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-500">
            <AnimatedNumber value={completedTeams} precision={0} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totalTeams ? Math.round((completedTeams / totalTeams) * 100) : 0}% fully evaluated
          </div>
        </StaggerItem>

        <StaggerItem className="glass rounded-2xl p-4 border-amber-500/20 bg-amber-500/5">
          <div className="text-[11px] font-semibold uppercase text-amber-500 flex items-center justify-between">
            <span>Pending Evaluation</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-500">
            <AnimatedNumber value={pendingTeams} precision={0} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Awaiting manual trigger</div>
        </StaggerItem>

        <StaggerItem className="glass rounded-2xl p-4">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
            <span>Average Score</span>
            <Trophy className="size-4 text-primary" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-foreground">
            <AnimatedNumber value={avgScore} precision={1} />{" "}
            <span className="text-xs font-normal text-muted-foreground">/ 100</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Across completed teams</div>
        </StaggerItem>

        <StaggerItem className="glass rounded-2xl p-4 border-rose-500/20 bg-rose-500/5">
          <div className="text-[11px] font-semibold uppercase text-rose-500 flex items-center justify-between">
            <span>Plagiarism Alerts</span>
            <ShieldAlert className="size-4 text-rose-500" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-rose-500">
            <AnimatedNumber value={flaggedTeams} precision={0} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            <Link to="/plagiarism" className="text-rose-500 underline hover:text-rose-600">
              Review in Plagiarism &rarr;
            </Link>
          </div>
        </StaggerItem>
      </StaggerContainer>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9 text-xs"
            placeholder="Search teams by name, leader email, or project title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 text-xs">
            <SelectValue placeholder="Evaluation Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="evaluating">Evaluating (Active)</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-full sm:w-44 text-xs">
            <SelectValue placeholder="Sort Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score_desc">Highest Score First</SelectItem>
            <SelectItem value="score_asc">Lowest Score First</SelectItem>
            <SelectItem value="name_asc">Team Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Team Evaluation Table */}
      {rows.isLoading ? (
        <div className="glass h-64 rounded-2xl animate-pulse" />
      ) : !list.length ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          <p className="font-semibold text-foreground">No teams found matching your filters.</p>
          <p className="text-xs mt-1">Try clearing your search query or status filter.</p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
              <tr className="border-b border-border/80">
                <th className="p-3.5 pl-4">Team & Project</th>
                <th className="p-3.5 text-center">PDF Deck (30%)</th>
                <th className="p-3.5 text-center">GitHub Code (40%)</th>
                <th className="p-3.5 text-center">Website (30%)</th>
                <th className="p-3.5 text-center">Overall / 100</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 pr-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((team) => {
                const isCurrentlyEvaluating = evaluatingTeamIds.has(team.id) || team.overall === "processing";
                const isCompleted = team.overall === "completed" || team.overall === "approved";
                const isPending = team.overall === "pending";
                const isFailed = team.overall === "failed";
                const plag = plagiarismMap.get(team.id);

                return (
                  <tr
                    key={team.id}
                    className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    {/* Team Details */}
                    <td className="p-3.5 pl-4 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to="/teams/$id"
                          params={{ id: team.id }}
                          className="font-bold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {team.name}
                        </Link>
                        {plag?.isFlagged && (
                          <Link
                            to="/plagiarism"
                            title={`Flagged for ${plag.overallSimilarity}% plagiarism`}
                            className="shrink-0"
                          >
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                              Flagged
                            </Badge>
                          </Link>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{team.email}</div>
                      <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5 font-medium">
                        {team.project_title?.startsWith("[") ? (
                          <span className="text-primary">{team.project_title}</span>
                        ) : (
                          team.project_title || "Project Proposal"
                        )}
                      </div>

                      {/* Quick Artifacts & Submission Links */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {team.pdf_text || team.pdf_path ? (
                          <button
                            onClick={() => setSubmissionModal({ team, tab: "pdf" })}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                            title="View PDF Document & Extracted Content"
                          >
                            <FileText className="size-2.5" /> PDF
                          </button>
                        ) : null}
                        {team.github_url ? (
                          <a
                            href={team.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors"
                            title={`GitHub: ${team.github_url}`}
                          >
                            <Github className="size-2.5" /> Code <ExternalLink className="size-2" />
                          </a>
                        ) : null}
                        {team.website_url ? (
                          <a
                            href={team.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                            title={`Website: ${team.website_url}`}
                          >
                            <Globe className="size-2.5" /> Site <ExternalLink className="size-2" />
                          </a>
                        ) : null}
                      </div>
                    </td>

                    {/* PDF Deck Score */}
                    <td className="p-3.5 text-center font-mono">
                      <span className={getScoreColor(team.evals?.pdf?.final_score)}>
                        <AnimatedNumber value={team.evals?.pdf?.final_score} precision={1} />
                      </span>
                    </td>

                    {/* GitHub Code Score */}
                    <td className="p-3.5 text-center font-mono">
                      <span className={getScoreColor(team.evals?.github?.final_score)}>
                        <AnimatedNumber value={team.evals?.github?.final_score} precision={1} />
                      </span>
                    </td>

                    {/* Website Score */}
                    <td className="p-3.5 text-center font-mono">
                      <span className={getScoreColor(team.evals?.website?.final_score)}>
                        <AnimatedNumber value={team.evals?.website?.final_score} precision={1} />
                      </span>
                    </td>

                    {/* Overall Score */}
                    <td className="p-3.5 text-center">
                      <div className="font-mono text-base font-black text-primary">
                        <AnimatedNumber value={team.officialFinal ?? team.aiFinal} precision={1} />
                      </div>
                      {team.final_override != null && (
                        <span className="text-[10px] text-amber-500 font-medium block">
                          Overridden
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5 text-center">
                      <StatusBadge
                        status={
                          isCurrentlyEvaluating
                            ? "evaluating"
                            : isCompleted
                            ? "completed"
                            : isFailed
                            ? "failed"
                            : "pending"
                        }
                      />
                    </td>

                    {/* Action Buttons */}
                    <td className="p-3.5 pr-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Independent Manual Evaluate Button */}
                        <Button
                          size="sm"
                          variant={isCompleted ? "outline" : "default"}
                          disabled={isCurrentlyEvaluating}
                          onClick={() => handleManualEvaluate(team, isCompleted)}
                          className={`h-8 px-2.5 text-xs font-semibold ${
                            !isCompleted ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                          }`}
                          title={isCompleted ? "Re-evaluate this team" : "Run evaluation for this team"}
                        >
                          {isCurrentlyEvaluating ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin mr-1" /> Evaluating…
                            </>
                          ) : isCompleted ? (
                            <>
                              <RotateCw className="size-3.5 mr-1" /> Re-evaluate
                            </>
                          ) : (
                            <>
                              <Play className="size-3.5 mr-1 fill-current" /> Evaluate
                            </>
                          )}
                        </Button>

                        {/* Breakdown Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setBreakdownTeam(team)}
                          title="View rubric criteria breakdown"
                        >
                          <Eye className="size-3.5 mr-1 text-muted-foreground" /> Criteria
                        </Button>

                        {/* Edit Score Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setEditScoreTeam(team)}
                          title="Override or edit scores manually"
                        >
                          <Sliders className="size-3.5 mr-1 text-muted-foreground" /> Override
                        </Button>

                        {/* Official Printable Scorecard Report */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setReportCardTeam(team)}
                          title="Generate official 1-page printable certificate scorecard"
                        >
                          <FileText className="size-3.5 mr-1 text-rose-500" /> Scorecard
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Live Evaluation Progress & Completion HUD Modal */}
      <EvaluationProgressModal
        isOpen={showLiveEvalModal}
        onClose={() => setShowLiveEvalModal(false)}
        team={liveEvalTeam}
        isEvaluating={evaluatingTeamIds.has(liveEvalTeam?.id ?? "")}
        progress={liveEvalProgress}
        error={liveEvalError}
        onRetry={() => liveEvalTeam && handleManualEvaluate(liveEvalTeam, true)}
        onViewBreakdown={() => liveEvalTeam && setBreakdownTeam(liveEvalTeam)}
      />

      {/* Detailed Score Breakdown Modal */}
      <ScoreBreakdownModal
        team={breakdownTeam}
        isOpen={!!breakdownTeam}
        onClose={() => setBreakdownTeam(null)}
      />

      {/* Edit Scores Modal */}
      <EditScoreModal
        team={editScoreTeam}
        isOpen={!!editScoreTeam}
        onClose={() => setEditScoreTeam(null)}
      />

      {/* 1-Page Official Printable Scorecard Report */}
      <TeamReportCard
        team={reportCardTeam}
        isOpen={!!reportCardTeam}
        onClose={() => setReportCardTeam(null)}
        plagiarismScore={reportCardTeam ? plagiarismMap.get(reportCardTeam.id)?.overallSimilarity : undefined}
        plagiarismResult={reportCardTeam ? plagiarismMap.get(reportCardTeam.id) : undefined}
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
