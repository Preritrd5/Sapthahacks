import { useRef } from "react";
import { Printer, Download, CheckCircle, XCircle, Clock, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { fmt } from "@/components/page-header";

export function TeamReportCard({
  team,
  onClose,
  isOpen,
  plagiarismScore = 0,
}: {
  team: TeamRow | null;
  onClose?: () => void;
  isOpen?: boolean;
  plagiarismScore?: number;
}) {
  if (!team) return null;

  const isQualified = team.final_status === "approved" || team.final_status === "qualified";
  const isRejected = team.final_status === "rejected" || team.final_status === "disqualified";

  // Generate dynamic, actionable improvements based on score deductions
  const improvements: string[] = [];
  const pdfEval = team.evals["pdf"];
  const ghEval = team.evals["github"];
  const webEval = team.evals["website"];

  if (pdfEval?.final_score != null && pdfEval.max_score != null) {
    const pct = (Number(pdfEval.final_score) / Number(pdfEval.max_score)) * 100;
    if (pct < 70) {
      improvements.push("Documentation: Elaborate on the technical architecture, implementation roadmap, and empirical impact metrics in the project PDF.");
    }
  }

  if (ghEval?.final_score != null && ghEval.max_score != null) {
    const pct = (Number(ghEval.final_score) / Number(ghEval.max_score)) * 100;
    if (pct < 70) {
      improvements.push("Code Quality: Enhance modularity, add unit test coverage, and ensure clear README setup instructions.");
    }
  }

  if (webEval?.final_score != null && webEval.max_score != null) {
    const pct = (Number(webEval.final_score) / Number(webEval.max_score)) * 100;
    if (pct < 70) {
      improvements.push("Prototype / Web: Refine user experience, improve mobile responsiveness, and connect dynamic backend API interactions.");
    }
  }

  if (plagiarismScore >= 35) {
    improvements.push(`Originality: Content similarity of ${plagiarismScore}% detected. Replace third-party template sections with original implementations.`);
  }

  if (improvements.length === 0) {
    improvements.push("Maintain current high code quality, benchmark system performance under peak load, and prepare an interactive pitch for Round 2.");
    improvements.push("Expand automated integration tests and refine responsive UI edge cases.");
  }

  const handlePrint = () => {
    window.print();
  };

  const cardContent = (
    <div className="relative mx-auto w-full max-w-4xl bg-background text-foreground">
      {/* The Printable Official Document Container */}
      <div
        id="single-page-report"
        className="print-container relative border border-border/80 bg-white dark:bg-card p-5 sm:p-7 rounded-2xl shadow-sm text-slate-900 dark:text-slate-100"
        style={{
          pageBreakInside: "avoid",
          breakInside: "avoid",
        }}
      >
        {/* Content Layer */}
        <div className="relative z-10 space-y-5">
          {/* Header Strip with Institutional Brand */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-primary/40 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/favicon.png"
                alt="Logo"
                className="size-11 object-contain filter drop-shadow-sm"
              />
              <div>
                <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
                  Sapthagiri Innovation & Hackathon Assessment
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  INNOVEDGE 2026 OFFICIAL SCORECARD
                </h1>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between text-xs text-muted-foreground gap-1">
              <div className="font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded text-[11px]">
                REF: {team.id.slice(0, 10).toUpperCase()}
              </div>
              <div className="text-[11px]">
                Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </div>
            </div>
          </div>

          {/* Team & Project Identification */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl bg-card border border-border p-4 shadow-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Team Name</div>
              <div className="font-display text-lg font-bold text-foreground mt-0.5">{team.name}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">{team.email}</div>
            </div>

            <div className="md:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Problem Statement & Track</div>
              <div className="text-sm font-semibold text-foreground mt-0.5 line-clamp-2">
                {team.project_title || "General Innovation & Rapid Prototyping"}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {team.project_description || "Comprehensive software and hardware technical proposal submission."}
              </div>
            </div>
          </div>

          {/* Main Assessment Scores Table */}
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <div className="bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary border-b border-border/80">
              Component Rubric Breakdown
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
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
                  const weight = c === "github" ? 40 : 30;
                  return (
                    <tr key={c} className="hover:bg-muted/10">
                      <td className="p-3 font-semibold text-foreground flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-primary/70" />
                        {COMPONENT_LABEL[c]}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{weight}%</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">100</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{ev?.ai_score != null ? fmt(ev.ai_score) : "—"}</td>
                      <td className="p-3 text-right font-mono font-bold text-sm text-foreground">
                        {ev?.final_score != null ? fmt(ev.final_score) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-muted text-foreground">
                          {ev?.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Result Banner: Final Score & Qualification Decision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Weighted Aggregate Event Score
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="font-display text-4xl font-black text-foreground">
                  {fmt(team.officialFinal ?? team.aiFinal)}
                </span>
                <span className="text-sm font-semibold text-muted-foreground font-mono">/ 100.0</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Formula: (PDF × 0.3) + (GitHub × 0.4) + (Website × 0.3)
                {team.final_override != null && " • (Includes Admin Override)"}
              </div>
            </div>

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
              <div className="my-2 flex items-center gap-2">
                {isQualified ? (
                  <>
                    <CheckCircle className="size-7 text-emerald-500" />
                    <span className="font-display text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      QUALIFIED FOR FINALS
                    </span>
                  </>
                ) : isRejected ? (
                  <>
                    <XCircle className="size-7 text-rose-500" />
                    <span className="font-display text-2xl font-black text-rose-600 dark:text-rose-400">
                      NOT QUALIFIED / REJECTED
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="size-7 text-amber-500" />
                    <span className="font-display text-2xl font-black text-amber-600 dark:text-amber-400">
                      UNDER MODERATION REVIEW
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] opacity-80">
                {isQualified
                  ? "Shortlisted for in-person evaluation & grand jury presentation."
                  : isRejected
                  ? "Does not meet the qualification threshold for the next round."
                  : "Final qualification pending jury moderation approval."}
              </div>
            </div>
          </div>

          {/* Originality & Plagiarism Verification */}
          <div className="rounded-xl border border-border p-4 bg-card shadow-sm text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase text-foreground">
                <ShieldCheck className="size-4 text-emerald-500" /> Originality & Plagiarism Scan
              </div>
              <div className="font-mono font-bold text-foreground">
                Similarity Score: {plagiarismScore}%
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {plagiarismScore >= 35
                ? `Submission flagged with ${plagiarismScore}% text/code similarity. Further manual code inspection is required.`
                : "Automated similarity indexing detected no cross-team repository copying. Submission satisfies institutional academic integrity criteria."}
            </p>
          </div>

          {/* Actionable Suggestions & Jury Feedback */}
          <div className="rounded-xl border border-border p-4 bg-card shadow-sm text-xs space-y-2">
            <div className="font-bold uppercase tracking-wider text-foreground">
              Jury Recommendations & Next Steps
            </div>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-4 leading-relaxed">
              {improvements.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Verification Footer & Authority Sign-off */}
          <div className="pt-4 border-t-2 border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
            <div>
              <div className="font-semibold text-foreground">INNOVEDGE Hackathon Committee</div>
              <div>Innovation & Entrepreneurship Development Club</div>
              <div className="text-[10px]">Certified Digital Report • Valid without physical seal</div>
            </div>

            <div className="flex items-center gap-3">
              <img
                src="/favicon.png"
                alt="Verification Crest"
                className="size-11 object-contain filter drop-shadow-sm opacity-90"
              />
              <div className="text-right">
                <div className="font-mono text-xs font-semibold text-foreground">
                  Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </div>
                <div className="mt-1 text-[10px] text-primary font-semibold uppercase tracking-wider">
                  Innovation • Entrepreneurship • Excellence
                </div>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-5">
          <DialogHeader className="no-print pb-2 border-b border-border/50">
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Official Assessment Report · {team.name}</span>
              <Button size="sm" onClick={handlePrint} className="gap-1.5 mr-6 text-xs h-8">
                <Printer className="size-3.5" />
                Print / Save PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {cardContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return cardContent;
}

