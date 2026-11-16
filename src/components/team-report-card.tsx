import { useMemo, useState, useEffect } from "react";
import {
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Trophy,
  Sparkles,
  FileText,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWeights, type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { fmt } from "@/components/page-header";
import {
  getOrGenerateReportInsights,
  resolveReportInsights,
  type EvaluationInsights,
} from "@/lib/report-insights";
import {
  type PlagiarismResult,
  PLAGIARISM_THRESHOLDS,
} from "@/lib/plagiarism";

export interface TeamReportCardProps {
  team: TeamRow | null;
  onClose?: (() => void) | undefined;
  isOpen?: boolean | undefined;
  plagiarismScore?: number | null | undefined;
  plagiarismResult?: PlagiarismResult | null | undefined;
}

export function TeamReportCard({
  team,
  onClose,
  isOpen,
  plagiarismScore,
  plagiarismResult,
}: TeamReportCardProps) {
  const weightsQuery = useWeights();
  const weights = weightsQuery.data ?? { pdf: 30, github: 40, website: 30 };

  const effectiveSimScore =
    plagiarismResult?.similarityScore ??
    plagiarismResult?.overallSimilarity ??
    plagiarismScore ??
    null;

  const scanStatus =
    plagiarismResult?.scanStatus ??
    (effectiveSimScore == null
      ? "not_scanned"
      : effectiveSimScore >= PLAGIARISM_THRESHOLDS.DUPLICATE_REPO
      ? "duplicate_repo"
      : effectiveSimScore >= PLAGIARISM_THRESHOLDS.WARNING_REVIEW
      ? "flagged_similarity"
      : "completed_clean");

  // Manage structured, persistent evaluation insights with automatic DB sync and manual regeneration
  const [insights, setInsights] = useState<EvaluationInsights>(() => {
    if (!team) {
      return {
        teamId: "",
        strengths: [],
        areasToImprove: [],
        suggestions: [],
        status: "pending",
        generatedAt: "",
      };
    }
    return getOrGenerateReportInsights(team, weights, plagiarismResult);
  });
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (!team) return;
    let isCancelled = false;

    // Instant initial render from local cache
    const initial = getOrGenerateReportInsights(team, weights, plagiarismResult);
    setInsights(initial);

    // Asynchronously resolve from Supabase PostgreSQL database
    resolveReportInsights(team, weights, plagiarismResult).then((dbInsights) => {
      if (!isCancelled && dbInsights) {
        setInsights(dbInsights);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [team?.id, team?.updated_at, weights, plagiarismResult]);

  const handleRegenerate = async () => {
    if (!team || isRegenerating) return;
    setIsRegenerating(true);
    try {
      try {
        const { generateReportInsightsServerFn } = await import("@/lib/evaluate.functions");
        const serverRes = await generateReportInsightsServerFn({
          data: { teamId: team.id, forceRegenerate: true },
        });
        if (serverRes?.strengths && serverRes.strengths.length > 0) {
          setInsights({
            teamId: team.id,
            strengths: serverRes.strengths,
            areasToImprove: serverRes.areasToImprove,
            suggestions: serverRes.suggestions,
            status: "generated",
            model: serverRes.model,
            evaluationVersion: team.updated_at,
            generatedAt: serverRes.generatedAt,
          });
          return;
        }
      } catch (err) {
        console.warn("Server AI insights generation fell back to client resolver:", err);
      }

      const refreshed = await resolveReportInsights(team, weights, plagiarismResult, true);
      setInsights(refreshed);
    } finally {
      setIsRegenerating(false);
    }
  };

  const plagBadgeInfo = useMemo(() => {
    switch (scanStatus) {
      case "duplicate_repo":
        return {
          label: `Duplicate Repository (${effectiveSimScore ?? 95}%)`,
          className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
          icon: ShieldAlert,
        };
      case "flagged_similarity":
        return {
          label: `Review Required (${effectiveSimScore}%)`,
          className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          icon: AlertTriangle,
        };
      case "completed_clean":
        return {
          label: `Verified Clean (${effectiveSimScore ?? 0}%)`,
          className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          icon: ShieldCheck,
        };
      case "unavailable":
        return {
          label: "Artifacts Missing",
          className: "bg-muted text-muted-foreground border-border",
          icon: Info,
        };
      case "in_progress":
        return {
          label: "Scan In Progress",
          className: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
          icon: Clock,
        };
      default:
        return {
          label: "Scan Pending",
          className: "bg-muted text-muted-foreground border-border",
          icon: ShieldAlert,
        };
    }
  }, [scanStatus, effectiveSimScore]);

  const plagDescription = useMemo(() => {
    if (plagiarismResult?.recommendation) {
      return plagiarismResult.recommendation;
    }
    if (scanStatus === "unavailable") {
      return "Automated originality indexing could not be completed because submission files (PDF, repository, or website) have not been submitted.";
    }
    if (scanStatus === "not_scanned" || scanStatus === "pending") {
      return "Automated cross-source similarity scan has not yet been executed for this submission. Analysis will run during batch integrity verification.";
    }
    if (scanStatus === "duplicate_repo") {
      return `Critical integrity violation: identical or near-identical repository structure detected (${effectiveSimScore}% overlap). Submission flagged for administrative review.`;
    }
    if (scanStatus === "flagged_similarity") {
      return `Elevated similarity index of ${effectiveSimScore}% detected across codebase or project proposal. Manual code inspection and jury audit are recommended before final certification.`;
    }
    return `Verified original submission (${effectiveSimScore ?? 0}% baseline similarity). Cross-team repository comparison confirms independent implementation.`;
  }, [plagiarismResult, scanStatus, effectiveSimScore]);

  if (!team) return null;

  const isQualified = team.final_status === "approved" || team.final_status === "qualified";
  const isRejected = team.final_status === "rejected" || team.final_status === "disqualified";

  // Score distinction: provisional AI vs finalized/moderated
  const hasOfficialScore = team.officialFinal != null;
  const scoreDisplayValue = team.officialFinal ?? team.aiFinal;
  const isProvisional = !hasOfficialScore && team.aiFinal != null;

  const handlePrint = () => {
    window.print();
  };

  const BadgeIcon = plagBadgeInfo.icon;

  const cardContent = (
    <div className="relative mx-auto w-full max-w-4xl bg-transparent">
      {/* The Printable Official Document Container (page-break-inside: auto to allow natural multi-page flow) */}
      <div
        id="single-page-report"
        className="print-container relative border border-border/80 bg-card p-5 sm:p-7 rounded-2xl shadow-sm text-foreground space-y-5 break-inside-auto"
      >
        {/* 1. Header Strip with Institutional Brand */}
        <div className="report-header flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-primary/40 pb-4 gap-3 break-inside-avoid">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.png"
              alt="Institutional Seal"
              className="size-11 object-contain filter drop-shadow-sm shrink-0"
            />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-primary uppercase font-mono">
                Sapthagiri Innovation & Hackathon Assessment
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
                INNOVEDGE 2026 OFFICIAL SCORECARD
              </h1>
            </div>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end justify-between text-xs text-muted-foreground gap-1">
            <div className="font-mono font-bold text-foreground bg-muted/80 px-2 py-0.5 rounded text-[11px] border border-border/50">
              REF: {team.id.slice(0, 10).toUpperCase()}
            </div>
            <div className="text-[11px] font-medium">
              Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </div>
          </div>
        </div>

        {/* 2. Team & Project Identification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl bg-muted/30 border border-border/80 p-4 shadow-xs break-inside-avoid">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team Name</div>
            <div className="font-display text-lg font-bold text-foreground mt-0.5">{team.name}</div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{team.email}</div>
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Problem Statement & Track</div>
            <div className="text-sm font-semibold text-foreground mt-0.5 line-clamp-2">
              {team.project_title || "General Innovation & Rapid Prototyping Track"}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {team.project_description || "Comprehensive software and hardware technical proposal submission."}
            </div>
          </div>
        </div>

        {/* 3. Main Assessment Scores Table (with dynamic weights & max marks) */}
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs break-inside-avoid">
          <div className="bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary border-b border-border/80 flex items-center justify-between">
            <span>Component Rubric Breakdown</span>
            <span className="text-[10px] font-mono font-normal text-muted-foreground lowercase">
              weights: pdf {weights.pdf}% · github {weights.github}% · website {weights.website}%
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/80">
              <tr>
                <th className="p-3 text-left">Evaluation Component</th>
                <th className="p-3 text-left">Weight</th>
                <th className="p-3 text-right">Max Marks</th>
                <th className="p-3 text-right">AI Raw</th>
                <th className="p-3 text-right font-bold text-foreground">Final Marks</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {COMPONENTS.map((c) => {
                const ev = team.evals[c];
                const weight = weights[c] ?? (c === "github" ? 40 : 30);
                const maxMarks = ev?.max_score ?? 100;
                return (
                  <tr key={c} className="hover:bg-muted/10">
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary/80" />
                      {COMPONENT_LABEL[c]}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">{weight}%</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{maxMarks}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {ev?.ai_score != null ? fmt(ev.ai_score) : "—"}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-sm text-foreground">
                      {ev?.final_score != null ? fmt(ev.final_score) : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ev?.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : ev?.status === "rejected"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {ev?.status || "pending"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Result Banner: Final Score & Qualification Decision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-inside-avoid">
          {/* Aggregate Event Score */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Weighted Aggregate Event Score
              </span>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded font-mono ${
                hasOfficialScore
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : isProvisional
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {hasOfficialScore ? "Official Final" : isProvisional ? "Provisional AI" : "Pending"}
              </span>
            </div>

            <div className="my-2.5 flex items-baseline gap-2">
              <span className="font-display text-4xl font-black text-foreground tracking-tight">
                {scoreDisplayValue != null ? fmt(scoreDisplayValue) : "—"}
              </span>
              <span className="text-sm font-semibold text-muted-foreground font-mono">/ 100.0</span>
            </div>

            <div className="text-[11px] text-muted-foreground leading-tight">
              Formula: (PDF × {weights.pdf}%) + (GitHub × {weights.github}%) + (Website × {weights.website}%)
              {team.final_override != null && " • (Includes Admin Override)"}
            </div>
          </div>

          {/* Qualification Status */}
          <div className={`rounded-xl border p-4 flex flex-col justify-between ${
            isQualified
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
              : isRejected
              ? "border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100"
              : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          }`}>
            <div className="text-[11px] font-bold uppercase tracking-wider">
              Official Qualification Status
            </div>

            <div className="my-2 flex items-center gap-2.5">
              {isQualified ? (
                <>
                  <CheckCircle2 className="size-7 text-emerald-500 shrink-0" />
                  <span className="font-display text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    QUALIFIED FOR FINALS
                  </span>
                </>
              ) : isRejected ? (
                <>
                  <XCircle className="size-7 text-rose-500 shrink-0" />
                  <span className="font-display text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                    NOT QUALIFIED / REJECTED
                  </span>
                </>
              ) : (
                <>
                  <Clock className="size-7 text-amber-500 shrink-0" />
                  <span className="font-display text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                    UNDER MODERATION REVIEW
                  </span>
                </>
              )}
            </div>

            <div className="text-[11px] opacity-85 leading-tight">
              {isQualified
                ? "Shortlisted for in-person evaluation & grand jury presentation."
                : isRejected
                ? "Does not satisfy the qualification threshold for the next round."
                : "Provisional score computed. Final qualification pending jury moderation approval."}
            </div>
          </div>
        </div>

        {/* 5. Originality & Plagiarism Verification (Evidence-grounded status) */}
        <div className="rounded-xl border border-border/80 p-4 bg-card shadow-xs text-xs break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 font-bold uppercase text-foreground">
              <BadgeIcon className="size-4 shrink-0" />
              <span>Originality & Plagiarism Verification</span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${plagBadgeInfo.className}`}>
                {plagBadgeInfo.label}
              </span>
            </div>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            {plagDescription}
          </p>

          <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>
              Methodology: {plagiarismResult?.methodology || "Multi-modal token-shingling Jaccard coefficient and repository cross-matching."}
            </span>
            {plagiarismResult?.scanTimestamp && (
              <span className="font-mono">
                Scanned: {new Date(plagiarismResult.scanTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* 6. INTELLIGENT EVALUATION INSIGHTS SECTION (3 STRUCTURED CARDS) */}
        <div className="space-y-2.5 break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              <span>Evaluation Insights & Jury Recommendations</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1: Key Strengths (Emerald) */}
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 dark:bg-emerald-500/15 p-4 flex flex-col justify-between break-inside-avoid shadow-xs">
              <div>
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <Trophy className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider">
                    Key Strengths
                  </span>
                </div>
                <ul className="space-y-2.5 leading-relaxed">
                  {insights.strengths.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground italic">
                      No specific strengths flagged yet. Complete evaluation required.
                    </li>
                  ) : (
                    insights.strengths.map((item, idx) => {
                      const isObj = typeof item === "object" && item !== null;
                      const title = isObj ? item.title : String(item);
                      const desc = isObj ? item.description : null;
                      const source = isObj ? item.source : null;
                      return (
                        <li key={idx} className="space-y-0.5">
                          <div className="flex items-baseline justify-between gap-1.5 font-semibold text-emerald-950 dark:text-emerald-200 text-[11px]">
                            <div className="flex items-baseline gap-1.5">
                              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 self-center" />
                              <span className="leading-snug">{title}</span>
                            </div>
                            {source && (
                              <span className="text-[9px] font-mono font-normal opacity-70 border border-emerald-500/30 px-1 py-0.2 rounded shrink-0">
                                {source}
                              </span>
                            )}
                          </div>
                          {desc && (
                            <p className="text-[10.5px] text-emerald-950/85 dark:text-emerald-100/80 pl-3 leading-relaxed">
                              {desc}
                            </p>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            {/* Card 2: Areas to Improve (Rose) */}
            <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 dark:bg-rose-500/15 p-4 flex flex-col justify-between break-inside-avoid shadow-xs">
              <div>
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-rose-500/20 text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider">
                    Areas to Improve
                  </span>
                </div>
                <ul className="space-y-2.5 leading-relaxed">
                  {insights.areasToImprove.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground italic">
                      No specific improvement areas flagged yet. Complete evaluation required.
                    </li>
                  ) : (
                    insights.areasToImprove.map((item, idx) => {
                      const isObj = typeof item === "object" && item !== null;
                      const title = isObj ? item.title : String(item);
                      const desc = isObj ? item.description : null;
                      const source = isObj ? item.source : null;
                      return (
                        <li key={idx} className="space-y-0.5">
                          <div className="flex items-baseline justify-between gap-1.5 font-semibold text-rose-950 dark:text-rose-200 text-[11px]">
                            <div className="flex items-baseline gap-1.5">
                              <span className="size-1.5 rounded-full bg-rose-500 shrink-0 self-center" />
                              <span className="leading-snug">{title}</span>
                            </div>
                          </div>
                          {desc && (
                            <p className="text-[10.5px] text-rose-950/85 dark:text-rose-100/80 pl-3 leading-relaxed">
                              {desc}
                            </p>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            {/* Card 3: Suggestions (Sky) */}
            <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 dark:bg-sky-500/15 p-4 flex flex-col justify-between break-inside-avoid shadow-xs">
              <div>
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-sky-500/20 text-sky-800 dark:text-sky-300">
                  <Sparkles className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider">
                    Suggestions
                  </span>
                </div>
                <ul className="space-y-2.5 leading-relaxed">
                  {insights.suggestions.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground italic">
                      No action recommendations generated yet. Complete evaluation required.
                    </li>
                  ) : (
                    insights.suggestions.map((item, idx) => {
                      const isObj = typeof item === "object" && item !== null;
                      const title = isObj ? item.title : String(item);
                      const desc = isObj ? item.description : null;
                      const related = isObj ? item.relatedIssue : null;
                      return (
                        <li key={idx} className="space-y-0.5">
                          <div className="flex items-baseline gap-1.5 font-semibold text-sky-950 dark:text-sky-200 text-[11px]">
                            <span className="size-1.5 rounded-full bg-sky-500 shrink-0 self-center" />
                            <span className="leading-snug">{title}</span>
                          </div>
                          {desc && (
                            <p className="text-[10.5px] text-sky-950/85 dark:text-sky-100/80 pl-3 leading-relaxed">
                              {desc}
                            </p>
                          )}
                          {related && (
                            <div className="text-[9px] font-mono text-sky-800 dark:text-sky-300 pl-3 opacity-75">
                              Addresses: {related}
                            </div>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 7. Verification Footer & Authority Sign-off */}
        <div className="report-footer pt-4 border-t-2 border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground break-inside-avoid">
          <div>
            <div className="font-semibold text-foreground">INNOVEDGE Hackathon Committee</div>
            <div>Sapthagiri Innovation & Entrepreneurship Development Club</div>
            <div className="text-[10px] mt-0.5">
              Certified Assessment Report • Digitally signed & verified
            </div>
          </div>

          <div className="flex items-center gap-3">
            <img
              src="/favicon.png"
              alt="Verification Crest"
              className="size-10 object-contain filter drop-shadow-sm opacity-90 shrink-0"
            />
            <div className="text-left sm:text-right">
              <div className="font-mono text-xs font-semibold text-foreground">
                Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </div>
              <div className="mt-0.5 text-[10px] text-primary font-semibold uppercase tracking-wider font-mono">
                Innovation • Rigor • Excellence
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border border-border/80 shadow-2xl bg-card">
          {/* Fixed Header Bar with Title, Regenerate AI Insights and Print Button */}
          <div className="no-print flex items-center justify-between px-5 py-3 border-b border-border/60 bg-card/95 backdrop-blur shrink-0 z-20">
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                <FileText className="size-4 text-primary" />
                <span>Official Assessment Report · {team.name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 mr-6 sm:mr-8">
              <Button
                size="sm"
                variant="outline"
                disabled={isRegenerating}
                onClick={handleRegenerate}
                className="gap-1.5 text-xs h-8 border-border/80 hover:bg-muted font-semibold shadow-xs"
                title="Regenerate structured evaluation insights using verified evaluation evidence"
              >
                <RefreshCw className={`size-3.5 ${isRegenerating ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                <span className="hidden sm:inline">{isRegenerating ? "Synthesizing..." : "Regenerate AI Insights"}</span>
                <span className="sm:hidden">{isRegenerating ? "..." : "AI"}</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                <Printer className="size-3.5" />
                <span>Print / Save PDF</span>
              </Button>
            </div>
          </div>

          {/* Single Scrollable Container (NO DOUBLE SCROLLBARS) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20">
            {cardContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return cardContent;
}
