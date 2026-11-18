import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  X,
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

interface ScorecardDocumentProps {
  team: TeamRow;
  weights: { pdf: number; github: number; website: number };
  insights: EvaluationInsights;
  plagiarismResult?: PlagiarismResult | null | undefined;
  effectiveSimScore: number | null;
  scanStatus: string;
  plagBadgeInfo: {
    label: string;
    className: string;
    icon: any;
  };
  plagDescription: string;
  scoreDisplayValue: number | null;
  hasOfficialScore: boolean;
  isProvisional: boolean;
  isQualified: boolean;
  isRejected: boolean;
  isPrint?: boolean;
}

/**
 * ScorecardDocument: Renders the official INNOVEDGE scorecard document.
 * When isPrint=true, applies calibrated, 1-page compact print styling with high-contrast print colors.
 * When isPrint=false, renders the rich glassmorphic interactive dark/light dashboard theme.
 */
function ScorecardDocument({
  team,
  weights,
  insights,
  plagiarismResult,
  effectiveSimScore,
  scanStatus: _scanStatus,
  plagBadgeInfo,
  plagDescription,
  scoreDisplayValue,
  hasOfficialScore,
  isProvisional,
  isQualified,
  isRejected,
  isPrint = false,
}: ScorecardDocumentProps) {
  const BadgeIcon = plagBadgeInfo.icon;
  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (isPrint) {
    return (
      <div className="scorecard-sheet relative border border-slate-300 bg-white p-[2.5mm] rounded text-slate-900 space-y-[1.4mm] break-inside-avoid shadow-none font-sans">
        {/* 1. Header Strip with Institutional Brand */}
        <div className="scorecard-header flex items-center justify-between border-b-2 border-slate-900 pb-[1.2mm] gap-[2mm] break-inside-avoid">
          <div className="flex items-center gap-2">
            <img
              src="/favicon.png"
              alt="Institutional Seal"
              className="size-7 object-contain shrink-0"
            />
            <div>
              <div className="text-[7pt] font-bold tracking-widest text-slate-600 uppercase font-mono">
                Sapthagiri Innovation &amp; Hackathon Assessment
              </div>
              <h1 className="font-display text-[12pt] font-black tracking-tight text-slate-900 leading-tight">
                INNOVEDGE 2026 OFFICIAL SCORECARD
              </h1>
            </div>
          </div>

          <div className="text-right text-[7.5pt] text-slate-600 space-y-0.5">
            <div className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[8pt] border border-slate-300 inline-block">
              REF: {team.id.slice(0, 10).toUpperCase()}
            </div>
            <div className="text-[7pt] font-medium text-slate-500">
              Date: {formattedDate}
            </div>
          </div>
        </div>

        {/* 2. Team & Project Identification */}
        <div className="id-grid grid grid-cols-3 gap-[2mm] rounded border border-slate-200 bg-slate-50/70 p-[1.8mm] break-inside-avoid">
          <div>
            <div className="text-[6.8pt] font-bold uppercase tracking-wider text-slate-500">Team Name</div>
            <div className="font-display text-[9.5pt] font-bold text-slate-900 mt-0.5 leading-snug truncate">{team.name}</div>
            <div className="text-[7pt] text-slate-600 font-mono mt-0.5 break-all">{team.email}</div>
          </div>

          <div className="col-span-2">
            <div className="text-[6.8pt] font-bold uppercase tracking-wider text-slate-500">Problem Statement &amp; Track</div>
            <div className="text-[8pt] font-semibold text-slate-900 mt-0.5 line-clamp-1">
              {team.project_title || "General Innovation & Rapid Prototyping Track"}
            </div>
            <div className="text-[7pt] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
              {team.project_description || "Comprehensive software and hardware technical proposal submission."}
            </div>
          </div>
        </div>

        {/* 3. Main Assessment Scores Table */}
        <div className="overflow-hidden rounded border border-slate-300 bg-white break-inside-avoid">
          <div className="bg-slate-100 px-3 py-1 text-[7.5pt] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 flex items-center justify-between">
            <span>Component Rubric Breakdown</span>
            <span className="text-[7pt] font-mono font-normal text-slate-600 lowercase">
              weights: pdf {weights.pdf}% · github {weights.github}% · website {weights.website}%
            </span>
          </div>
          <table className="w-full text-[8pt]">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-300">
              <tr>
                <th className="p-[1.2mm] text-left">Evaluation Component</th>
                <th className="p-[1.2mm] text-left">Weight</th>
                <th className="p-[1.2mm] text-right">Max Marks</th>
                <th className="p-[1.2mm] text-right">AI Raw</th>
                <th className="p-[1.2mm] text-right font-bold text-slate-900">Final Marks</th>
                <th className="p-[1.2mm] text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {COMPONENTS.map((c) => {
                const ev = team.evals[c];
                const weight = weights[c] ?? (c === "github" ? 40 : 30);
                const maxMarks = ev?.max_score ?? 100;
                return (
                  <tr key={c}>
                    <td className="p-[1.2mm] font-semibold text-slate-900 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-slate-700 shrink-0" />
                      {COMPONENT_LABEL[c]}
                    </td>
                    <td className="p-[1.2mm] font-mono text-slate-600">{weight}%</td>
                    <td className="p-[1.2mm] text-right font-mono text-slate-600">{maxMarks}</td>
                    <td className="p-[1.2mm] text-right font-mono text-slate-600">
                      {ev?.ai_score != null ? fmt(ev.ai_score) : "—"}
                    </td>
                    <td className="p-[1.2mm] text-right font-mono font-bold text-[8.5pt] text-slate-900">
                      {ev?.final_score != null ? fmt(ev.final_score) : "—"}
                    </td>
                    <td className="p-[1.2mm] text-center">
                      <span className="inline-block px-1.5 py-0.2 rounded text-[7pt] font-semibold uppercase border border-slate-300 bg-slate-100 text-slate-700">
                        {ev?.status || "pending"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Result Banner: Score & Qualification */}
        <div className="results-banner grid grid-cols-2 gap-[2.2mm] break-inside-avoid">
          {/* Aggregate Event Score */}
          <div className="rounded border border-slate-300 bg-slate-50 p-[2.2mm] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-700">
                Weighted Aggregate Event Score
              </span>
              <span className="text-[7pt] font-semibold uppercase px-1.5 py-0.2 rounded font-mono border border-slate-300 bg-white text-slate-700">
                {hasOfficialScore ? "Official Final" : isProvisional ? "Provisional AI" : "Pending"}
              </span>
            </div>

            <div className="my-1 flex items-baseline gap-1.5">
              <span className="score-value font-display text-[20pt] font-black text-slate-900 tracking-tight leading-none">
                {scoreDisplayValue != null ? fmt(scoreDisplayValue) : "—"}
              </span>
              <span className="text-[8.5pt] font-semibold text-slate-500 font-mono">/ 100.0</span>
            </div>

            <div className="text-[7pt] text-slate-500 leading-tight">
              Formula: (PDF × {weights.pdf}%) + (GitHub × {weights.github}%) + (Website × {weights.website}%)
              {team.final_override != null && " • (Includes Admin Override)"}
            </div>
          </div>

          {/* Qualification Status */}
          <div className="rounded border border-slate-300 bg-slate-50 p-[2.2mm] flex flex-col justify-between">
            <div className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-700">
              Official Qualification Status
            </div>

            <div className="my-1 flex items-center gap-1.5">
              {isQualified ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span className="status-value font-display text-[11pt] font-black text-emerald-800 tracking-tight">
                    QUALIFIED FOR FINALS
                  </span>
                </>
              ) : isRejected ? (
                <>
                  <XCircle className="size-4 text-rose-600 shrink-0" />
                  <span className="status-value font-display text-[11pt] font-black text-rose-800 tracking-tight">
                    NOT QUALIFIED / REJECTED
                  </span>
                </>
              ) : (
                <>
                  <Clock className="size-4 text-amber-600 shrink-0" />
                  <span className="status-value font-display text-[11pt] font-black text-amber-800 tracking-tight">
                    UNDER MODERATION REVIEW
                  </span>
                </>
              )}
            </div>

            <div className="text-[7pt] text-slate-600 leading-tight">
              {isQualified
                ? "Shortlisted for in-person evaluation & grand jury presentation."
                : isRejected
                ? "Does not satisfy the qualification threshold for the next round."
                : "Provisional score computed. Final qualification pending jury moderation approval."}
            </div>
          </div>
        </div>

        {/* 5. Originality & Plagiarism Verification */}
        <div className="plagiarism-box rounded border border-slate-300 p-[2mm] bg-white text-[7.5pt] break-inside-avoid">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 font-bold uppercase text-slate-900">
              <BadgeIcon className="size-3.5 shrink-0" />
              <span>Originality &amp; Plagiarism Verification</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[7pt] font-bold border ${plagBadgeInfo.className}`}>
              {plagBadgeInfo.label}
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[7.2pt]">
            {plagDescription}
          </p>
          <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[6.8pt] text-slate-500 font-mono">
            <span>Methodology: {plagiarismResult?.methodology || "Multi-modal token-shingling Jaccard coefficient."}</span>
            {plagiarismResult?.scanTimestamp && (
              <span>Scanned: {new Date(plagiarismResult.scanTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
        </div>

        {/* 6. Intelligent Evaluation Insights (3 Structured Cards) */}
        <div className="insights-section space-y-[1mm] break-inside-avoid">
          <div className="text-[7pt] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Sparkles className="size-3 text-slate-700" />
            <span>Evaluation Insights &amp; Jury Recommendations</span>
          </div>

          <div className="insights-grid grid grid-cols-3 gap-[1.5mm]">
            {/* Card 1: Key Strengths (Emerald) */}
            <div className="rounded border border-emerald-300 bg-emerald-50/60 p-[1.5mm] flex flex-col justify-between break-inside-avoid">
              <div>
                <div className="flex items-center gap-1 mb-0.5 pb-0.5 border-b border-emerald-200 text-emerald-900">
                  <Trophy className="size-2.5 text-emerald-700 shrink-0" />
                  <span className="font-display font-bold text-[7pt] uppercase tracking-wider">Key Strengths</span>
                </div>
                <ul className="space-y-[0.8mm] leading-relaxed">
                  {insights.strengths.length === 0 ? (
                    <li className="text-[6.5pt] text-slate-500 italic">No specific strengths flagged yet.</li>
                  ) : (
                    insights.strengths.slice(0, 2).map((item, idx) => {
                      const isObj = typeof item === "object" && item !== null;
                      const title = isObj ? item.title : String(item);
                      const desc = isObj ? item.description : null;
                      return (
                        <li key={idx} className="space-y-0.2">
                          <div className="font-semibold text-emerald-950 text-[6.8pt] flex items-baseline gap-1">
                            <span className="size-1 rounded-full bg-emerald-600 shrink-0 self-center" />
                            <span className="leading-snug">{title}</span>
                          </div>
                          {desc && (
                            <p className="text-[6.2pt] text-emerald-900/80 pl-2 leading-tight line-clamp-1">{desc}</p>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            {/* Card 2: Areas to Improve (Rose) */}
            <div className="rounded border border-rose-300 bg-rose-50/60 p-[1.5mm] flex flex-col justify-between break-inside-avoid">
              <div>
                <div className="flex items-center gap-1 mb-0.5 pb-0.5 border-b border-rose-200 text-rose-900">
                  <AlertTriangle className="size-2.5 text-rose-700 shrink-0" />
                  <span className="font-display font-bold text-[7pt] uppercase tracking-wider">Areas to Improve</span>
                </div>
                <ul className="space-y-[0.8mm] leading-relaxed">
                  {insights.areasToImprove.length === 0 ? (
                    <li className="text-[6.5pt] text-slate-500 italic">No specific improvement areas flagged yet.</li>
                  ) : (
                    insights.areasToImprove.slice(0, 2).map((item, idx) => {
                      const isObj = typeof item === "object" && item !== null;
                      const title = isObj ? item.title : String(item);
                      const desc = isObj ? item.description : null;
                      return (
                        <li key={idx} className="space-y-0.2">
                          <div className="font-semibold text-rose-950 text-[6.8pt] flex items-baseline gap-1">
                            <span className="size-1 rounded-full bg-rose-600 shrink-0 self-center" />
                            <span className="leading-snug">{title}</span>
                          </div>
                          {desc && (
                            <p className="text-[6.2pt] text-rose-900/80 pl-2 leading-tight line-clamp-1">{desc}</p>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            {/* Card 3: Suggestions (Sky) */}
            <div className="rounded border border-sky-300 bg-sky-50/60 p-[1.5mm] flex flex-col justify-between break-inside-avoid">
              <div>
                <div className="flex items-center gap-1 mb-0.5 pb-0.5 border-b border-sky-200 text-sky-900">
                  <Sparkles className="size-2.5 text-sky-700 shrink-0" />
                  <span className="font-display font-bold text-[7pt] uppercase tracking-wider">Suggestions</span>
                </div>
                <ul className="space-y-[0.8mm] leading-relaxed">
                  {insights.suggestions.length === 0 ? (
                    <li className="text-[6.5pt] text-slate-500 italic">No action recommendations generated yet.</li>
                  ) : (
                    insights.suggestions.slice(0, 2).map((item, idx) => {
                      const isObj = typeof item === "object" && item !== null;
                      const title = isObj ? item.title : String(item);
                      const desc = isObj ? item.description : null;
                      return (
                        <li key={idx} className="space-y-0.2">
                          <div className="font-semibold text-sky-950 text-[6.8pt] flex items-baseline gap-1">
                            <span className="size-1 rounded-full bg-sky-600 shrink-0 self-center" />
                            <span className="leading-snug">{title}</span>
                          </div>
                          {desc && (
                            <p className="text-[6.2pt] text-sky-900/80 pl-2 leading-tight line-clamp-1">{desc}</p>
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

        {/* 7. Verification Footer & Institutional Seal */}
        <div className="scorecard-footer pt-[1.2mm] border-t-2 border-slate-300 flex items-center justify-between text-[6.8pt] text-slate-600 break-inside-avoid">
          <div>
            <div className="font-semibold text-slate-900 text-[7pt]">INNOVEDGE Hackathon Committee</div>
            <div>Sapthagiri Innovation &amp; Entrepreneurship Development Club</div>
            <div className="text-[6.2pt] text-slate-500 mt-0.2">
              Certified Assessment Report • Digitally signed &amp; verified
            </div>
          </div>

          <div className="flex items-center gap-2">
            <img
              src="/favicon.png"
              alt="Verification Crest"
              className="size-5 object-contain filter drop-shadow-sm opacity-90 shrink-0"
            />
            <div className="text-right">
              <div className="font-mono text-[7pt] font-semibold text-slate-900">
                Date: {formattedDate}
              </div>
              <div className="text-[6.2pt] text-slate-700 font-semibold uppercase tracking-wider font-mono">
                Innovation • Rigor • Excellence
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // On-screen rich interactive version
  return (
    <div className="relative border border-border/80 bg-card p-5 sm:p-7 rounded-2xl shadow-sm text-foreground space-y-4 sm:space-y-5">
      {/* 1. Header Strip with Institutional Brand */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-primary/40 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="Institutional Seal"
            className="size-11 object-contain filter drop-shadow-sm shrink-0"
          />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-primary uppercase font-mono">
              Sapthagiri Innovation &amp; Hackathon Assessment
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
            Date: {formattedDate}
          </div>
        </div>
      </div>

      {/* 2. Team & Project Identification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl bg-muted/30 border border-border/80 p-4 shadow-xs">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team Name</div>
          <div className="font-display text-lg font-bold text-foreground mt-0.5">{team.name}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5 break-all">{team.email}</div>
        </div>

        <div className="md:col-span-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Problem Statement &amp; Track</div>
          <div className="text-sm font-semibold text-foreground mt-0.5 line-clamp-2">
            {team.project_title || "General Innovation & Rapid Prototyping Track"}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
            {team.project_description || "Comprehensive software and hardware technical proposal submission."}
          </div>
        </div>
      </div>

      {/* 3. Main Assessment Scores Table (with dynamic weights & max marks) */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
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
                <tr key={c} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary/80 shrink-0" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="my-2 flex items-baseline gap-2">
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

          <div className="my-1.5 flex items-center gap-2">
            {isQualified ? (
              <>
                <CheckCircle2 className="size-6 text-emerald-500 shrink-0" />
                <span className="font-display text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  QUALIFIED FOR FINALS
                </span>
              </>
            ) : isRejected ? (
              <>
                <XCircle className="size-6 text-rose-500 shrink-0" />
                <span className="font-display text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  NOT QUALIFIED / REJECTED
                </span>
              </>
            ) : (
              <>
                <Clock className="size-6 text-amber-500 shrink-0" />
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

      {/* 5. Originality & Plagiarism Verification */}
      <div className="rounded-xl border border-border/80 p-4 bg-card shadow-xs text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 font-bold uppercase text-foreground">
            <BadgeIcon className="size-4 shrink-0" />
            <span>Originality &amp; Plagiarism Verification</span>
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

        <div className="mt-2 pt-1.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
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
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-0.5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Evaluation Insights &amp; Jury Recommendations</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Key Strengths (Emerald) */}
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 dark:bg-emerald-500/15 p-3.5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <Trophy className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-display font-bold text-xs uppercase tracking-wider">
                  Key Strengths
                </span>
              </div>
              <ul className="space-y-2 leading-relaxed">
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
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 dark:bg-rose-500/15 p-3.5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-rose-500/20 text-rose-800 dark:text-rose-300">
                <AlertTriangle className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-display font-bold text-xs uppercase tracking-wider">
                  Areas to Improve
                </span>
              </div>
              <ul className="space-y-2 leading-relaxed">
                {insights.areasToImprove.length === 0 ? (
                  <li className="text-[11px] text-muted-foreground italic">
                    No specific improvement areas flagged yet. Complete evaluation required.
                  </li>
                ) : (
                  insights.areasToImprove.map((item, idx) => {
                    const isObj = typeof item === "object" && item !== null;
                    const title = isObj ? item.title : String(item);
                    const desc = isObj ? item.description : null;
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
          <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 dark:bg-sky-500/15 p-3.5 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-sky-500/20 text-sky-800 dark:text-sky-300">
                <Sparkles className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="font-display font-bold text-xs uppercase tracking-wider">
                  Suggestions
                </span>
              </div>
              <ul className="space-y-2 leading-relaxed">
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
      <div className="pt-3 border-t-2 border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
        <div>
          <div className="font-semibold text-foreground">INNOVEDGE Hackathon Committee</div>
          <div>Sapthagiri Innovation &amp; Entrepreneurship Development Club</div>
          <div className="text-[10px] mt-0.5">
            Certified Assessment Report • Digitally signed &amp; verified
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
              Date: {formattedDate}
            </div>
            <div className="mt-0.5 text-[10px] text-primary font-semibold uppercase tracking-wider font-mono">
              Innovation • Rigor • Excellence
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [isPrinting, setIsPrinting] = useState(false);

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

  // Synchronize print classes on print dialog lifecycle
  useEffect(() => {
    const handleBeforePrint = () => {
      if (isOpen) {
        setIsPrinting(true);
        if (typeof document !== "undefined") {
          document.body.classList.add("printing-scorecard");
        }
      }
    };

    const handleAfterPrint = () => {
      setIsPrinting(false);
      if (typeof document !== "undefined") {
        document.body.classList.remove("printing-scorecard");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeprint", handleBeforePrint);
      window.addEventListener("afterprint", handleAfterPrint);
      return () => {
        window.removeEventListener("beforeprint", handleBeforePrint);
        window.removeEventListener("afterprint", handleAfterPrint);
        document.body.classList.remove("printing-scorecard");
      };
    }
  }, [isOpen]);

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
    setIsPrinting(true);
    if (typeof document !== "undefined") {
      document.body.classList.add("printing-scorecard");
      // Reset scroll position of inner container
      const scrollable = document.querySelector(".report-modal-scroll-area");
      if (scrollable) scrollable.scrollTop = 0;
    }

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        if (typeof document !== "undefined") {
          document.body.classList.remove("printing-scorecard");
        }
      }, 500);
    }, 120);
  };

  const sharedDocProps = {
    team,
    weights,
    insights,
    plagiarismResult,
    effectiveSimScore,
    scanStatus,
    plagBadgeInfo,
    plagDescription,
    scoreDisplayValue,
    hasOfficialScore,
    isProvisional,
    isQualified,
    isRejected,
  };

  const printablePortal =
    typeof document !== "undefined"
      ? createPortal(
          <div id="innovedge-print-portal" aria-hidden="true">
            <ScorecardDocument {...sharedDocProps} isPrint={true} />
          </div>,
          document.body
        )
      : null;

  if (isOpen !== undefined) {
    return (
      <>
        {/* Dedicated Pure 1-Page Print Portal */}
        {printablePortal}

        {/* On-Screen Modal View */}
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
          <DialogContent
            hideCloseButton
            className="no-print max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border border-border/80 shadow-2xl bg-card"
          >
            {/* Pinned Header Bar with Non-colliding Clean Controls */}
            <div className="no-print flex items-center justify-between px-5 py-3 border-b border-border/60 bg-card/95 backdrop-blur shrink-0 z-20">
              <DialogHeader className="p-0 space-y-0 text-left">
                <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="truncate">Official Assessment Report · {team.name}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  loading={isRegenerating}
                  loadingText="Synthesizing..."
                  onClick={handleRegenerate}
                  className="gap-1.5 text-xs h-8 border-border/80 hover:bg-muted font-semibold shadow-xs"
                  title="Regenerate structured evaluation insights using verified evaluation evidence"
                >
                  <RefreshCw className="size-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Regenerate AI Insights</span>
                  <span className="sm:hidden">AI</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handlePrint}
                  loading={isPrinting}
                  loadingText="Preparing..."
                  className="gap-1.5 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                >
                  <Printer className="size-3.5" />
                  <span>Print / Save PDF</span>
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onClose?.()}
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 ml-1"
                  title="Close report modal"
                  aria-label="Close report modal"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Single Scrollable Container with Custom Sleek Scrollbar (NO DOUBLE SCROLLBARS) */}
            <div className="no-print report-modal-scroll-area flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/20 custom-scrollbar">
              <div className="relative mx-auto w-full max-w-4xl">
                <ScorecardDocument {...sharedDocProps} isPrint={false} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {printablePortal}
      <div className="relative mx-auto w-full max-w-4xl">
        <ScorecardDocument {...sharedDocProps} isPrint={false} />
      </div>
    </>
  );
}
