"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, Download, FileSpreadsheet, Trophy, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { exportRows } from "@/lib/export";
import { fmt } from "@/components/page-header";
import type { TeamRow } from "@/lib/queries";
import type { PlagiarismResult } from "@/lib/plagiarism";

interface QualifiedTeamsReportProps {
  teams: TeamRow[];
  isOpen: boolean;
  onClose: () => void;
  selectionTitle?: string | undefined;
  totalRegisteredCount?: number | undefined;
  plagiarismMap?: Map<string, PlagiarismResult> | undefined;
}

export function QualifiedTeamsReport({
  teams,
  isOpen,
  onClose,
  selectionTitle = "Top Merit Shortlist",
  totalRegisteredCount,
  plagiarismMap,
}: QualifiedTeamsReportProps) {
  const [mounted, setMounted] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforePrint = () => {
      setIsPrinting(true);
      document.body.classList.add("printing-qualified-list");
    };

    const handleAfterPrint = () => {
      setIsPrinting(false);
      document.body.classList.remove("printing-qualified-list");
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("printing-qualified-list");
    };
  }, []);

  const handlePrint = () => {
    setIsPrinting(true);
    document.body.classList.add("printing-qualified-list");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        document.body.classList.remove("printing-qualified-list");
      }, 500);
    }, 100);
  };

  const handleExportCsv = () => {
    const data = teams.map((t, idx) => ({
      Rank: idx + 1,
      "Team Name": t.name,
      "Leader Email": t.email,
      "Project Challenge": t.project_title || "General Track",
      "PDF Score (30%)": fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score),
      "GitHub Score (40%)": fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score),
      "Website Score (30%)": fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score),
      "Aggregate Score (/100)": fmt(t.officialFinal ?? t.aiFinal),
      "Integrity Status": (plagiarismMap?.get(t.id)?.overallSimilarity ?? 0) < 35 ? "Clean" : "Flagged",
      "Official Qualification Status": "QUALIFIED FOR ROUND 2",
    }));
    exportRows(data, "qualified-teams-shortlist", "csv");
  };

  const handleExportExcel = () => {
    const data = teams.map((t, idx) => ({
      Rank: idx + 1,
      "Team Name": t.name,
      "Leader Email": t.email,
      "Project Challenge": t.project_title || "General Track",
      "PDF Score (30%)": fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score),
      "GitHub Score (40%)": fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score),
      "Website Score (30%)": fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score),
      "Aggregate Score (/100)": fmt(t.officialFinal ?? t.aiFinal),
      "Integrity Status": (plagiarismMap?.get(t.id)?.overallSimilarity ?? 0) < 35 ? "Clean" : "Flagged",
      "Official Qualification Status": "QUALIFIED FOR ROUND 2",
    }));
    exportRows(data, "qualified-teams-shortlist", "xlsx");
  };

  const printPortal =
    mounted && typeof document !== "undefined"
      ? createPortal(
          <div id="innovedge-qualified-print-portal" aria-hidden="true">
            <QualifiedDocumentView
              teams={teams}
              isPrint={true}
              selectionTitle={selectionTitle}
              totalRegisteredCount={totalRegisteredCount}
              plagiarismMap={plagiarismMap}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {printPortal}

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          hideCloseButton
          className="no-print max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border border-border/80 bg-background shadow-2xl"
        >
          {/* Action Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-card">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Official Qualified Teams Document (PDF Form)
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {teams.length} Team(s) Shortlisted · Official Certified Format
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                className="h-8 text-xs gap-1"
              >
                <Download className="size-3.5" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
                className="h-8 text-xs gap-1"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" /> Excel
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                loading={isPrinting}
                loadingText="Formatting PDF..."
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-sm"
              >
                <Printer className="size-3.5" />
                <span>Print / Save as PDF</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 text-muted-foreground hover:text-foreground ml-1"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Document Preview Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/20">
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-xl p-6 sm:p-8 border border-slate-200">
              <QualifiedDocumentView
                teams={teams}
                isPrint={false}
                selectionTitle={selectionTitle}
                totalRegisteredCount={totalRegisteredCount}
                plagiarismMap={plagiarismMap}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Pure institutional form document view.
 * Renders identically on-screen and inside the print portal.
 */
function QualifiedDocumentView({
  teams,
  isPrint,
  selectionTitle,
  totalRegisteredCount,
  plagiarismMap,
}: {
  teams: TeamRow[];
  isPrint: boolean;
  selectionTitle: string;
  totalRegisteredCount?: number | undefined;
  plagiarismMap?: Map<string, PlagiarismResult> | undefined;
}) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const avgScore = teams.length
    ? (
        teams.reduce((acc, t) => acc + (t.officialFinal ?? t.aiFinal ?? 0), 0) / teams.length
      ).toFixed(1)
    : "—";

  const topScore = teams.length
    ? Math.max(...teams.map((t) => t.officialFinal ?? t.aiFinal ?? 0)).toFixed(1)
    : "—";

  const lowestQualScore = teams.length
    ? Math.min(...teams.map((t) => t.officialFinal ?? t.aiFinal ?? 0)).toFixed(1)
    : "—";

  return (
    <div className={`qualified-sheet ${isPrint ? "print-sheet" : ""}`}>
      {/* 1. Institutional Document Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/innovedge-logo.png"
            alt="INNOVEDGE Emblem"
            className="size-12 object-contain"
          />
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-amber-700">
              INNOVEDGE Assessor Platform · Institutional Evaluation Council
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
              Official Shortlist of Qualified Teams
            </h1>
            <div className="text-xs font-semibold text-slate-600">
              Round 2 Qualification &amp; Grand Finale Advancement Roster
            </div>
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div><strong className="text-slate-900">Date:</strong> {currentDate}</div>
          <div><strong className="text-slate-900">Time:</strong> {currentTime}</div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            Status: <span className="font-bold text-emerald-700">CERTIFIED</span>
          </div>
        </div>
      </div>

      {/* 2. Official Summary Meta Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded border border-slate-200 mb-4 text-xs font-mono">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
            Qualified Finalists
          </span>
          <span className="text-base font-black text-slate-900">{teams.length} Teams</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
            Total Submissions
          </span>
          <span className="text-base font-black text-slate-900">
            {totalRegisteredCount ?? teams.length} Registered
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
            Score Range (Top / Min)
          </span>
          <span className="text-base font-black text-slate-900">
            {topScore} / {lowestQualScore}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">
            Selection Criteria
          </span>
          <span className="text-sm font-bold text-slate-900 font-sans truncate" title={selectionTitle}>
            {selectionTitle}
          </span>
        </div>
      </div>

      {/* 3. Formal Table of Qualified Teams */}
      <div className="overflow-x-auto border border-slate-300 rounded mb-5">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
              <th className="p-2 pl-3 text-center w-12 border-r border-slate-700">Rank</th>
              <th className="p-2 border-r border-slate-700">Team Name &amp; Contact</th>
              <th className="p-2 border-r border-slate-700">Project Challenge</th>
              <th className="p-2 text-center w-16 border-r border-slate-700">PDF (30%)</th>
              <th className="p-2 text-center w-16 border-r border-slate-700">Code (40%)</th>
              <th className="p-2 text-center w-16 border-r border-slate-700">Web (30%)</th>
              <th className="p-2 text-center w-20 border-r border-slate-700">Overall /100</th>
              <th className="p-2 text-center w-20 border-r border-slate-700">Integrity</th>
              <th className="p-2 pr-3 text-center w-24">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {!teams.length ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  No teams currently selected as qualified.
                </td>
              </tr>
            ) : (
              teams.map((t, idx) => {
                const score = t.officialFinal ?? t.aiFinal;
                const plag = plagiarismMap?.get(t.id);
                const isClean = (plag?.overallSimilarity ?? 0) < 35;
                const isOdd = idx % 2 === 1;

                return (
                  <tr
                    key={t.id || idx}
                    className={`page-break-inside-avoid ${isOdd ? "bg-slate-50" : "bg-white"}`}
                  >
                    {/* Rank */}
                    <td className="p-2 pl-3 text-center font-bold font-mono border-r border-slate-200 text-slate-900">
                      #{idx + 1}
                    </td>

                    {/* Team Name & Contact */}
                    <td className="p-2 border-r border-slate-200">
                      <div className="font-bold text-slate-900 text-[12px]">{t.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{t.email}</div>
                    </td>

                    {/* Project Challenge */}
                    <td className="p-2 border-r border-slate-200 max-w-xs">
                      <div className="font-medium text-slate-800 line-clamp-1">
                        {t.project_title || "General Innovation Proposal"}
                      </div>
                    </td>

                    {/* Component: PDF */}
                    <td className="p-2 text-center font-mono border-r border-slate-200 text-slate-700">
                      {fmt(t.evals?.pdf?.final_score ?? t.evals?.pdf?.ai_score)}
                    </td>

                    {/* Component: GitHub */}
                    <td className="p-2 text-center font-mono border-r border-slate-200 text-slate-700">
                      {fmt(t.evals?.github?.final_score ?? t.evals?.github?.ai_score)}
                    </td>

                    {/* Component: Website */}
                    <td className="p-2 text-center font-mono border-r border-slate-200 text-slate-700">
                      {fmt(t.evals?.website?.final_score ?? t.evals?.website?.ai_score)}
                    </td>

                    {/* Overall Aggregate Score */}
                    <td className="p-2 text-center font-mono font-black text-sm border-r border-slate-200 text-slate-900">
                      {score != null ? score.toFixed(1) : "—"}
                    </td>

                    {/* Integrity Status */}
                    <td className="p-2 text-center border-r border-slate-200">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isClean
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isClean ? "Clean" : `${plag?.overallSimilarity}% Match`}
                      </span>
                    </td>

                    {/* Decision */}
                    <td className="p-2 pr-3 text-center">
                      <span className="inline-flex items-center gap-0.5 font-bold text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        <CheckCircle2 className="size-3" /> QUALIFIED
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Jury Certification Signatures */}
      <div className="pt-4 border-t-2 border-slate-800 page-break-inside-avoid">
        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-8 text-center">
          Official Jury Certification &amp; Institutional Endorsement
        </div>
        <div className="grid grid-cols-3 gap-6 text-center text-xs">
          <div className="border-t border-slate-400 pt-2">
            <div className="font-bold text-slate-900">Chief Technical Evaluator</div>
            <div className="text-[10px] text-slate-500 font-mono">INNOVEDGE AI Evaluation Board</div>
          </div>
          <div className="border-t border-slate-400 pt-2">
            <div className="font-bold text-slate-900">Academic Jury Chairperson</div>
            <div className="text-[10px] text-slate-500 font-mono">Sapthagiri College of Engineering</div>
          </div>
          <div className="border-t border-slate-400 pt-2">
            <div className="font-bold text-slate-900">Institutional Organizing Secretary</div>
            <div className="text-[10px] text-slate-500 font-mono">Hackathon Grand Directorate</div>
          </div>
        </div>

        {/* Verification Footer Note */}
        <div className="mt-4 text-center text-[9px] text-slate-400 font-mono">
          Document generated by INNOVEDGE Assessor Platform · Tamper-proof institutional evaluation record.
        </div>
      </div>
    </div>
  );
}
