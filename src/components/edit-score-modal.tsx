import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updatePersistentTeam } from "@/lib/team-store";
import { type TeamRow } from "@/lib/queries";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { generateDefaultCriteriaScores } from "@/lib/evaluation-engine";
import { useQueryClient } from "@tanstack/react-query";
import { Sliders, CheckCircle2, ShieldCheck, AlertCircle, Sparkles, Zap, RotateCcw } from "lucide-react";

interface Props {
  team: TeamRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditScoreModal({ team, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const [pdfScore, setPdfScore] = useState<string>("");
  const [ghScore, setGhScore] = useState<string>("");
  const [webScore, setWebScore] = useState<string>("");
  const [finalOverride, setFinalOverride] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (team) {
      setPdfScore(team.evals?.pdf?.final_score != null ? String(team.evals.pdf.final_score) : "");
      setGhScore(team.evals?.github?.final_score != null ? String(team.evals.github.final_score) : "");
      setWebScore(team.evals?.website?.final_score != null ? String(team.evals.website.final_score) : "");
      setFinalOverride(team.final_override != null ? String(team.final_override) : "");
      setOverrideReason(team.override_reason || "");
      setRemarks(team.remarks || "");
    }
  }, [team]);

  if (!team) return null;

  // Quick preset helper to fill default / dummy scores and criteria
  const handleFillDummy = (type: "default" | "top" | "average" = "default") => {
    let p = 84;
    let g = 88;
    let w = 85;

    if (type === "top") {
      p = 94;
      g = 96;
      w = 92;
    } else if (type === "average") {
      p = 68;
      g = 72;
      w = 70;
    }

    setPdfScore(String(p));
    setGhScore(String(g));
    setWebScore(String(w));
    setRemarks(`Manual evaluation completed with ${type} benchmark rubric criteria across PDF (${p}%), GitHub (${g}%), and live site (${w}%).`);
    toast.success(`Populated ${type} dummy criteria & scores!`);
  };

  // Calculate live preview weighted score
  const pVal = pdfScore !== "" ? Number(pdfScore) : (team.evals?.pdf?.final_score != null ? Number(team.evals.pdf.final_score) : 0);
  const gVal = ghScore !== "" ? Number(ghScore) : (team.evals?.github?.final_score != null ? Number(team.evals.github.final_score) : 0);
  const wVal = webScore !== "" ? Number(webScore) : (team.evals?.website?.final_score != null ? Number(team.evals.website.final_score) : 0);
  const liveWeighted = Number((pVal * 0.3 + gVal * 0.4 + wVal * 0.3).toFixed(1));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedEvals = { ...team.evals };

      const updateComp = (c: Component, valStr: string) => {
        if (valStr !== "") {
          const num = Math.max(0, Math.min(100, Number(valStr)));
          const evalId = updatedEvals[c]?.id || `eval-${team.id}-${c}`;

          // Generate detailed criteria scores matching this score
          const criteriaList = generateDefaultCriteriaScores(team.id, c, num);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`innovedge_criterion_scores_${evalId}`, JSON.stringify(criteriaList));
            } catch {}
          }

          if (updatedEvals[c]) {
            updatedEvals[c] = {
              ...updatedEvals[c]!,
              id: evalId,
              final_score: num,
              ai_score: num,
              status: "completed",
              updated_at: new Date().toISOString(),
            };
          } else {
            updatedEvals[c] = {
              id: evalId,
              team_id: team.id,
              component: c,
              status: "completed",
              stale: false,
              ai_score: num,
              final_score: num,
              max_score: 100,
              confidence: 0.96,
              summary: "Manual evaluation with verified criteria scores",
              model: "manual-admin-eval",
              error: null,
              approved_by: "admin",
              approved_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        }
      };

      updateComp("pdf", pdfScore);
      updateComp("github", ghScore);
      updateComp("website", webScore);

      const overrideNum = finalOverride.trim() !== "" ? Number(finalOverride) : null;
      if (overrideNum !== null && (isNaN(overrideNum) || overrideNum < 0 || overrideNum > 100)) {
        toast.error("Override score must be between 0 and 100");
        setSaving(false);
        return;
      }

      const officialFinal = overrideNum !== null ? overrideNum : liveWeighted;

      // Update in local vault
      updatePersistentTeam(team.id, {
        evals: updatedEvals,
        officialFinal,
        aiFinal: liveWeighted,
        approvedFinal: officialFinal,
        final_override: overrideNum,
        override_reason: overrideReason.trim() || null,
        remarks: remarks.trim() || null,
        overall: "completed",
        updated_at: new Date().toISOString(),
      });

      // Try updating in Supabase
      try {
        await supabase
          .from("teams")
          .update({
            final_override: overrideNum,
            override_reason: overrideReason.trim() || null,
            remarks: remarks.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", team.id);

        for (const c of COMPONENTS) {
          const e = updatedEvals[c];
          if (e) {
            const { data: savedEval } = await supabase.from("evaluations").upsert({
              team_id: team.id,
              component: c,
              status: e.status,
              final_score: e.final_score,
              ai_score: e.ai_score,
              updated_at: new Date().toISOString(),
            }, { onConflict: "team_id,component" }).select().single();

            if (savedEval?.id) {
              const criteriaList = generateDefaultCriteriaScores(team.id, c, Number(e.final_score));
              await supabase.from("criterion_scores").delete().eq("evaluation_id", savedEval.id);
              await supabase.from("criterion_scores").insert(
                criteriaList.map((crit, idx) => ({
                  evaluation_id: savedEval.id,
                  criterion_name: crit.criterion_name,
                  max_marks: crit.max_marks,
                  position: idx + 1,
                  ai_marks: crit.ai_marks,
                  admin_marks: crit.ai_marks,
                  ai_explanation: crit.ai_explanation,
                  ai_evidence: crit.ai_evidence,
                  confidence: crit.confidence,
                }))
              );
            }
          }
        }

        await supabase.from("admin_score_overrides").insert({
          team_id: team.id,
          field: "manual_score_edit",
          previous_value: team.officialFinal,
          new_value: officialFinal,
          reason: overrideReason || remarks || "Manual Evaluation",
        });

        await supabase.from("evaluation_history").insert({
          team_id: team.id,
          action: "admin_manual_evaluation",
          details: {
            pdf: pdfScore,
            github: ghScore,
            website: webScore,
            officialFinal,
            reason: overrideReason,
          },
        });
      } catch (err) {
        console.warn("Could not sync score edits to Supabase:", err);
      }

      toast.success(`Saved manual evaluation for ${team.name}!`);
      qc.invalidateQueries();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sliders className="size-5 text-primary" />
            <DialogTitle>Manual Team Evaluation & Criteria</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manually enter scores, adjust criteria, or use quick dummy presets for <strong>{team.name}</strong>.
          </p>
        </DialogHeader>

        {/* Quick Fill Dummy Preset Buttons */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <Zap className="size-3.5" /> Quick Fill Dummy / Default Criteria:
            </span>
            <span className="text-[10px] text-muted-foreground">1-click test fill</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleFillDummy("default")}
              className="text-xs h-7 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-medium"
            >
              <Sparkles className="size-3 mr-1" /> Fill Default (85%)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleFillDummy("top")}
              className="text-xs h-7 hover:border-emerald-500 hover:text-emerald-500 font-medium"
            >
              Top Tier (94%)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleFillDummy("average")}
              className="text-xs h-7 hover:border-amber-500 hover:text-amber-500 font-medium"
            >
              Average / Pass (70%)
            </Button>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Individual Components */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">PDF Deck (30%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={pdfScore}
                  onChange={(e) => setPdfScore(e.target.value)}
                  placeholder="0-100"
                  className="font-mono text-center font-bold text-sm"
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Score / 100</span>
            </div>

            <div>
              <Label className="text-xs font-semibold">GitHub Code (40%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={ghScore}
                  onChange={(e) => setGhScore(e.target.value)}
                  placeholder="0-100"
                  className="font-mono text-center font-bold text-sm"
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Score / 100</span>
            </div>

            <div>
              <Label className="text-xs font-semibold">Website (30%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={webScore}
                  onChange={(e) => setWebScore(e.target.value)}
                  placeholder="0-100"
                  className="font-mono text-center font-bold text-sm"
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block text-center">Score / 100</span>
            </div>
          </div>

          {/* Computed Weighted Score Preview */}
          <div className="flex items-center justify-between rounded-xl bg-card border border-border/80 p-3 shadow-sm">
            <div>
              <div className="text-xs font-medium text-foreground">Calculated Weighted Score:</div>
              <div className="text-[10px] text-muted-foreground">Formula: (PDF×0.3) + (GitHub×0.4) + (Web×0.3)</div>
            </div>
            <div className="font-mono text-xl font-black text-primary">{liveWeighted} <span className="text-xs font-normal text-muted-foreground">/ 100</span></div>
          </div>

          {/* Final Override */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Admin Final Override (Optional)</span>
              <span className="text-[10px] font-normal text-muted-foreground">Overrides weighted score</span>
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={finalOverride}
              onChange={(e) => setFinalOverride(e.target.value)}
              placeholder="Leave blank to use weighted score"
              className="font-mono font-bold"
            />
          </div>

          {/* Override Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Override Reason / Evaluation Notes</Label>
            <Input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Special commendation for architectural depth"
              className="text-xs"
            />
          </div>

          {/* General Remarks */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Feedback & Jury Remarks</Label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Feedback for the team's official report card..."
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 font-semibold">
            {saving ? "Saving..." : "Save Evaluation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

