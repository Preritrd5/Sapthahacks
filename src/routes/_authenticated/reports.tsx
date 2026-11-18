import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import {
  FileSpreadsheet,
  FileJson,
  Printer,
  CheckCircle2,
  FileText,
  Download,
  Trophy,
  Filter,
  Search,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Users,
  Target,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { updatePersistentTeam } from "@/lib/team-store";
import { logActivity } from "@/lib/db";
import { PageHeader, fmt, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { FadeIn, StaggerContainer, StaggerItem, Magnetic } from "@/components/ui/motion-primitives";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { exportRows, downloadBlob } from "@/lib/export";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { runComprehensivePlagiarismScan } from "@/lib/plagiarism";
import { TeamReportCard } from "@/components/team-report-card";
import { QualifiedTeamsReport } from "@/components/qualified-teams-report";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Evaluation Reports — INNOVEDGE Assessor" },
      { name: "description", content: "Download and export Qualified Teams and Complete Evaluation Reports." },
      { property: "og:title", content: "Evaluation Reports — INNOVEDGE Assessor" },
      { property: "og:description", content: "Download and export Qualified Teams and Complete Evaluation Reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const qc = useQueryClient();
  const rows = useTeamRows();
  const teams = rows.data ?? [];
  const [activeTab, setActiveTab] = useState<"qualified" | "complete">("qualified");
  const [cutoffScore, setCutoffScore] = useState<number>(65);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportTeam, setSelectedReportTeam] = useState<TeamRow | null>(null);
  const [showQualifiedPdfModal, setShowQualifiedPdfModal] = useState(false);
  const [isPrintingQualified, setIsPrintingQualified] = useState(false);

  // Plagiarism map for complete report
  const plagiarismMap = useMemo(() => runComprehensivePlagiarismScan(teams), [teams]);

  // Ranked Teams
  const rankedAll = useMemo(() => {
    return [...teams].sort((a, b) => {
      const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
      const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
      return scoreB - scoreA;
    });
  }, [teams]);

  // 1. Qualified Teams: Strictly synchronized with Team Qualification status (approved or qualified)
  const qualifiedTeams = useMemo(() => {
    return rankedAll
      .filter((t) => t.final_status === "approved" || t.final_status === "qualified")
      .map((t, idx) => ({
        ...t,
        rank: idx + 1,
      }));
  }, [rankedAll]);

  // Qualify Top N Teams by Competitive Ranking (e.g. Top 10, Top 5)
  const handleQualifyTopN = async (count: number) => {
    if (count <= 0) return;
    const targetTeams = rankedAll.slice(0, count);
    if (!targetTeams.length) {
      return toast.info("No teams available to qualify.");
    }
    const minScore = (targetTeams[targetTeams.length - 1]?.officialFinal ?? targetTeams[targetTeams.length - 1]?.aiFinal ?? 0).toFixed(1);
    const maxScore = (targetTeams[0]?.officialFinal ?? targetTeams[0]?.aiFinal ?? 0).toFixed(1);

    if (
      !confirm(
        `Move the Top ${targetTeams.length} highest-scoring teams into QUALIFIED status for Round 2?\n\n` +
        `• Highest Score: ${maxScore} / 100\n` +
        `• Cutoff Mark: ${minScore} / 100\n` +
        `• Teams to qualify: ${targetTeams.length}\n\n` +
        `Confirm Round 2 Finalist Shortlist?`
      )
    ) {
      return;
    }

    targetTeams.forEach((t) => {
      updatePersistentTeam(t.id, {
        final_status: "approved",
        updated_at: new Date().toISOString(),
      });
    });

    try {
      await supabase
        .from("teams")
        .update({ final_status: "approved", updated_at: new Date().toISOString() })
        .in(
          "id",
          targetTeams.map((t) => t.id)
        );
      await logActivity(
        "Qualified Top N Teams",
        `Top ${targetTeams.length} teams qualified by competitive rank (cut-off: ${minScore}/100)`
      );
    } catch (err) {
      console.warn("Could not sync to Supabase:", err);
    }

    qc.invalidateQueries({ queryKey: ["team-rows"] });
    toast.success(`✓ Successfully qualified Top ${targetTeams.length} teams for Round 2!`);
  };

  // Reset all qualification ticks back to Pending
  const handleResetAllQualifications = async () => {
    if (!qualifiedTeams.length) {
      return toast.info("No teams are currently marked as qualified.");
    }

    if (!confirm(`Reset qualification status for all ${qualifiedTeams.length} qualified team(s) back to Pending?`)) {
      return;
    }

    qualifiedTeams.forEach((t) => {
      updatePersistentTeam(t.id, { final_status: "pending", updated_at: new Date().toISOString() });
    });

    try {
      await supabase
        .from("teams")
        .update({ final_status: "pending", updated_at: new Date().toISOString() })
        .in(
          "id",
          qualifiedTeams.map((t) => t.id)
        );
      await logActivity("Reset qualifications", `${qualifiedTeams.length} teams reset to pending`);
    } catch (err) {}

    qc.invalidateQueries({ queryKey: ["team-rows"] });
    toast.info(`Qualification reset to Pending for ${qualifiedTeams.length} team(s).`);
  };

  // Direct Fast Form-Wise PDF Print (Clean pure A4 document, no sliders or website layout)
  const handleDirectPrintPdf = () => {
    if (!qualifiedTeams.length) {
      return toast.warning("No teams are currently qualified. Select or qualify teams first (e.g. click 'Top 10').");
    }
    setIsPrintingQualified(true);
    document.body.classList.add("printing-qualified-list");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrintingQualified(false);
        document.body.classList.remove("printing-qualified-list");
      }, 500);
    }, 100);
  };

  // Auto-Qualify Teams meeting cutoff
  const handleAutoQualifyCutoff = async () => {
    const toQualify = rankedAll.filter((t) => {
      const score = t.officialFinal ?? t.aiFinal ?? 0;
      const isAlready = t.final_status === "approved" || t.final_status === "qualified";
      return score >= cutoffScore && !isAlready && t.final_status !== "rejected";
    });

    if (!toQualify.length) {
      return toast.info(`No unapproved teams found with score >= ${cutoffScore}.`);
    }

    if (!confirm(`Mark ${toQualify.length} team(s) with score >= ${cutoffScore} as officially Qualified?`)) return;

    toQualify.forEach((t) => {
      updatePersistentTeam(t.id, { final_status: "approved", updated_at: new Date().toISOString() });
    });

    try {
      await supabase
        .from("teams")
        .update({ final_status: "approved", updated_at: new Date().toISOString() })
        .in("id", toQualify.map((t) => t.id));
      await logActivity("Auto-qualified teams by cutoff", `${toQualify.length} teams qualified at cutoff ${cutoffScore}`);
    } catch {}

    qc.invalidateQueries({ queryKey: ["team-rows"] });
    toast.success(`Successfully qualified ${toQualify.length} teams meeting the cutoff!`);
  };

  // Filtered Qualified
  const filteredQualified = useMemo(() => {
    const s = searchQuery.toLowerCase();
    if (!s) return qualifiedTeams;
    return qualifiedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.email?.toLowerCase().includes(s) ||
        t.project_title?.toLowerCase().includes(s)
    );
  }, [qualifiedTeams, searchQuery]);

  // Filtered Complete
  const filteredComplete = useMemo(() => {
    const s = searchQuery.toLowerCase();
    if (!s) return rankedAll;
    return rankedAll.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.email?.toLowerCase().includes(s) ||
        t.project_title?.toLowerCase().includes(s)
    );
  }, [rankedAll, searchQuery]);

  // Export Qualified Teams
  const exportQualified = (format: "csv" | "xlsx") => {
    if (!qualifiedTeams.length) return toast.error("No qualified teams to export");
    const data = qualifiedTeams.map((t) => ({
      Rank: t.rank,
      "Team Name": t.name,
      "Leader Email": t.email,
      "Project Title": t.project_title,
      "Final Score": fmt(t.officialFinal ?? t.aiFinal),
      "PDF Score": fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score),
      "GitHub Score": fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score),
      "Website Score": fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score),
      Status: "Qualified",
    }));
    exportRows(data, `qualified-teams-report`, format);
  };

  // Export Complete Evaluation Report
  const exportComplete = (format: "csv" | "xlsx") => {
    if (!rankedAll.length) return toast.error("No teams to export");
    const data = rankedAll.map((t, idx) => {
      const plag = plagiarismMap.get(t.id);
      const isQualified = t.final_status === "approved" || t.final_status === "qualified";
      return {
        Rank: idx + 1,
        "Team Name": t.name,
        "Leader Email": t.email,
        "Project Title": t.project_title,
        "PDF Deck Score": fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score),
        "GitHub Code Score": fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score),
        "Website Score": fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score),
        "Overall Marks / 100": fmt(t.officialFinal ?? t.aiFinal),
        "Plagiarism PDF %": plag?.pdfSimilarity ?? 0,
        "Plagiarism Code %": plag?.githubSimilarity ?? 0,
        "Plagiarism Web %": plag?.websiteSimilarity ?? 0,
        "Plagiarism Overall %": plag?.overallSimilarity ?? 0,
        "Plagiarism Reason": plag?.flaggedReason || "Clean",
        "Plagiarism Admin Verdict": plag?.adminDecision || "clean",
        "Qualification Status": isQualified ? "Qualified" : t.final_status === "rejected" ? "Disqualified" : "Pending",
        Remarks: t.remarks || t.override_reason || "",
      };
    });
    exportRows(data, "complete-event-evaluation-report", format);
  };

  // Export Complete JSON
  const exportCompleteJson = () => {
    const data = rankedAll.map((t, idx) => {
      const plag = plagiarismMap.get(t.id);
      const isQualified = t.final_status === "approved" || t.final_status === "qualified";
      return {
        rank: idx + 1,
        team_id: t.id,
        team_name: t.name,
        leader_email: t.email,
        project_title: t.project_title,
        scores: {
          pdf: t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score ?? null,
          github: t.evals?.github?.final_score ?? t.evals?.github?.ai_score ?? null,
          website: t.evals?.website?.final_score ?? t.evals?.website?.ai_score ?? null,
          overall: t.officialFinal ?? t.aiFinal ?? null,
          override: t.final_override ?? null,
        },
        plagiarism: {
          pdf_similarity: plag?.pdfSimilarity ?? 0,
          github_similarity: plag?.githubSimilarity ?? 0,
          website_similarity: plag?.websiteSimilarity ?? 0,
          overall_similarity: plag?.overallSimilarity ?? 0,
          verdict: plag?.adminDecision ?? "clean",
          reason: plag?.flaggedReason ?? null,
        },
        qualification: {
          is_qualified: isQualified,
          final_status: t.final_status,
        },
        remarks: t.remarks ?? t.override_reason ?? null,
        updated_at: t.updated_at,
      };
    });

    downloadBlob(
      JSON.stringify({ exported_at: new Date().toISOString(), teams: data }, null, 2),
      "complete-evaluation-report.json",
      "application/json"
    );
  };

  // Summary Stats
  const evaluatedCount = useMemo(() => {
    return teams.filter((t) => t.officialFinal != null || t.aiFinal != null).length;
  }, [teams]);

  const avgScore = useMemo(() => {
    const scored = teams.filter((t) => (t.officialFinal ?? t.aiFinal) != null);
    if (!scored.length) return 0;
    const total = scored.reduce((acc, t) => acc + (t.officialFinal ?? t.aiFinal ?? 0), 0);
    return Math.round((total / scored.length) * 10) / 10;
  }, [teams]);

  const cleanIntegrityCount = useMemo(() => {
    return teams.filter((t) => (plagiarismMap.get(t.id)?.overallSimilarity ?? 0) < 35).length;
  }, [teams, plagiarismMap]);

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Reports &amp; Qualification Center"
          desc="Export official Qualified Teams lists and Complete Event Evaluation reports with full marks and plagiarism audit trails."
        />
      </FadeIn>

      {/* Top 4 Interactive 3D Metric Showcase */}
      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StaggerItem>
          <GlassCard3D glowColor="amber" className="group">
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-normal">
                Qualified Candidates
              </span>
              <div className="size-8 rounded-xl bg-amber-500/15 border border-amber-500/30 grid place-items-center text-amber-500 shrink-0 group-hover:scale-110 transition-transform">
                <Trophy className="size-4" />
              </div>
            </div>
            <div className="my-2 font-mono text-3xl font-extrabold text-foreground">
              <AnimatedNumber value={qualifiedTeams.length} precision={0} />
            </div>
            <div className="text-xs text-muted-foreground pb-0.5">
              Cutoff: <span className="font-semibold text-foreground">{cutoffScore}/100</span> marks
            </div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D glowColor="terracotta" className="group">
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-normal">
                Evaluated Teams
              </span>
              <div className="size-8 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                <Target className="size-4" />
              </div>
            </div>
            <div className="my-2 font-mono text-3xl font-extrabold text-foreground">
              <AnimatedNumber value={evaluatedCount} precision={0} />
            </div>
            <div className="text-xs text-muted-foreground pb-0.5">
              Across <span className="font-semibold text-foreground">{teams.length}</span> registered teams
            </div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D glowColor="emerald" className="group">
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-normal">
                Average Event Score
              </span>
              <div className="size-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center text-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
                <BarChart3 className="size-4" />
              </div>
            </div>
            <div className="my-2 font-mono text-3xl font-extrabold text-foreground">
              <AnimatedNumber value={avgScore} precision={1} />{" "}
              <span className="text-base text-muted-foreground font-normal">/ 100</span>
            </div>
            <div className="text-xs text-muted-foreground pb-0.5">
              Mean aggregate performance
            </div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D glowColor="sky" className="group">
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-normal">
                Integrity Cleared
              </span>
              <div className="size-8 rounded-xl bg-sky-500/15 border border-sky-500/30 grid place-items-center text-sky-500 shrink-0 group-hover:scale-110 transition-transform">
                <ShieldCheck className="size-4" />
              </div>
            </div>
            <div className="my-2 font-mono text-3xl font-extrabold text-foreground">
              <AnimatedNumber value={cleanIntegrityCount} precision={0} />
            </div>
            <div className="text-xs text-muted-foreground pb-0.5">
              Verified &lt; 35% similarity threshold
            </div>
          </GlassCard3D>
        </StaggerItem>
      </StaggerContainer>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="qualified" className="text-xs font-semibold flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all">
            <Trophy className="size-4 text-amber-500" />
            Qualified Teams ({qualifiedTeams.length})
          </TabsTrigger>
          <TabsTrigger value="complete" className="text-xs font-semibold flex items-center gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all">
            <FileSpreadsheet className="size-4 text-primary" />
            Complete Report ({teams.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. QUALIFIED TEAMS REPORT TAB */}
        <TabsContent value="qualified" className="space-y-4">
          {/* Controls Bar */}
          <div className="glass rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Qualification Cutoff:</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={cutoffScore}
                    onChange={(e) => setCutoffScore(Number(e.target.value) || 0)}
                    className="w-16 h-8 text-center font-mono font-bold text-xs"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">/ 100</span>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoQualifyCutoff}
                className="text-xs h-8 gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                title="Mark all teams scoring at or above cutoff as officially Qualified"
              >
                <Sparkles className="size-3.5 text-amber-500" /> Auto-Qualify (&ge;{cutoffScore})
              </Button>

              {/* Quick Select Top N Shortlist */}
              <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                <span className="text-xs font-semibold text-muted-foreground">Select:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQualifyTopN(5)}
                  className="text-xs h-7 px-2 font-mono font-bold text-primary hover:bg-primary/10"
                  title="Qualify Top 5 teams by score"
                >
                  Top 5
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQualifyTopN(10)}
                  className="text-xs h-7 px-2 font-mono font-bold bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20"
                  title="Qualify Top 10 teams by score"
                >
                  Top 10
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQualifyTopN(15)}
                  className="text-xs h-7 px-2 font-mono font-bold text-primary hover:bg-primary/10"
                  title="Qualify Top 15 teams by score"
                >
                  Top 15
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQualifyTopN(20)}
                  className="text-xs h-7 px-2 font-mono font-bold text-primary hover:bg-primary/10"
                  title="Qualify Top 20 teams by score"
                >
                  Top 20
                </Button>
                {qualifiedTeams.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetAllQualifications}
                    className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    title="Reset all qualifications to Pending"
                  >
                    Reset
                  </Button>
                )}
              </div>

              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-xs h-8"
                  placeholder="Filter qualified teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => exportQualified("csv")} className="text-xs h-8">
                <Download className="size-3.5 mr-1" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportQualified("xlsx")} className="text-xs h-8">
                <FileSpreadsheet className="size-3.5 mr-1" /> Export Excel
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleDirectPrintPdf}
                disabled={!qualifiedTeams.length}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
                title="Print certified A4 form-wise PDF without website sliders or background"
              >
                <Printer className="size-3.5 mr-1" /> Print Official Form PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowQualifiedPdfModal(true)}
                disabled={!qualifiedTeams.length}
                className="text-xs h-8 border-border/80"
                title="Preview official qualified list document"
              >
                <FileText className="size-3.5 mr-1" /> Preview Form
              </Button>
            </div>
          </div>

          {/* Qualified Table */}
          {rows.isLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : (
            <div className="glass overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
                <tr className="border-b border-border/80">
                  <th className="p-3.5 pl-4 w-16 text-center">Rank</th>
                  <th className="p-3.5">Qualified Team Name</th>
                  <th className="p-3.5">Leader Email</th>
                  <th className="p-3.5">Project Challenge</th>
                  <th className="p-3.5 text-center">PDF</th>
                  <th className="p-3.5 text-center">GitHub</th>
                  <th className="p-3.5 text-center">Website</th>
                  <th className="p-3.5 text-center font-bold text-foreground">Overall Score</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 pr-4 text-center">Scorecard</th>
                </tr>
              </thead>
              <tbody>
                {!filteredQualified.length ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No teams are currently qualified. Tick teams in Team Qualification or click "Auto-Qualify (&ge;{cutoffScore})" above.
                    </td>
                  </tr>
                ) : (
                  filteredQualified.map((t) => (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-muted/35 transition-all duration-200 group">
                      <td className="p-3.5 pl-4 text-center">
                        <span className={`inline-flex items-center justify-center size-7 rounded-full font-mono text-xs font-bold transition-transform group-hover:scale-110 ${t.rank === 1 ? "bg-amber-500/20 text-amber-500 border border-amber-500/40 podium-gold shadow-xs" :
                            t.rank === 2 ? "bg-slate-300/20 text-slate-300 border border-slate-400/40 podium-silver shadow-xs" :
                              t.rank === 3 ? "bg-amber-700/20 text-amber-600 border border-amber-700/40 podium-bronze shadow-xs" :
                                "bg-muted text-muted-foreground"
                          }`}>
                          #{t.rank}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-foreground">
                        <Link to="/teams/$id" params={{ id: t.id }} className="hover:text-primary transition-colors">
                          {t.name}
                        </Link>
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground font-mono">{t.email}</td>
                      <td className="p-3.5 text-xs text-muted-foreground max-w-xs truncate">
                        {t.project_title}
                      </td>
                      <td className="p-3.5 text-center font-mono text-xs text-muted-foreground">
                        {fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score)}
                      </td>
                      <td className="p-3.5 text-center font-mono text-xs text-muted-foreground">
                        {fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score)}
                      </td>
                      <td className="p-3.5 text-center font-mono text-xs text-muted-foreground">
                        {fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score)}
                      </td>
                      <td className="p-3.5 text-center font-mono text-base font-black text-emerald-500">
                        {fmt(t.officialFinal ?? t.aiFinal)}
                      </td>
                      <td className="p-3.5 text-center">
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs">
                          <CheckCircle2 className="size-3 mr-1" /> Qualified
                        </Badge>
                      </td>
                      <td className="p-3.5 pr-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReportTeam(t)}
                          className="h-7 text-xs gap-1 border-primary/30 hover:bg-primary/10 hover:text-primary shadow-xs transition-all hover:scale-105"
                        >
                          <FileText className="size-3 text-primary" />
                          <span>Scorecard</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </TabsContent>

        {/* 2. COMPLETE EVALUATION REPORT TAB */}
        <TabsContent value="complete" className="space-y-4">
          {/* Controls Bar */}
          <div className="glass rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                className="pl-8 text-xs h-8"
                placeholder="Search all teams and scores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => exportComplete("csv")} className="text-xs h-8">
                <Download className="size-3.5 mr-1" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportComplete("xlsx")} className="text-xs h-8">
                <FileSpreadsheet className="size-3.5 mr-1" /> Export Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={exportCompleteJson} className="text-xs h-8">
                <FileJson className="size-3.5 mr-1" /> Export JSON
              </Button>
            </div>
          </div>

          {/* Master Complete Table */}
          {rows.isLoading ? (
            <TableSkeleton rows={7} cols={9} />
          ) : (
            <div className="glass overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="text-left uppercase text-muted-foreground bg-muted/30">
                <tr className="border-b border-border/80">
                  <th className="p-3 pl-4">Team</th>
                  <th className="p-3 text-center">PDF</th>
                  <th className="p-3 text-center">GitHub</th>
                  <th className="p-3 text-center">Website</th>
                  <th className="p-3 text-center font-bold text-foreground">Overall</th>
                  <th className="p-3 text-center">Plagiarism (Code/PDF/Web)</th>
                  <th className="p-3 text-center">Plagiarism Reason</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Remarks</th>
                  <th className="p-3 pr-4 text-center">Scorecard</th>
                </tr>
              </thead>
              <tbody>
                {!filteredComplete.length ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No evaluation results available.
                    </td>
                  </tr>
                ) : (
                  filteredComplete.map((t) => {
                    const plag = plagiarismMap.get(t.id);
                    const isQualified = qualifiedTeams.some((q) => q.id === t.id);

                    return (
                      <tr key={t.id} className="border-b border-border/40 hover:bg-muted/35 transition-all duration-200 group">
                        <td className="p-3 pl-4">
                          <Link to="/teams/$id" params={{ id: t.id }} className="font-bold text-foreground hover:text-primary transition-colors">
                            {t.name}
                          </Link>
                          <div className="text-[10px] text-muted-foreground truncate">{t.project_title}</div>
                        </td>

                        <td className="p-3 text-center font-mono">
                          {fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score)}
                        </td>

                        <td className="p-3 text-center font-mono">
                          {fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score)}
                        </td>

                        <td className="p-3 text-center font-mono">
                          {fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score)}
                        </td>

                        <td className="p-3 text-center font-mono font-black text-sm text-primary">
                          {fmt(t.officialFinal ?? t.aiFinal)}
                        </td>

                        <td className="p-3 text-center font-mono text-[11px]">
                          <span className={plag?.githubSimilarity && plag.githubSimilarity >= 35 ? "text-rose-500 font-bold" : ""}>
                            {plag?.githubSimilarity ?? 0}% Code
                          </span> ·{" "}
                          <span className={plag?.pdfSimilarity && plag.pdfSimilarity >= 35 ? "text-rose-500 font-bold" : ""}>
                            {plag?.pdfSimilarity ?? 0}% PDF
                          </span>
                        </td>

                        <td className="p-3 max-w-xs truncate text-[11px] text-muted-foreground" title={plag?.flaggedReason || ""}>
                          {plag?.flaggedReason || "Clean"}
                        </td>

                        <td className="p-3 text-center">
                          {isQualified ? (
                            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                              Qualified
                            </Badge>
                          ) : t.final_status === "rejected" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Disqualified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </td>

                        <td className="p-3 max-w-36 truncate text-[11px] text-muted-foreground" title={t.remarks || t.override_reason || ""}>
                          {t.remarks || t.override_reason || "—"}
                        </td>

                        <td className="p-3 pr-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedReportTeam(t)}
                            className="h-6 px-2 text-[11px] gap-1 hover:bg-primary/10 hover:text-primary border border-border/50 shadow-xs transition-all hover:scale-105"
                          >
                            <FileText className="size-3 text-primary" />
                            <span>Report</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Official 1-Page Scorecard Modal */}
      <TeamReportCard
        team={selectedReportTeam}
        isOpen={!!selectedReportTeam}
        onClose={() => setSelectedReportTeam(null)}
        plagiarismScore={selectedReportTeam ? plagiarismMap.get(selectedReportTeam.id)?.overallSimilarity : undefined}
        plagiarismResult={selectedReportTeam ? plagiarismMap.get(selectedReportTeam.id) : undefined}
      />

      {/* Official Qualified Teams Form-Wise PDF Report Modal & Print Portal */}
      <QualifiedTeamsReport
        teams={qualifiedTeams}
        isOpen={showQualifiedPdfModal}
        onClose={() => setShowQualifiedPdfModal(false)}
        totalRegisteredCount={teams.length}
        plagiarismMap={plagiarismMap}
        selectionTitle={`Official Round 2 Finalists (${qualifiedTeams.length} Teams)`}
      />
    </>
  );
}
