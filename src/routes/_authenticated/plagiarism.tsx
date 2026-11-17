import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  Github,
  Globe,
  Sliders,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { PageHeader, fmt, StatusBadge } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn, StaggerContainer, StaggerItem, PulsingScanner } from "@/components/ui/motion-primitives";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { StatCardSkeleton, CardGridSkeleton } from "@/components/ui/skeleton";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import {
  runComprehensivePlagiarismScan,
  applyAdminPlagiarismVerdict,
  type PlagiarismResult,
  type PlagiarismDecision,
} from "@/lib/plagiarism";

export const Route = createFileRoute("/_authenticated/plagiarism")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Plagiarism Detection — INNOVEDGE Assessor" },
      { name: "description", content: "Dedicated multi-vector plagiarism detection across PDF, GitHub code, and website submissions." },
      { property: "og:title", content: "Plagiarism Detection — INNOVEDGE Assessor" },
      { property: "og:description", content: "Dedicated multi-vector plagiarism detection across PDF, GitHub code, and website submissions." },
    ],
  }),
  component: PlagiarismPage,
});

function PlagiarismPage() {
  const qc = useQueryClient();
  const rows = useTeamRows();
  const teams = rows.data ?? [];

  const [q, setQ] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterDecision, setFilterDecision] = useState<string>("all");
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Penalty Modal State
  const [penaltyTarget, setPenaltyTarget] = useState<TeamRow | null>(null);
  const [penaltyPoints, setPenaltyPoints] = useState<string>("20");
  const [penaltyReason, setPenaltyReason] = useState<string>("");

  // Run initial scan
  const [plagiarismMap, setPlagiarismMap] = useState<Map<string, PlagiarismResult>>(() =>
    runComprehensivePlagiarismScan(teams)
  );

  const results = useMemo(() => {
    // Sync with updated teams
    const currentScan = runComprehensivePlagiarismScan(teams);
    return Array.from(currentScan.values());
  }, [teams]);

  // Summary Metrics
  const totalScanned = results.length;
  const highRiskCount = results.filter((r) => r.severity === "high").length;
  const mediumRiskCount = results.filter((r) => r.severity === "medium").length;
  const pendingReviewCount = results.filter((r) => r.adminDecision === "pending_review").length;
  const confirmedPlagiarismCount = results.filter((r) => r.adminDecision === "flagged" || r.adminDecision === "penalty_applied").length;

  const handleRescan = () => {
    setScanning(true);
    toast.info("Running multi-vector plagiarism scan across PDF, GitHub code, and live web apps...");
    setTimeout(() => {
      const res = runComprehensivePlagiarismScan(teams);
      setPlagiarismMap(res);
      setScanning(false);
      const flagged = Array.from(res.values()).filter((p) => p.isFlagged).length;
      if (flagged > 0) {
        toast.warning(`Scan complete: ${flagged} team(s) flagged for code/text similarity.`);
      } else {
        toast.success("Scan complete: No suspicious cross-team duplication detected.");
      }
    }, 600);
  };

  const handleVerdict = async (team: TeamRow, decision: PlagiarismDecision, notes?: string, deduction?: number) => {
    try {
      await applyAdminPlagiarismVerdict(team, decision, {
        ...(notes ? { notes } : {}),
        ...(deduction != null ? { deduction } : {}),
        reviewerId: "admin-reviewer",
      });
      toast.success(`Plagiarism verdict applied for ${team.name}: ${decision.replace("_", " ")}`);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save verdict");
    }
  };

  const submitPenalty = async () => {
    if (!penaltyTarget) return;
    const pts = Number(penaltyPoints);
    if (isNaN(pts) || pts <= 0) return toast.error("Please enter a valid deduction amount");
    await handleVerdict(penaltyTarget, "penalty_applied", penaltyReason || "Plagiarism penalty deducted", pts);
    setPenaltyTarget(null);
  };

  // Filtered List
  const filteredList = useMemo(() => {
    const s = q.toLowerCase();
    return results.filter((r) => {
      const team = teams.find((t) => t.id === r.teamId);
      if (!team) return false;

      const matchesSearch =
        !s ||
        team.name.toLowerCase().includes(s) ||
        team.email?.toLowerCase().includes(s) ||
        r.suspectedSource?.toLowerCase().includes(s) ||
        r.flaggedReason.toLowerCase().includes(s);

      const matchesSeverity =
        filterSeverity === "all" ||
        (filterSeverity === "flagged" && r.isFlagged) ||
        r.severity === filterSeverity;

      const matchesDecision =
        filterDecision === "all" ||
        r.adminDecision === filterDecision;

      return matchesSearch && matchesSeverity && matchesDecision;
    });
  }, [results, teams, q, filterSeverity, filterDecision]);

  const getSeverityBadge = (severity: PlagiarismResult["severity"]) => {
    switch (severity) {
      case "high":
        return <Badge variant="destructive" className="font-mono text-xs">High Risk</Badge>;
      case "medium":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs">Medium Risk</Badge>;
      case "low":
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30 font-mono text-xs">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10 border-emerald-500/20 font-mono text-xs">Clean</Badge>;
    }
  };

  const getDecisionBadge = (decision: PlagiarismDecision) => {
    switch (decision) {
      case "flagged":
        return <Badge variant="destructive">Confirmed Plagiarism</Badge>;
      case "penalty_applied":
        return <Badge className="bg-orange-600 text-white">Penalty Deducted</Badge>;
      case "dismissed":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-500">Dismissed (Clean)</Badge>;
      case "pending_review":
        return <Badge variant="outline" className="text-amber-500 border-amber-500 animate-pulse">Pending Review</Badge>;
      default:
        return <Badge variant="secondary" className="text-muted-foreground">Clean</Badge>;
    }
  };

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Plagiarism Detection Module"
          desc="Dedicated cross-team similarity scanning across PDF documents, GitHub code, and deployed websites."
        >
          <Button onClick={handleRescan} disabled={scanning} size="sm">
            <RotateCw className={`size-4 mr-1.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning…" : "Re-scan Submissions"}
          </Button>
        </PageHeader>
      </FadeIn>

      {/* Active Live Scanner Effect */}
      {scanning && (
        <FadeIn className="mb-5">
          <PulsingScanner label="Multi-Vector Plagiarism Detection Engine Active" />
        </FadeIn>
      )}

      {/* Overview Stat Cards with Staggered Entrance & 3D Interactive Tilting */}
      {rows.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-5">
          <StaggerItem>
            <GlassCard3D
              glowColor="rgba(217, 90, 43, 0.2)"
              className="p-4 border-border/80 group"
            >
              <div className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                <span>Teams Analyzed</span>
                <CheckCircle2 className="size-4 text-primary transition-transform duration-300 group-hover:scale-125" />
              </div>
              <div className="mt-1 font-mono text-2xl font-bold">
                <AnimatedNumber value={totalScanned} precision={0} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Multi-vector checks</div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D
              glowColor="rgba(244, 63, 94, 0.28)"
              className="p-4 border-rose-500/30 bg-rose-500/5 group"
            >
              <div className="text-[11px] font-semibold uppercase text-rose-500 flex items-center justify-between">
                <span>High Similarity</span>
                <ShieldAlert className="size-4 text-rose-500 transition-transform duration-300 group-hover:scale-125" />
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-rose-500">
                <AnimatedNumber value={highRiskCount} precision={0} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">&gt;50% code/PDF overlap</div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D
              glowColor="rgba(245, 158, 11, 0.25)"
              className="p-4 border-amber-500/30 bg-amber-500/5 group"
            >
              <div className="text-[11px] font-semibold uppercase text-amber-500 flex items-center justify-between">
                <span>Medium Overlap</span>
                <AlertTriangle className="size-4 text-amber-500 transition-transform duration-300 group-hover:scale-125" />
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-amber-500">
                <AnimatedNumber value={mediumRiskCount} precision={0} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">35% - 50% overlap</div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D
              glowColor="rgba(217, 90, 43, 0.22)"
              className="p-4 border-primary/30 bg-primary/5 group"
            >
              <div className="text-[11px] font-semibold uppercase text-primary flex items-center justify-between">
                <span>Needs Admin Review</span>
                <Info className="size-4 text-primary transition-transform duration-300 group-hover:scale-125" />
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-primary">
                <AnimatedNumber value={pendingReviewCount} precision={0} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Admin final decision required</div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D
              glowColor="rgba(16, 185, 129, 0.2)"
              className="p-4 border-border/80 group"
            >
              <div className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                <span>Actions Taken</span>
                <Sparkles className="size-4 text-emerald-500 transition-transform duration-300 group-hover:scale-125" />
              </div>
              <div className="mt-1 font-mono text-2xl font-bold text-foreground">
                <AnimatedNumber value={confirmedPlagiarismCount} precision={0} />
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Penalized / Disqualified</div>
            </GlassCard3D>
          </StaggerItem>
        </StaggerContainer>
      )}

      {/* Boilerplate Filter Notice Banner */}
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/10 p-3.5 text-xs flex items-start gap-2.5">
        <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-primary font-semibold">Boilerplate & Standard Libraries Protection Active:</strong> Common React, Tailwind CSS, Express, and Vite starters are automatically isolated and excluded from plagiarism scoring. Only non-trivial logic, problem formulation, and cross-team code copying are flagged. Final decisions require admin confirmation.
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9 text-xs"
            placeholder="Search by team name, leader email, or suspected source..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-full sm:w-44 text-xs">
            <SelectValue placeholder="Filter Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="high">High Risk (&gt;50%)</SelectItem>
            <SelectItem value="medium">Medium Risk (35-50%)</SelectItem>
            <SelectItem value="low">Low Similarity</SelectItem>
            <SelectItem value="clean">Clean (No Overlap)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterDecision} onValueChange={setFilterDecision}>
          <SelectTrigger className="w-full sm:w-48 text-xs">
            <SelectValue placeholder="Admin Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Admin Statuses</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="clean">Clean / Unflagged</SelectItem>
            <SelectItem value="dismissed">Dismissed by Admin</SelectItem>
            <SelectItem value="flagged">Confirmed Plagiarism</SelectItem>
            <SelectItem value="penalty_applied">Penalty Deducted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Team Plagiarism Cards */}
      {rows.isLoading ? (
        <CardGridSkeleton count={4} className="grid-cols-1" />
      ) : !filteredList.length ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          <ShieldCheck className="size-10 text-emerald-500 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-foreground">No matching submissions found</p>
          <p className="text-xs mt-1">Adjust your search query or filters above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const team = teams.find((t) => t.id === item.teamId);
            if (!team) return null;
            const isExpanded = expandedTeamId === item.teamId;

            return (
              <div
                key={item.teamId}
                className={`glass rounded-2xl border transition-all ${
                  item.isFlagged
                    ? "border-rose-500/30 bg-rose-500/[0.02]"
                    : "border-border/60 hover:border-border"
                }`}
              >
                {/* Header row */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/teams/$id"
                        params={{ id: team.id }}
                        className="font-bold text-base text-foreground hover:text-primary transition-colors"
                      >
                        {team.name}
                      </Link>
                      {getSeverityBadge(item.severity)}
                      {getDecisionBadge(item.adminDecision)}
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        Confidence: {Math.round(item.confidence * 100)}%
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {team.project_title || "Project Title"} · <span className="font-mono">{team.email}</span>
                    </p>

                    {item.suspectedSource && (
                      <div className="mt-2 text-xs flex items-center gap-1.5 text-rose-500 font-medium">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>Suspected Source: <strong>{item.suspectedSource}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Similarity Percentages Strip */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                    <div className="rounded-xl bg-card border border-border/60 px-3 py-2 text-center min-w-[70px]">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1">
                        <FileText className="size-3 text-rose-400" /> PDF
                      </div>
                      <div className={`font-mono text-sm font-bold ${item.pdfSimilarity != null && item.pdfSimilarity >= 35 ? "text-rose-500" : "text-foreground"}`}>
                        {item.pdfSimilarity != null ? `${item.pdfSimilarity}%` : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-card border border-border/60 px-3 py-2 text-center min-w-[70px]">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1">
                        <Github className="size-3 text-sky-400" /> Code
                      </div>
                      <div className={`font-mono text-sm font-bold ${item.githubSimilarity != null && item.githubSimilarity >= 35 ? "text-rose-500" : "text-foreground"}`}>
                        {item.githubSimilarity != null ? `${item.githubSimilarity}%` : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-card border border-border/60 px-3 py-2 text-center min-w-[70px]">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1">
                        <Globe className="size-3 text-emerald-400" /> Web
                      </div>
                      <div className={`font-mono text-sm font-bold ${item.websiteSimilarity != null && item.websiteSimilarity >= 35 ? "text-rose-500" : "text-foreground"}`}>
                        {item.websiteSimilarity != null ? `${item.websiteSimilarity}%` : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-center min-w-[80px]">
                      <div className="text-[10px] font-semibold text-primary uppercase">Overall Sim</div>
                      <div className="font-mono text-base font-black text-primary">
                        {item.overallSimilarity != null ? `${item.overallSimilarity}%` : "—"}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedTeamId(isExpanded ? null : item.teamId)}
                      className="h-9 px-3"
                    >
                      {isExpanded ? (
                        <>Hide Evidence <ChevronUp className="size-3.5 ml-1" /></>
                      ) : (
                        <>View Evidence ({item.evidence.length}) <ChevronDown className="size-3.5 ml-1" /></>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Evidence & Admin Review Drawer */}
                {isExpanded && (
                  <div className="border-t border-border/50 bg-card/40 p-4 sm:p-5 space-y-4">
                    {/* Reason Why Flagged */}
                    <div className="rounded-xl bg-muted/40 p-3.5 border border-border/40 text-xs">
                      <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                        <Info className="size-4 text-primary" /> Detection Rationale & Analysis:
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{item.flaggedReason}</p>
                    </div>

                    {/* Evidence Snippet Diffs */}
                    {item.evidence.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                          Suspected Overlap Snippets & Evidence ({item.evidence.length})
                        </div>

                        {item.evidence.map((ev, evIdx) => (
                          <div key={evIdx} className="rounded-xl border border-border/60 bg-background/80 p-3.5 text-xs space-y-2">
                            <div className="flex items-center justify-between font-medium">
                              <span className="flex items-center gap-1.5 text-rose-500 font-semibold">
                                <AlertTriangle className="size-3.5" /> {ev.title}
                              </span>
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {ev.similarity}% token match
                              </Badge>
                            </div>

                            <p className="text-muted-foreground">{ev.explanation}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              <div className="rounded-lg bg-card p-2.5 border border-border/40">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                                  {team.name} Submission:
                                </div>
                                <pre className="font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap leading-tight bg-muted/30 p-2 rounded">
                                  {ev.teamSnippet}
                                </pre>
                              </div>

                              <div className="rounded-lg bg-card p-2.5 border border-border/40">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                                  Suspected Match: {ev.matchedSource}
                                </div>
                                <pre className="font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap leading-tight bg-muted/30 p-2 rounded">
                                  {ev.matchedSnippet}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic p-2">
                        No suspicious snippets found. Code and proposal content appear distinct and authentic.
                      </div>
                    )}

                    {/* Admin Decision Bar */}
                    <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-foreground">Admin Review & Final Decision</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Plagiarism is never auto-declared. Choose an action based on your verification:
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerdict(team, "dismissed", "Verified by admin: legitimate independent implementation / standard patterns.")}
                          className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 text-xs"
                        >
                          <CheckCircle2 className="size-3.5 mr-1" /> Dismiss / Mark Clean
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPenaltyTarget(team)}
                          className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 text-xs"
                        >
                          <Sliders className="size-3.5 mr-1" /> Deduct Penalty
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVerdict(team, "flagged", "Disqualified due to confirmed uncredited duplication.")}
                          className="text-xs"
                        >
                          <XCircle className="size-3.5 mr-1" /> Disqualify Team
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Score Penalty Modal */}
      <Dialog open={!!penaltyTarget} onOpenChange={(open) => !open && setPenaltyTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Sliders className="size-5" /> Apply Plagiarism Score Penalty
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Deduct points from <strong>{penaltyTarget?.name}</strong>'s overall score.
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Score Deduction (Points to subtract)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={penaltyPoints}
                onChange={(e) => setPenaltyPoints(e.target.value)}
                className="font-mono text-sm font-bold mt-1"
                placeholder="20"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Penalty Rationale</Label>
              <Textarea
                rows={2}
                value={penaltyReason}
                onChange={(e) => setPenaltyReason(e.target.value)}
                placeholder="e.g. Uncredited code pattern similarity in backend module"
                className="text-xs resize-none mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPenaltyTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitPenalty}>
              Apply Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

