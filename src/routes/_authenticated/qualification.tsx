import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Search,
  Printer,
  ShieldCheck,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  Check,
  Sparkles,
  ArrowUpDown,
  X,
  ExternalLink,
  Trash2,
  Trophy,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { updatePersistentTeam } from "@/lib/team-store";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import { runFastPlagiarismCheck, applyPlagiarismDeduction, type PlagiarismResult } from "@/lib/plagiarism";
import { TeamReportCard } from "@/components/team-report-card";
import { DeleteTeamModal } from "@/components/delete-team-modal";
import { QualifiedTeamsReport } from "@/components/qualified-teams-report";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn, StaggerContainer, StaggerItem, Magnetic } from "@/components/ui/motion-primitives";
import { GlassCard3D } from "@/components/ui/glass-card-3d";

export const Route = createFileRoute("/_authenticated/qualification")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Team Qualification — INNOVEDGE Assessor" },
      { name: "description", content: "Shortlist qualified teams and print official 1-page reports with plagiarism check." },
      { property: "og:title", content: "Team Qualification — INNOVEDGE Assessor" },
      { property: "og:description", content: "Shortlist qualified teams and print official 1-page reports with plagiarism check." },
    ],
  }),
  component: QualificationPage,
});

function QualificationPage() {
  const qc = useQueryClient();
  const rows = useTeamRows();
  const teams = rows.data ?? [];

  // Search & Filter State
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "qualified" | "not_qualified" | "flagged">("all");
  const [selectedPs, setSelectedPs] = useState("all");
  const [sortBy, setSortBy] = useState<"score_desc" | "name_asc" | "plagiarism_desc">("score_desc");

  // Selected Team for 1-Page PDF Report Modal
  const [reportTeam, setReportTeam] = useState<TeamRow | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<TeamRow | null>(null);

  // Top N & Cutoff Shortlist Controls
  const [topNInput, setTopNInput] = useState<number>(10);
  const [cutoffInput, setCutoffInput] = useState<number>(70);
  const [showQualifiedReportModal, setShowQualifiedReportModal] = useState<boolean>(false);
  const [isPrintingQualified, setIsPrintingQualified] = useState<boolean>(false);

  // Plagiarism Results Map
  const [plagiarismMap, setPlagiarismMap] = useState<Map<string, PlagiarismResult>>(() =>
    runFastPlagiarismCheck(teams)
  );
  const [hasRunPlagiarismCheck, setHasRunPlagiarismCheck] = useState(false);

  // Compute stats
  const totalCount = teams.length;
  const qualifiedCount = teams.filter((t) => t.final_status === "approved" || t.final_status === "qualified").length;
  const flaggedCount = Array.from(plagiarismMap.values()).filter((p) => p.isFlagged).length;

  // Sorted list of officially qualified teams (for certified PDF export)
  const rankedQualifiedTeams = useMemo(() => {
    return teams
      .filter((t) => t.final_status === "approved" || t.final_status === "qualified")
      .sort((a, b) => {
        const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
        const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
        return scoreB - scoreA;
      });
  }, [teams]);

  // Extract unique problem statements
  const problemStatements = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.project_title) {
        const match = t.project_title.match(/^\[([^\]]+)\]/);
        set.add(match && match[1] ? match[1] : t.project_title);
      }
    });
    return Array.from(set);
  }, [teams]);

  // Run Plagiarism Check
  const handleRunPlagiarism = () => {
    const res = runFastPlagiarismCheck(teams);
    setPlagiarismMap(res);
    setHasRunPlagiarismCheck(true);
    const flagged = Array.from(res.values()).filter((p) => p.isFlagged).length;
    if (flagged > 0) {
      toast.warning(`Plagiarism scan complete: ${flagged} team(s) flagged for similarity or duplicate code.`);
    } else {
      toast.success("Plagiarism scan complete: All teams are clean with no significant overlap!");
    }
  };

  // Toggle Qualification Tick for a Team
  const handleToggleQualify = async (team: TeamRow, currentlyQualified: boolean) => {
    const nextStatus = currentlyQualified ? "pending" : "approved";

    // Update persistent store immediately
    updatePersistentTeam(team.id, {
      final_status: nextStatus,
      updated_at: new Date().toISOString(),
    });

    try {
      await supabase
        .from("teams")
        .update({
          final_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      await logActivity(
        nextStatus === "approved" ? "Qualified team" : "Unmarked qualified team",
        `${team.name} -> ${nextStatus}`
      );
    } catch (err) {
      console.warn("Could not sync qualification status to remote database:", err);
    }

    qc.invalidateQueries({ queryKey: ["team-rows"] });
    toast.success(
      nextStatus === "approved"
        ? `✓ ${team.name} marked as QUALIFIED for Round 2`
        : `${team.name} qualification status reset to Pending`
    );
  };

  // Qualify Top N Teams by Competitive Ranking (e.g. Top 10, Top 5)
  const handleQualifyTopN = async (count: number) => {
    if (count <= 0) return;

    // Rank all teams by aggregate score descending
    const sorted = [...teams].sort((a, b) => {
      const sA = a.officialFinal ?? a.aiFinal ?? -1;
      const sB = b.officialFinal ?? b.aiFinal ?? -1;
      return sB - sA;
    });

    const targetTeams = sorted.slice(0, count);
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

  // Qualify by Minimum Score Cutoff Threshold
  const handleQualifyCutoff = async (cutoff: number) => {
    const toQualify = teams.filter(
      (t) => (t.officialFinal ?? t.aiFinal ?? 0) >= cutoff && t.final_status !== "qualified" && t.final_status !== "approved"
    );

    if (toQualify.length === 0) {
      return toast.info(`No unapproved teams found with score >= ${cutoff}%.`);
    }

    if (!confirm(`Mark ${toQualify.length} team(s) with score >= ${cutoff}% as officially QUALIFIED?`)) return;

    toQualify.forEach((t) => {
      updatePersistentTeam(t.id, { final_status: "approved", updated_at: new Date().toISOString() });
    });

    try {
      await supabase
        .from("teams")
        .update({ final_status: "approved", updated_at: new Date().toISOString() })
        .in(
          "id",
          toQualify.map((t) => t.id)
        );

      await logActivity("Bulk qualified teams by cutoff", `${toQualify.length} teams qualified with score >= ${cutoff}%`);
    } catch (err) {}

    qc.invalidateQueries({ queryKey: ["team-rows"] });
    toast.success(`✓ Successfully qualified ${toQualify.length} teams with score >= ${cutoff}%!`);
  };

  // Reset all qualification ticks back to Pending
  const handleResetAllQualifications = async () => {
    const currentlyQual = teams.filter((t) => t.final_status === "approved" || t.final_status === "qualified");
    if (!currentlyQual.length) {
      return toast.info("No teams are currently marked as qualified.");
    }

    if (!confirm(`Reset qualification status for all ${currentlyQual.length} qualified team(s) back to Pending?`)) {
      return;
    }

    currentlyQual.forEach((t) => {
      updatePersistentTeam(t.id, { final_status: "pending", updated_at: new Date().toISOString() });
    });

    try {
      await supabase
        .from("teams")
        .update({ final_status: "pending", updated_at: new Date().toISOString() })
        .in(
          "id",
          currentlyQual.map((t) => t.id)
        );

      await logActivity("Reset qualifications", `${currentlyQual.length} teams reset to pending`);
    } catch (err) {}

    qc.invalidateQueries({ queryKey: ["team-rows"] });
    toast.info(`Qualification reset to Pending for ${currentlyQual.length} team(s).`);
  };

  // Direct Form-Wise PDF Print (Clean pure document, no sliders or website screenshot)
  const handleDirectPrintPdf = () => {
    if (!rankedQualifiedTeams.length) {
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

  // Apply Plagiarism Deduction
  const handleApplyPenalty = async (team: TeamRow) => {
    const plag = plagiarismMap.get(team.id);
    if (!plag) return;

    if (!confirm(`Apply penalty to "${team.name}" for ${plag.similarityScore}% similarity? This will update their final marks.`)) return;

    try {
      await applyPlagiarismDeduction(team, plag);
      qc.invalidateQueries({ queryKey: ["team-rows"] });
      toast.success(`Plagiarism penalty applied to ${team.name}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Filtered and Sorted Teams
  const filteredTeams = useMemo(() => {
    const term = q.toLowerCase();

    return teams
      .filter((t) => {
        // Search filter
        const matchesQuery =
          !term ||
          t.name.toLowerCase().includes(term) ||
          (t.email && t.email.toLowerCase().includes(term)) ||
          (t.project_title && t.project_title.toLowerCase().includes(term)) ||
          (t.remarks && t.remarks.toLowerCase().includes(term));

        // Status filter
        const isQualified = t.final_status === "approved" || t.final_status === "qualified";
        const isFlagged = plagiarismMap.get(t.id)?.isFlagged ?? false;

        let matchesStatus = true;
        if (statusFilter === "qualified") matchesStatus = isQualified;
        else if (statusFilter === "not_qualified") matchesStatus = !isQualified;
        else if (statusFilter === "flagged") matchesStatus = isFlagged;

        // Problem statement filter
        const matchesPs =
          selectedPs === "all" ||
          (t.project_title && t.project_title.toLowerCase().includes(selectedPs.toLowerCase()));

        return matchesQuery && matchesStatus && matchesPs;
      })
      .sort((a, b) => {
        if (sortBy === "score_desc") {
          const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
          const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
          return scoreB - scoreA;
        }
        if (sortBy === "name_asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "plagiarism_desc") {
          const simA = plagiarismMap.get(a.id)?.similarityScore ?? 0;
          const simB = plagiarismMap.get(b.id)?.similarityScore ?? 0;
          return simB - simA;
        }
        return 0;
      });
  }, [teams, q, statusFilter, selectedPs, sortBy, plagiarismMap]);

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Team Qualification"
          desc="Shortlist top-performing teams for Round 2, select Top N finalists, and export certified form-wise PDF reports."
        >
          <Magnetic strength={4}>
            <Button variant="outline" onClick={handleRunPlagiarism} className="gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Run Plagiarism Check
            </Button>
          </Magnetic>
          <Magnetic strength={4}>
            <Button
              variant="outline"
              onClick={() => {
                if (!rankedQualifiedTeams.length) {
                  return toast.info("No teams currently qualified. Click 'Top 10' or tick teams below first.");
                }
                setShowQualifiedReportModal(true);
              }}
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10 shadow-xs"
            >
              <FileText className="size-4" />
              Preview PDF Form ({qualifiedCount})
            </Button>
          </Magnetic>
          <Magnetic strength={4}>
            <Button
              onClick={handleDirectPrintPdf}
              loading={isPrintingQualified}
              loadingText="Formatting PDF..."
              className="gap-2 bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90"
            >
              <Printer className="size-4" />
              Print / Save PDF Form
            </Button>
          </Magnetic>
        </PageHeader>
      </FadeIn>

      {/* Stats Cards Banner with 3D Tilt & Specular Sheen */}
      <StaggerContainer className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <GlassCard3D
            glowColor="rgba(217, 90, 43, 0.2)"
            className="p-4 flex items-center gap-3 border-border/80 group"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold transition-transform duration-300 group-hover:scale-115">
              <AnimatedNumber value={totalCount} precision={0} />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium uppercase truncate">Total Teams</div>
              <div className="text-base sm:text-lg font-bold text-foreground truncate">
                <AnimatedNumber value={totalCount} precision={0} /> Registered
              </div>
            </div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D
            glowColor="rgba(16, 185, 129, 0.25)"
            className="p-4 flex items-center gap-3 border-emerald-500/25 bg-emerald-500/[0.03] group"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold transition-transform duration-300 group-hover:scale-115">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium uppercase truncate">Qualified</div>
              <div className="text-base sm:text-lg font-bold text-emerald-600 truncate">
                <AnimatedNumber value={qualifiedCount} precision={0} /> Shortlisted
              </div>
            </div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D
            glowColor="rgba(245, 158, 11, 0.25)"
            className="p-4 flex items-center gap-3 border-amber-500/25 bg-amber-500/[0.03] group"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 font-bold transition-transform duration-300 group-hover:scale-115">
              <AnimatedNumber value={totalCount - qualifiedCount} precision={0} />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium uppercase truncate">Pending Review</div>
              <div className="text-base sm:text-lg font-bold text-foreground truncate">
                <AnimatedNumber value={totalCount - qualifiedCount} precision={0} /> Teams
              </div>
            </div>
          </GlassCard3D>
        </StaggerItem>

        <StaggerItem>
          <GlassCard3D
            glowColor="rgba(244, 63, 94, 0.25)"
            className="p-4 flex items-center gap-3 border-rose-500/25 bg-rose-500/[0.03] group"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-600 font-bold transition-transform duration-300 group-hover:scale-115">
              <AlertTriangle className="size-5 text-rose-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium uppercase truncate">Plagiarism Flagged</div>
              <div className="text-base sm:text-lg font-bold text-rose-600 truncate">
                <AnimatedNumber value={flaggedCount} precision={0} /> Teams
              </div>
            </div>
          </GlassCard3D>
        </StaggerItem>
      </StaggerContainer>

      {/* Quick Finalist Shortlist & Selection Bar */}
      <div className="mb-5 glass rounded-2xl p-4 sm:p-5 border border-border/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" />
            <span className="text-sm font-bold text-foreground">
              Select Finalist Shortlist (Round 2 Qualification):
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Qualified:{" "}
            <strong className="text-emerald-600 font-bold">{qualifiedCount}</strong> / {totalCount} Teams
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Quick preset buttons */}
          <span className="text-xs font-semibold text-muted-foreground">Select Top:</span>
          {[5, 10, 15, 20].map((n) => (
            <Button
              key={n}
              size="sm"
              variant="secondary"
              onClick={() => handleQualifyTopN(n)}
              className="h-8 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
            >
              Top {n}
            </Button>
          ))}

          <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Custom N input */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Top</span>
            <Input
              type="number"
              min={1}
              max={totalCount || 100}
              value={topNInput}
              onChange={(e) => setTopNInput(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 h-8 text-xs text-center font-mono font-bold"
            />
            <Button
              size="sm"
              onClick={() => handleQualifyTopN(topNInput)}
              className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Qualify Top {topNInput}
            </Button>
          </div>

          <div className="h-4 w-px bg-border/60 mx-1 hidden md:block" />

          {/* Cutoff input */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Cutoff &ge;</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={cutoffInput}
              onChange={(e) => setCutoffInput(Number(e.target.value) || 0)}
              className="w-16 h-8 text-xs text-center font-mono font-bold"
            />
            <span className="text-xs text-muted-foreground font-mono">%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQualifyCutoff(cutoffInput)}
              className="h-8 text-xs font-semibold border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
            >
              Qualify &ge;{cutoffInput}%
            </Button>
          </div>

          {/* Reset button */}
          {qualifiedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetAllQualifications}
              className="ml-auto h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Reset all qualification ticks back to pending"
            >
              <RotateCcw className="size-3.5 mr-1" />
              Reset All ({qualifiedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
        <div className="relative min-w-0 sm:min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search teams by name, email, problem statement..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-full sm:w-44 bg-background">
              <SelectValue placeholder="Qualification Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams ({totalCount})</SelectItem>
              <SelectItem value="qualified">Qualified Only ({qualifiedCount})</SelectItem>
              <SelectItem value="not_qualified">Not Qualified ({totalCount - qualifiedCount})</SelectItem>
              <SelectItem value="flagged">Plagiarism Flagged ({flaggedCount})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPs} onValueChange={setSelectedPs}>
            <SelectTrigger className="w-full sm:w-48 bg-background">
              <SelectValue placeholder="Problem Statement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Challenges</SelectItem>
              {problemStatements.map((ps) => (
                <SelectItem key={ps} value={ps}>
                  {ps}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-full sm:w-40 bg-background">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score_desc">Score: High to Low</SelectItem>
              <SelectItem value="name_asc">Name: Alphabetical</SelectItem>
              <SelectItem value="plagiarism_desc">Plagiarism: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Teams Qualification Table */}
      {rows.isLoading ? (
        <TableSkeleton rows={7} cols={8} />
      ) : filteredTeams.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-lg font-semibold text-foreground">No matching teams found</div>
          <p className="mt-1 text-sm text-muted-foreground">Adjust your search or filter options to see teams.</p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 text-center w-28">Qualify</th>
                <th className="p-3">Team & Email</th>
                <th className="p-3">Problem Statement</th>
                <th className="p-3 text-right">PDF</th>
                <th className="p-3 text-right">GitHub</th>
                <th className="p-3 text-right">Website</th>
                <th className="p-3 text-right">Final Score</th>
                <th className="p-3 text-center">Originality</th>
                <th className="p-3 text-center">1-Page Report</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((t) => {
                const isQualified = t.final_status === "approved" || t.final_status === "qualified";
                const plag = plagiarismMap.get(t.id);
                const score = t.officialFinal ?? t.aiFinal;

                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border/50 transition-colors ${
                      isQualified
                        ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                        : plag?.isFlagged
                        ? "bg-rose-500/[0.03] hover:bg-rose-500/[0.07]"
                        : "hover:bg-accent/30"
                    }`}
                  >
                    {/* Ticking / Checkbox Option for Qualification */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Checkbox
                          checked={isQualified}
                          onCheckedChange={() => handleToggleQualify(t, isQualified)}
                          className="size-5 rounded-md data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isQualified ? "text-emerald-600" : "text-muted-foreground"
                          }`}
                        >
                          {isQualified ? "Qualified" : "Pending"}
                        </span>
                      </div>
                    </td>

                    {/* Team Name */}
                    <td className="p-3">
                      <Link to="/teams/$id" params={{ id: t.id }} className="font-semibold text-foreground hover:text-primary">
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.email || "No email provided"}</div>
                    </td>

                    {/* Problem Statement */}
                    <td className="max-w-56 p-3">
                      {t.project_title ? (
                        <div className="truncate text-xs text-muted-foreground" title={t.project_title}>
                          {t.project_title.startsWith("[") ? (
                            <span className="font-mono font-bold text-primary mr-1">
                              {t.project_title.match(/^\[([^\]]+)\]/)?.[0]}
                            </span>
                          ) : null}
                          {t.project_title.replace(/^\[[^\]]+\]\s*/, "")}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">General</span>
                      )}
                    </td>

                    {/* PDF Component */}
                    <td className="p-3 text-right font-mono text-xs">
                      <AnimatedNumber value={t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score} precision={1} />
                    </td>

                    {/* GitHub Component */}
                    <td className="p-3 text-right font-mono text-xs">
                      <AnimatedNumber value={t.evals?.github?.final_score ?? t.evals?.github?.ai_score} precision={1} />
                    </td>

                    {/* Website Component */}
                    <td className="p-3 text-right font-mono text-xs">
                      <AnimatedNumber value={t.evals?.website?.final_score ?? t.evals?.website?.ai_score} precision={1} />
                    </td>

                    {/* Final Score */}
                    <td className="p-3 text-right font-mono font-bold text-base text-foreground">
                      <AnimatedNumber value={score} precision={1} className={score && score >= 70 ? "text-emerald-500" : "text-foreground"} />
                    </td>

                    {/* Plagiarism Status */}
                    <td className="p-3 text-center">
                      {plag?.isFlagged ? (
                        <div className="inline-flex flex-col items-center">
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600"
                            title={plag.notes.join("\n")}
                          >
                            <AlertTriangle className="size-3" />
                            {plag.similarityScore}% Match
                          </span>
                          <button
                            onClick={() => handleApplyPenalty(t)}
                            className="mt-0.5 text-[10px] text-destructive hover:underline font-medium"
                          >
                            Apply penalty
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          <Check className="size-3" />
                          Clean
                        </span>
                      )}
                    </td>

                    {/* 1-Page PDF Report Button */}
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs hover:border-primary hover:text-primary shadow-sm"
                        onClick={() => setReportTeam(t)}
                        title="Open official 1-page report for printing"
                      >
                        <FileText className="size-3.5 text-primary" />
                        1-Page Report
                      </Button>
                    </td>

                    {/* Delete Team Button */}
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs"
                        onClick={() => setTeamToDelete(t)}
                        title="Delete team"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal requiring typing 'delete' in small letters */}
      <DeleteTeamModal
        team={teamToDelete}
        isOpen={!!teamToDelete}
        onClose={() => setTeamToDelete(null)}
      />

      {/* Official 1-Page Scorecard / Report Modal */}
      <TeamReportCard
        team={reportTeam}
        isOpen={!!reportTeam}
        onClose={() => setReportTeam(null)}
        plagiarismScore={reportTeam ? (plagiarismMap.get(reportTeam.id)?.overallSimilarity ?? plagiarismMap.get(reportTeam.id)?.similarityScore) : undefined}
        plagiarismResult={reportTeam ? plagiarismMap.get(reportTeam.id) : undefined}
      />

      {/* Official Form-Wise Qualified Teams Report & Dedicated Print Portal */}
      <QualifiedTeamsReport
        teams={rankedQualifiedTeams}
        isOpen={showQualifiedReportModal}
        onClose={() => setShowQualifiedReportModal(false)}
        selectionTitle={`Top ${rankedQualifiedTeams.length} Shortlisted Finalists`}
        totalRegisteredCount={totalCount}
        plagiarismMap={plagiarismMap}
      />
    </>
  );
}
