import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, fmt } from "@/components/page-header";
import { type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { DEFAULT_CRITERIA_MAP, generateDefaultCriteriaScores, type DetailedCriterionScore } from "@/lib/evaluation-engine";
import { updatePersistentTeam } from "@/lib/team-store";
import { FileText, Github, Globe, CheckCircle2, ShieldCheck, Cpu, Calendar, Sparkles, Zap } from "lucide-react";

interface Props {
  team: TeamRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScoreBreakdownModal({ team, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Component>("pdf");

  if (!team) return null;

  const handleFillDefaultCriteria = () => {
    const p = 84;
    const g = 88;
    const w = 85;
    const finalScore = Number((p * 0.3 + g * 0.4 + w * 0.3).toFixed(1));

    const updatedEvals = { ...team.evals };
    const comps: { c: Component; score: number }[] = [
      { c: "pdf", score: p },
      { c: "github", score: g },
      { c: "website", score: w },
    ];

    comps.forEach(({ c, score }) => {
      const evalId = updatedEvals[c]?.id || `eval-${team.id}-${c}`;
      const critScores = generateDefaultCriteriaScores(team.id, c, score);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`innovedge_criterion_scores_${evalId}`, JSON.stringify(critScores));
        } catch {}
      }

      updatedEvals[c] = {
        ...(updatedEvals[c] || {
          id: evalId,
          team_id: team.id,
          component: c,
          created_at: new Date().toISOString(),
          max_score: 100,
        }),
        status: "completed",
        ai_score: score,
        final_score: score,
        summary: `Benchmark evaluation criteria populated (${score}/100)`,
        confidence: 0.95,
        updated_at: new Date().toISOString(),
      };
    });

    updatePersistentTeam(team.id, {
      evals: updatedEvals,
      officialFinal: finalScore,
      aiFinal: finalScore,
      overall: "completed",
      updated_at: new Date().toISOString(),
    });

    qc.invalidateQueries();
    toast.success(`Populated default criteria for ${team.name} (${finalScore}/100)!`);
  };

  // Load criterion scores from local storage cache if available, or generate from defaults
  const getCriteriaForComponent = (c: Component): DetailedCriterionScore[] => {
    const evalObj = team.evals?.[c];
    if (typeof window !== "undefined" && evalObj?.id) {
      try {
        const cached = localStorage.getItem(`innovedge_criterion_scores_${evalObj.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }

    // Proportional breakdown from defaults
    const scoreVal = evalObj?.final_score != null ? Number(evalObj.final_score) : 70;
    const factor = scoreVal / 100;
    return DEFAULT_CRITERIA_MAP[c].map((crit, idx) => ({
      criterion_id: `crit-${team.id}-${c}-${idx}`,
      criterion_name: crit.name,
      max_marks: crit.max,
      ai_marks: Math.max(1, Math.min(crit.max, Math.round(crit.max * factor * (0.88 + (idx % 3) * 0.08) * 2) / 2)),
      ai_explanation: crit.explanation,
      ai_evidence: crit.evidence,
      confidence: evalObj?.confidence != null ? Number(evalObj.confidence) : 0.92,
      position: idx + 1,
    }));
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 75) return "text-emerald-500 dark:text-emerald-400";
    if (score >= 55) return "text-amber-500 dark:text-amber-400";
    return "text-rose-500 dark:text-rose-400";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="shrink-0 pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold">{team.name}</DialogTitle>
                <StatusBadge status={team.overall} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {team.project_title || "Detailed multi-component evaluation breakdown"}
              </p>
            </div>

            {/* Overall Score Badge */}
            <div className="text-right shrink-0 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Score</div>
              <div className="font-mono text-xl font-black text-primary">
                {fmt(team.officialFinal ?? team.aiFinal)} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>

          {/* Quick Score Summary Strip */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-card/60 p-2 border border-border/40">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <FileText className="size-3.5 text-rose-500" /> PDF Deck
              </span>
              <span className={`font-mono font-bold ${getScoreColor(team.evals?.pdf?.final_score)}`}>
                {fmt(team.evals?.pdf?.final_score)}/100
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card/60 p-2 border border-border/40">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Github className="size-3.5 text-sky-500" /> GitHub Code
              </span>
              <span className={`font-mono font-bold ${getScoreColor(team.evals?.github?.final_score)}`}>
                {fmt(team.evals?.github?.final_score)}/100
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card/60 p-2 border border-border/40">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Globe className="size-3.5 text-emerald-500" /> Website
              </span>
              <span className={`font-mono font-bold ${getScoreColor(team.evals?.website?.final_score)}`}>
                {fmt(team.evals?.website?.final_score)}/100
              </span>
            </div>
          </div>

          {/* Quick Dummy Fill Action */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-muted-foreground">Preview & test evaluation rubrics:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleFillDefaultCriteria}
              className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium"
            >
              <Zap className="size-3" /> Fill Default Dummy Criteria (85%)
            </Button>
          </div>
        </DialogHeader>

        {/* Tabbed Criteria Breakdown */}
        <div className="flex-1 overflow-y-auto pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Component)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-3">
              <TabsTrigger value="pdf" className="text-xs flex items-center gap-1.5">
                <FileText className="size-3.5" /> PDF Criteria (30%)
              </TabsTrigger>
              <TabsTrigger value="github" className="text-xs flex items-center gap-1.5">
                <Github className="size-3.5" /> GitHub Criteria (40%)
              </TabsTrigger>
              <TabsTrigger value="website" className="text-xs flex items-center gap-1.5">
                <Globe className="size-3.5" /> Website Criteria (30%)
              </TabsTrigger>
            </TabsList>

            {COMPONENTS.map((comp) => {
              const evalObj = team.evals?.[comp];
              const crits = getCriteriaForComponent(comp);

              return (
                <TabsContent key={comp} value={comp} className="space-y-3 mt-0">
                  {/* Component summary banner */}
                  {evalObj?.summary && (
                    <div className="rounded-xl bg-card border border-border/60 p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
                        <Sparkles className="size-3.5" /> AI Qualitative Assessment Summary
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{evalObj.summary}</p>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground/80 border-t border-border/30 pt-1.5">
                        <span className="flex items-center gap-1">
                          <Cpu className="size-3" /> Model: {evalObj.model || "Gemini 3.1 Flash Lite"}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="size-3 text-emerald-500" /> Confidence: {Math.round((Number(evalObj.confidence) || 0.92) * 100)}%
                        </span>
                        {evalObj.updated_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" /> Evaluated: {new Date(evalObj.updated_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Criteria Cards */}
                  <div className="space-y-2">
                    {crits.map((crit) => (
                      <div
                        key={crit.criterion_id}
                        className="rounded-xl border border-border/50 bg-card/40 p-3 hover:bg-card/70 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-foreground">
                              {crit.position}. {crit.criterion_name}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">{crit.ai_explanation}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-sm font-bold text-primary">
                              {crit.ai_marks}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground"> / {crit.max_marks}</span>
                          </div>
                        </div>

                        {crit.ai_evidence && (
                          <div className="mt-2 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground flex items-start gap-1.5 border border-border/30">
                            <span className="font-semibold text-foreground shrink-0">Evidence:</span>
                            <span className="italic">{crit.ai_evidence}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <div className="shrink-0 pt-3 border-t border-border/40 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close Breakdown
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

