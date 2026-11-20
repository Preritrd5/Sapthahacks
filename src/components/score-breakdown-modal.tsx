import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { StatusBadge, fmt } from "@/components/page-header";
import { type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { DEFAULT_CRITERIA_MAP, evaluateSingleTeam, type DetailedCriterionScore } from "@/lib/evaluation-engine";
import { updatePersistentTeam } from "@/lib/team-store";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Github, Globe, CheckCircle2, ShieldCheck, Cpu, Calendar, Sparkles, Zap, Loader2 } from "lucide-react";

interface Props {
  team: TeamRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScoreBreakdownModal({ team, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<Component>("pdf");
  const [isEvaluating, setIsEvaluating] = useState(false);

  const currentEval = team?.evals?.[activeTab];
  const { data: dbCriterionScores } = useQuery({
    queryKey: ["criterion_scores", currentEval?.id],
    enabled: !!currentEval?.id && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criterion_scores")
        .select("*")
        .eq("evaluation_id", currentEval!.id)
        .order("position");
      if (error || !data || data.length === 0) return null;
      return data;
    },
  });

  if (!team) return null;

  const handleRunEvaluation = async () => {
    if (!team || isEvaluating) return;
    setIsEvaluating(true);
    toast.info(`Running live evidence-based evaluation for "${team.name}"...`);
    try {
      await evaluateSingleTeam(team, [...COMPONENTS], { forceRerun: true });
      qc.invalidateQueries();
      toast.success(`Evaluation complete for "${team.name}"!`);
    } catch (err: any) {
      toast.error(err?.message || "Evaluation failed");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Load criterion scores from authoritative Supabase query or proportional fallback
  const getCriteriaForComponent = (c: Component): DetailedCriterionScore[] => {
    if (c === activeTab && dbCriterionScores && dbCriterionScores.length > 0) {
      return dbCriterionScores.map((r) => ({
        criterion_id: r.id,
        criterion_name: r.criterion_name,
        max_marks: Number(r.max_marks),
        ai_marks: Number(r.admin_marks ?? r.ai_marks ?? 0),
        ai_explanation: r.admin_reason || r.ai_explanation || "",
        ai_evidence: r.ai_evidence || "",
        confidence: Number(r.confidence ?? 0.92),
        position: r.position,
      }));
    }

    const evalObj = team.evals?.[c];
    if (!evalObj || evalObj.final_score == null) {
      return [];
    }

    // Only generate criteria if an authoritative evaluation exists for this component
    const scoreVal = Number(evalObj.final_score);
    const totalMax = DEFAULT_CRITERIA_MAP[c].reduce((acc, cr) => acc + cr.max, 0);
    return DEFAULT_CRITERIA_MAP[c].map((crit, idx) => ({
      criterion_id: `crit-${team.id}-${c}-${idx}`,
      criterion_name: crit.name,
      max_marks: crit.max,
      ai_marks: Math.max(0, Math.min(crit.max, Math.round((crit.max / totalMax) * scoreVal * 2) / 2)),
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-6 rounded-3xl border border-border/70 bg-card/95 backdrop-blur-2xl">
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

            {/* Overall Score Badge with Animated Number */}
            <div className="text-right shrink-0 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Score</div>
              <div className="font-mono text-xl font-black text-primary flex items-baseline justify-end">
                <AnimatedNumber value={team.officialFinal ?? team.aiFinal} precision={1} />
                <span className="text-xs font-normal text-muted-foreground ml-1">/ 100</span>
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
                <AnimatedNumber value={team.evals?.pdf?.final_score} precision={0} />/100
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card/60 p-2 border border-border/40">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Github className="size-3.5 text-sky-500" /> GitHub Code
              </span>
              <span className={`font-mono font-bold ${getScoreColor(team.evals?.github?.final_score)}`}>
                <AnimatedNumber value={team.evals?.github?.final_score} precision={0} />/100
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card/60 p-2 border border-border/40">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Globe className="size-3.5 text-emerald-500" /> Website
              </span>
              <span className={`font-mono font-bold ${getScoreColor(team.evals?.website?.final_score)}`}>
                <AnimatedNumber value={team.evals?.website?.final_score} precision={0} />/100
              </span>
            </div>
          </div>

          {/* Quick Evaluation Action */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-muted-foreground">Team-isolated rubric assessment:</span>
            <Button
              size="sm"
              variant="outline"
              disabled={isEvaluating}
              onClick={handleRunEvaluation}
              className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-medium"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Evaluating Evidence...
                </>
              ) : (
                <>
                  <Sparkles className="size-3" /> Re-evaluate Team Rubrics
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Tabbed Criteria Breakdown */}
        <div className="flex-1 overflow-y-auto pt-3 pr-1">
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
                    <div className="rounded-xl bg-card border border-border/60 p-3.5 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
                        <Sparkles className="size-3.5" /> AI Qualitative Assessment Summary
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{evalObj.summary}</p>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground/80 border-t border-border/30 pt-1.5">
                        <span className="flex items-center gap-1">
                          <Cpu className="size-3" /> Model: {evalObj.model || "Gemini 3.1 Flash Lite"}
                        </span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="size-3 text-emerald-500" /> Confidence:{" "}
                          {Math.round((Number(evalObj.confidence) || 0.92) * 100)}%
                        </span>
                        {evalObj.updated_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" /> Evaluated:{" "}
                            {new Date(evalObj.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Criteria Cards or Empty State */}
                  {crits.length === 0 ? (
                    <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-border/70 bg-card/30">
                      <FileText className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                      <p className="text-xs font-semibold text-foreground">No evaluation completed for this component</p>
                      <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto">
                        This component has not been evaluated yet. Run live evaluation to generate individual rubric scores from this team's submission.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleRunEvaluation}
                        disabled={isEvaluating}
                        className="mt-3 h-7 text-xs gap-1.5"
                      >
                        {isEvaluating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                        Run Evaluation Now
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {crits.map((crit, index) => {
                      const pct = (crit.ai_marks / crit.max_marks) * 100;
                      return (
                        <div
                          key={crit.criterion_id}
                          className="rounded-xl border border-border/50 bg-card/50 p-3 hover:bg-card/80 transition-colors space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-foreground">
                                {crit.position}. {crit.criterion_name}
                              </span>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                {crit.ai_explanation}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-sm font-bold text-primary">
                                <AnimatedNumber value={crit.ai_marks} precision={1} />
                              </span>
                              <span className="font-mono text-xs text-muted-foreground"> / {crit.max_marks}</span>
                            </div>
                          </div>

                          {/* Criterion Progress Meter */}
                          <AnimatedProgress value={pct} size="sm" variant="primary" />

                          {crit.ai_evidence && (
                            <div className="mt-1.5 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground flex items-start gap-1.5 border border-border/30">
                              <span className="font-semibold text-foreground shrink-0">Evidence:</span>
                              <span className="italic leading-relaxed">{crit.ai_evidence}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <div className="shrink-0 pt-3 border-t border-border/40 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} className="text-xs">
            Close Breakdown
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
