import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
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
} from "lucide-react";
import { PageHeader, fmt, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { exportRows, downloadBlob } from "@/lib/export";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { runComprehensivePlagiarismScan } from "@/lib/plagiarism";

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
  const rows = useTeamRows();
  const teams = rows.data ?? [];
  const [activeTab, setActiveTab] = useState<"qualified" | "complete">("qualified");
  const [cutoffScore, setCutoffScore] = useState<number>(65);
  const [searchQuery, setSearchQuery] = useState("");

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

  // 1. Qualified Teams
  const qualifiedTeams = useMemo(() => {
    return rankedAll
      .filter((t) => {
        const score = t.officialFinal ?? t.aiFinal ?? 0;
        const isApproved = t.final_status === "approved" || t.final_status === "qualified";
        const meetsCutoff = score >= cutoffScore;
        const notRejected = t.final_status !== "rejected";
        return (isApproved || meetsCutoff) && notRejected;
      })
      .map((t, idx) => ({
        ...t,
        rank: idx + 1,
      }));
  }, [rankedAll, cutoffScore]);

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
      "PDF Score": fmt(t.evals?.pdf?.final_score),
      "GitHub Score": fmt(t.evals?.github?.final_score),
      "Website Score": fmt(t.evals?.website?.final_score),
      Status: "Qualified",
    }));
    exportRows(data, `qualified-teams-report-cutoff-${cutoffScore}`, format);
  };

  // Export Complete Evaluation Report
  const exportComplete = (format: "csv" | "xlsx") => {
    if (!rankedAll.length) return toast.error("No teams to export");
    const data = rankedAll.map((t, idx) => {
      const plag = plagiarismMap.get(t.id);
      const isQualified = qualifiedTeams.some((q) => q.id === t.id);
      return {
        Rank: idx + 1,
        "Team Name": t.name,
        "Leader Email": t.email,
        "Project Title": t.project_title,
        "PDF Deck Score": fmt(t.evals?.pdf?.final_score),
        "GitHub Code Score": fmt(t.evals?.github?.final_score),
        "Website Score": fmt(t.evals?.website?.final_score),
        "Overall Marks / 100": fmt(t.officialFinal ?? t.aiFinal),
        "Plagiarism PDF %": plag?.pdfSimilarity ?? 0,
        "Plagiarism Code %": plag?.githubSimilarity ?? 0,
        "Plagiarism Web %": plag?.websiteSimilarity ?? 0,
        "Plagiarism Overall %": plag?.overallSimilarity ?? 0,
        "Plagiarism Reason": plag?.flaggedReason || "Clean",
        "Plagiarism Admin Verdict": plag?.adminDecision || "clean",
        "Qualification Status": isQualified ? "Qualified" : t.final_status === "rejected" ? "Disqualified" : "Not Qualified",
        Remarks: t.remarks || t.override_reason || "",
      };
    });
    exportRows(data, "complete-event-evaluation-report", format);
  };

  // Export Complete JSON
  const exportCompleteJson = () => {
    const data = rankedAll.map((t, idx) => {
      const plag = plagiarismMap.get(t.id);
      const isQualified = qualifiedTeams.some((q) => q.id === t.id);
      return {
        rank: idx + 1,
        team_id: t.id,
        team_name: t.name,
        leader_email: t.email,
        project_title: t.project_title,
        scores: {
          pdf: t.evals?.pdf?.final_score ?? null,
          github: t.evals?.github?.final_score ?? null,
          website: t.evals?.website?.final_score ?? null,
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

  return (
    <>
      <PageHeader
        title="Reports & Qualification Center"
        desc="Export official Qualified Teams lists and Complete Event Evaluation reports with full marks and plagiarism audit trails."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
          <TabsTrigger value="qualified" className="text-xs font-semibold flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" />
            Qualified Teams Report ({qualifiedTeams.length})
          </TabsTrigger>
          <TabsTrigger value="complete" className="text-xs font-semibold flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            Complete Evaluation Report ({teams.length})
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

              <div className="relative w-60">
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
              <Button size="sm" variant="secondary" onClick={() => window.print()} className="text-xs h-8">
                <Printer className="size-3.5 mr-1" /> Print Report
              </Button>
            </div>
          </div>

          {/* Qualified Table */}
          <div className="glass overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
                <tr className="border-b border-border/80">
                  <th className="p-3.5 pl-4 w-16 text-center">Rank</th>
                  <th className="p-3.5">Qualified Team Name</th>
                  <th className="p-3.5">Leader Email</th>
                  <th className="p-3.5">Project Title</th>
                  <th className="p-3.5 text-center">Overall Score</th>
                  <th className="p-3.5 pr-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {!filteredQualified.length ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No teams meet the qualification cutoff of {cutoffScore} marks. Lower the cutoff or approve teams.
                    </td>
                  </tr>
                ) : (
                  filteredQualified.map((t) => (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="p-3.5 pl-4 text-center">
                        <span className={`inline-flex items-center justify-center size-7 rounded-full font-mono text-xs font-bold ${t.rank === 1 ? "bg-amber-500/20 text-amber-500 border border-amber-500/40" :
                            t.rank === 2 ? "bg-slate-300/20 text-slate-300 border border-slate-400/40" :
                              t.rank === 3 ? "bg-amber-700/20 text-amber-600 border border-amber-700/40" :
                                "bg-muted text-muted-foreground"
                          }`}>
                          #{t.rank}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-foreground">
                        <Link to="/teams/$id" params={{ id: t.id }} className="hover:text-primary">
                          {t.name}
                        </Link>
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground font-mono">{t.email}</td>
                      <td className="p-3.5 text-xs text-muted-foreground max-w-xs truncate">
                        {t.project_title}
                      </td>
                      <td className="p-3.5 text-center font-mono text-base font-black text-emerald-500">
                        {fmt(t.officialFinal ?? t.aiFinal)}
                      </td>
                      <td className="p-3.5 pr-4 text-center">
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs">
                          <CheckCircle2 className="size-3 mr-1" /> Qualified
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  <th className="p-3 pr-4">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {!filteredComplete.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No evaluation results available.
                    </td>
                  </tr>
                ) : (
                  filteredComplete.map((t) => {
                    const plag = plagiarismMap.get(t.id);
                    const isQualified = qualifiedTeams.some((q) => q.id === t.id);

                    return (
                      <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="p-3 pl-4">
                          <Link to="/teams/$id" params={{ id: t.id }} className="font-bold text-foreground hover:text-primary">
                            {t.name}
                          </Link>
                          <div className="text-[10px] text-muted-foreground truncate">{t.project_title}</div>
                        </td>

                        <td className="p-3 text-center font-mono">
                          {t.evals?.pdf?.final_score != null ? fmt(t.evals.pdf.final_score) : "—"}
                        </td>

                        <td className="p-3 text-center font-mono">
                          {t.evals?.github?.final_score != null ? fmt(t.evals.github.final_score) : "—"}
                        </td>

                        <td className="p-3 text-center font-mono">
                          {t.evals?.website?.final_score != null ? fmt(t.evals.website.final_score) : "—"}
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

                        <td className="p-3 pr-4 max-w-36 truncate text-[11px] text-muted-foreground" title={t.remarks || t.override_reason || ""}>
                          {t.remarks || t.override_reason || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
