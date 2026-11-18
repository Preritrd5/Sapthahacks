import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Pencil,
  RefreshCw,
  RotateCcw,
  Settings2,
  Undo2,
  Loader2,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, fmt } from "@/components/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { PulsingScanner, BorderBeam } from "@/components/ui/motion-primitives";
import { COMPONENT_LABEL, effectiveMarks, sumScores, type Component } from "@/lib/scoring";
import { enqueue, logActivity } from "@/lib/db";
import { useQueueRunner } from "@/lib/queue-runner";
import type { Evaluation } from "@/lib/queries";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { runDirectEvaluation } from "@/lib/evaluation-engine";
import { getPersistentTeams, updatePersistentTeam } from "@/lib/team-store";

type CS = Tables<"criterion_scores">;

export function EvalCard({
  teamId,
  component,
  evaluation,
}: {
  teamId: string;
  component: Component;
  evaluation?: Evaluation | undefined;
}) {
  const qc = useQueryClient();
  const runner = useQueueRunner();
  const shouldReduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<CS | null>(null);
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  const scores = useQuery({
    queryKey: ["cs", evaluation?.id, evaluation?.updated_at],
    enabled: !!evaluation?.id,
    queryFn: async () =>
      (
        await supabase
          .from("criterion_scores")
          .select("*")
          .eq("evaluation_id", evaluation!.id)
          .order("position")
      ).data ?? [],
  });

  const actor = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const recompute = async (unapprove: boolean) => {
    const { data } = await supabase
      .from("criterion_scores")
      .select("ai_marks,admin_marks,max_marks")
      .eq("evaluation_id", evaluation!.id);
    const s = sumScores(
      (data ?? []).map((r) => ({
        ai_marks: r.ai_marks,
        admin_marks: r.admin_marks,
        max_marks: Number(r.max_marks),
      }))
    );
    await supabase
      .from("evaluations")
      .update({
        final_score: s.final,
        ...(unapprove && evaluation!.status === "approved"
          ? { status: "completed", approved_at: null, approved_by: null }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", evaluation!.id);
    qc.invalidateQueries();
  };

  const saveMark = async () => {
    if (!edit) return;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || n > Number(edit.max_marks))
      return toast.error(`Marks must be between 0 and ${edit.max_marks}`);
    if (!reason.trim()) return toast.error("A reason is required");
    const uid = await actor();
    const prev = effectiveMarks({ ai_marks: edit.ai_marks, admin_marks: edit.admin_marks, max_marks: 0 });
    await supabase
      .from("criterion_scores")
      .update({ admin_marks: n, admin_reason: reason, edited_by: uid, edited_at: new Date().toISOString() })
      .eq("id", edit.id);
    await supabase.from("admin_score_overrides").insert({
      evaluation_id: evaluation!.id,
      criterion_score_id: edit.id,
      team_id: teamId,
      field: edit.criterion_name,
      previous_value: prev,
      new_value: n,
      reason,
      edited_by: uid,
    });
    await supabase.from("evaluation_history").insert({
      team_id: teamId,
      component,
      action: "marks edited",
      actor: uid,
      details: { criterion: edit.criterion_name, previous: prev, new: n, reason },
    });
    await logActivity("Edited marks", `${COMPONENT_LABEL[component]} · ${edit.criterion_name}: ${prev} → ${n}`);
    setEdit(null);
    await recompute(true);
    toast.success("Marks updated");
  };

  const revert = async (c: CS) => {
    const uid = await actor();
    await supabase
      .from("criterion_scores")
      .update({ admin_marks: null, admin_reason: null, edited_by: null, edited_at: null })
      .eq("id", c.id);
    await supabase.from("admin_score_overrides").insert({
      evaluation_id: evaluation!.id,
      criterion_score_id: c.id,
      team_id: teamId,
      field: c.criterion_name,
      previous_value: c.admin_marks,
      new_value: c.ai_marks,
      reason: "Reverted to AI marks",
      edited_by: uid,
    });
    await supabase.from("evaluation_history").insert({
      team_id: teamId,
      component,
      action: "reverted to AI",
      actor: uid,
      details: { criterion: c.criterion_name },
    });
    await recompute(true);
  };

  const revertAll = async () => {
    if (!confirm("Revert every criterion to the AI-generated marks?")) return;
    for (const c of (scores.data ?? []).filter((x) => x.admin_marks != null)) await revert(c);
    toast.success("Reverted to AI marks");
  };

  const approve = async (ok: boolean) => {
    const uid = await actor();
    try {
      await supabase
        .from("evaluations")
        .update(
          ok
            ? { status: "approved", approved_by: uid, approved_at: new Date().toISOString() }
            : { status: "completed", approved_by: null, approved_at: null }
        )
        .eq("id", evaluation!.id);
      await supabase
        .from("evaluation_history")
        .insert({ team_id: teamId, component, action: ok ? "approved" : "approval withdrawn", actor: uid });
      await logActivity(ok ? "Approved evaluation" : "Withdrew approval", COMPONENT_LABEL[component]);
    } catch {}

    const teams = getPersistentTeams();
    const currentTeam = teams.find((t) => t.id === teamId);
    if (currentTeam && currentTeam.evals && currentTeam.evals[component]) {
      const updatedEvals = { ...currentTeam.evals };
      updatedEvals[component] = {
        ...updatedEvals[component]!,
        status: ok ? "approved" : "completed",
        approved_by: ok ? uid || "admin" : null,
        approved_at: ok ? new Date().toISOString() : null,
      };
      updatePersistentTeam(teamId, { evals: updatedEvals });
    }
    qc.invalidateQueries();
    toast.success(ok ? "Evaluation approved" : "Approval withdrawn");
  };

  const reevaluate = async () => {
    setBusy(true);
    try {
      const teams = getPersistentTeams();
      const currentTeam = teams.find((t) => t.id === teamId);
      if (currentTeam) {
        toast.info(`Evaluating ${COMPONENT_LABEL[component]}...`);
        await runDirectEvaluation(currentTeam, [component]);
        toast.success(`${COMPONENT_LABEL[component]} evaluation completed!`);
        qc.invalidateQueries();
      } else {
        const n = await enqueue([teamId], [component]);
        if (!n) return toast.info("Already queued");
        toast.success("Queued for re-evaluation");
        if (!runner.running) runner.start();
        qc.invalidateQueries();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to evaluate");
    } finally {
      setBusy(false);
    }
  };

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const e = evaluation;
  const isProcessing = busy || e?.status === "processing";
  const p = e?.final_score != null && e.max_score ? (Number(e.final_score) / Number(e.max_score)) * 100 : null;
  const rows = scores.data ?? [];
  const edited = rows.some((r) => r.admin_marks != null);

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "glass flex flex-col rounded-2xl p-5 relative overflow-hidden transition-all duration-300",
        isProcessing && "ring-1 ring-primary/40 shadow-lg shadow-primary/5"
      )}
    >
      {/* Animated Traveling Laser Beam while AI Evaluates */}
      {isProcessing && (
        <BorderBeam
          colorFrom={component === "pdf" ? "#f43f5e" : component === "github" ? "#0ea5e9" : "#10b981"}
          colorTo={component === "pdf" ? "#fb7185" : component === "github" ? "#38bdf8" : "#34d399"}
          duration={3.5}
          borderWidth={2}
          borderRadius={16}
        />
      )}
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {COMPONENT_LABEL[component]}
          </div>
          <div className="mt-1 font-display text-3xl font-semibold flex items-baseline gap-1">
            <AnimatedNumber value={e?.final_score} precision={1} className="font-bold text-foreground" />
            <span className="text-base font-normal text-muted-foreground"> / {fmt(e?.max_score)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            AI score <AnimatedNumber value={e?.ai_score} precision={1} /> ·{" "}
            {p != null ? (
              <span className="font-medium text-foreground">
                <AnimatedNumber value={p} precision={0} suffix="%" />
              </span>
            ) : (
              "no score"
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={isProcessing ? "evaluating" : e?.status ?? "not started"} />
          {e?.stale && <StatusBadge status="stale" />}
        </div>
      </div>

      {/* Active Evaluation Scanner HUD */}
      {isProcessing && (
        <div className="mt-3">
          <PulsingScanner label={`Evaluating ${COMPONENT_LABEL[component]}...`} />
        </div>
      )}

      {/* AI Confidence Meter */}
      {e?.confidence != null && !isProcessing && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground font-mono">
            <span>AI Confidence</span>
            <span className="font-semibold text-foreground">
              {Math.round(Number(e.confidence) * 100)}%
            </span>
          </div>
          <AnimatedProgress
            value={Number(e.confidence) * 100}
            size="sm"
            variant="primary"
          />
        </div>
      )}

      {e?.stale && (
        <p className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-2 text-xs text-warning border border-warning/20">
          <AlertTriangle className="size-4 shrink-0" />
          Criteria or evidence changed since this evaluation. Re-evaluate to apply them.
        </p>
      )}

      {e?.error && (
        <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive border border-destructive/20">
          {e.error}
        </p>
      )}

      {e?.summary && !isProcessing && (
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">
          {e.summary}
        </p>
      )}

      {/* Criteria Score Breakdown List */}
      <div className="mt-4 flex-1 space-y-2">
        {rows.map((c) => {
          const isExpanded = expandedCriteria.has(c.id);
          const currentMarks = effectiveMarks({ ...c, max_marks: 0 });

          return (
            <div
              key={c.id}
              className="rounded-xl bg-background/50 border border-border/50 overflow-hidden transition-all hover:border-border"
            >
              <button
                type="button"
                onClick={() => toggleCriterion(c.id)}
                className="w-full flex items-center justify-between gap-2 p-3 text-left text-xs hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {c.needs_review && <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
                  <span className="truncate font-medium text-foreground">{c.criterion_name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.admin_marks != null && (
                    <span className="font-mono text-xs text-muted-foreground line-through">
                      {fmt(c.ai_marks)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "font-mono font-bold text-xs",
                      c.admin_marks != null ? "text-violet" : "text-foreground"
                    )}
                  >
                    <AnimatedNumber value={currentMarks} precision={1} />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">/{fmt(c.max_marks)}</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border/40 p-3 bg-muted/20 space-y-2 text-xs"
                  >
                    <p>
                      <span className="text-muted-foreground font-semibold">Explanation: </span>
                      {c.ai_explanation}
                    </p>
                    {c.ai_evidence && (
                      <p className="rounded-lg bg-card/80 border border-border/60 p-2 font-mono text-[11px] leading-relaxed">
                        {c.ai_evidence}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Confidence: {Math.round(Number(c.confidence ?? 0) * 100)}%</span>
                      {c.admin_marks != null && (
                        <span className="text-violet font-medium">
                          Override: {c.admin_reason}
                        </span>
                      )}
                    </div>
                    <div className="no-print pt-1 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEdit(c);
                          setVal(String(effectiveMarks({ ...c, max_marks: 0 })));
                          setReason("");
                        }}
                      >
                        <Pencil className="size-3 mr-1" /> Edit marks
                      </Button>
                      {c.admin_marks != null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => revert(c)}
                        >
                          <Undo2 className="size-3 mr-1" /> Revert
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {!e && !isProcessing && (
          <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
            Evaluation not yet performed for this component.
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="no-print mt-5 pt-3 border-t border-border/50 flex flex-wrap gap-2 items-center">
        <Button
          size="sm"
          variant="secondary"
          onClick={reevaluate}
          disabled={isProcessing}
          className="text-xs font-semibold"
        >
          {isProcessing ? (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="size-3.5 mr-1.5" />
          )}
          {isProcessing ? "Evaluating…" : e ? "Re-evaluate" : "Evaluate"}
        </Button>

        <Button size="sm" variant="ghost" asChild className="text-xs">
          <Link to="/criteria" search={{ c: component }}>
            <Settings2 className="size-3.5 mr-1" /> Edit criteria
          </Link>
        </Button>

        {edited && (
          <Button size="sm" variant="ghost" onClick={revertAll} className="text-xs">
            <RotateCcw className="size-3.5 mr-1" /> Revert all
          </Button>
        )}

        {e && ["completed", "approved"].includes(e.status) && (
          e.status === "approved" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => approve(false)}
              className="text-xs ml-auto"
            >
              Withdraw approval
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => approve(true)}
              className="text-xs ml-auto bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="size-3.5 mr-1" /> Approve
            </Button>
          )
        )}
      </div>

      {/* Edit Marks Dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit marks · {edit?.criterion_name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            AI gave {fmt(edit?.ai_marks)} / {fmt(edit?.max_marks)}. The original AI mark is preserved.
          </p>
          <Input
            type="number"
            step="0.5"
            min={0}
            max={Number(edit?.max_marks ?? 0)}
            value={val}
            onChange={(x) => setVal(x.target.value)}
          />
          <Textarea
            placeholder="Reason for change (required)"
            value={reason}
            onChange={(x) => setReason(x.target.value)}
          />
          <DialogFooter>
            <Button onClick={saveMark}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
