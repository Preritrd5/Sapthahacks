"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PulsingScanner, ScaleOnHover } from "@/components/ui/motion-primitives";
import { InnovedgeLoader } from "@/components/ui/innovedge-loader";
import { type TeamRow } from "@/lib/queries";
import { type Component, COMPONENT_LABEL } from "@/lib/scoring";
import { type EvaluationProgress } from "@/lib/evaluation-engine";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Github,
  Globe,
  RotateCw,
  Trophy,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface EvaluationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamRow | null;
  isEvaluating: boolean;
  progress?: EvaluationProgress | null;
  error?: string | null;
  onRetry?: () => void;
  onViewBreakdown?: () => void;
}

export function EvaluationProgressModal({
  isOpen,
  onClose,
  team,
  isEvaluating,
  progress,
  error,
  onRetry,
  onViewBreakdown,
}: EvaluationProgressModalProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!team) return null;

  const isFailed = !!error;
  const isCompleted = !isEvaluating && !isFailed && (team.overall === "completed" || team.overall === "approved");

  // Determine stage states
  const getComponentStatus = (c: Component) => {
    if (progress?.component === c && progress.status === "processing") {
      return "processing";
    }
    const evalItem = team.evals?.[c];
    if (evalItem?.status === "completed" || evalItem?.status === "approved") {
      return "completed";
    }
    if (evalItem?.status === "processing") {
      return "processing";
    }
    if (evalItem?.status === "failed") {
      return "failed";
    }
    return "pending";
  };

  const currentPct = progress?.progressPct ?? (isCompleted ? 100 : isEvaluating ? 35 : 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border border-border/70 bg-card/95 backdrop-blur-2xl shadow-2xl rounded-3xl">
        {/* Header Banner */}
        <div className="relative p-6 border-b border-border/50 bg-gradient-to-b from-primary/10 via-background/40 to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold uppercase tracking-wider"
                >
                  Live Multi-Modal Evaluation
                </Badge>
                {team.project_title?.startsWith("[") && (
                  <Badge variant="secondary" className="text-[10px] truncate max-w-xs">
                    {team.project_title.slice(0, 32)}…
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-display font-bold text-foreground">
                {team.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {team.email || "Registered Hackathon Participant"}
              </DialogDescription>
            </div>

            <div className="shrink-0">
              {isEvaluating ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
                  <InnovedgeLoader size="xs" /> Evaluating
                </span>
              ) : isCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  <CheckCircle2 className="size-3.5" /> Certified
                </span>
              ) : isFailed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                  <AlertTriangle className="size-3.5" /> Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                  Ready
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic State Body */}
        <div className="p-6 space-y-6">
          <AnimatePresence mode="wait">
            {/* 1. EVALUATION IN PROGRESS */}
            {isEvaluating && (
              <motion.div
                key="eval-in-progress"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Overall Progress Meter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground font-sans">
                      {progress?.message || "Running Gemini AI rubric evaluation..."}
                    </span>
                    <span className="font-bold text-primary">
                      {Math.round(currentPct)}%
                    </span>
                  </div>
                  <AnimatedProgress
                    value={currentPct}
                    isProcessing={true}
                    size="md"
                    variant="primary"
                  />
                </div>

                <PulsingScanner label="INNOVEDGE Multi-Modal Assessor" />

                {/* Staged Component Cards */}
                <div className="grid gap-3">
                  <ComponentStepCard
                    component="pdf"
                    title="PDF Presentation Deck"
                    weight="30%"
                    icon={FileText}
                    status={getComponentStatus("pdf")}
                    score={team.evals?.pdf?.final_score}
                    desc={team.pdf_path ? "Extracted text and architectural diagrams" : "Default proposal specifications"}
                  />
                  <ComponentStepCard
                    component="github"
                    title="GitHub Repository Code"
                    weight="40%"
                    icon={Github}
                    status={getComponentStatus("github")}
                    score={team.evals?.github?.final_score}
                    desc={team.github_url ? "Static structure, clean code and security audit" : "Code repository analysis"}
                  />
                  <ComponentStepCard
                    component="website"
                    title="Deployed Web Prototype"
                    weight="30%"
                    icon={Globe}
                    status={getComponentStatus("website")}
                    score={team.evals?.website?.final_score}
                    desc={team.website_url ? "Live UX audit, responsive layout and navigation" : "Web prototype inspection"}
                  />
                </div>
              </motion.div>
            )}

            {/* 2. EVALUATION COMPLETED */}
            {isCompleted && (
              <motion.div
                key="eval-completed"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Celebratory Badge & Big Score */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-background/60 to-primary/10 p-6 text-center">
                  {/* Subtle celebratory glow ring */}
                  <motion.div
                    initial={shouldReduceMotion ? { scale: 1 } : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                  >
                    <Trophy className="size-7" />
                  </motion.div>

                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-1">
                    Evaluation Complete & Certified
                  </div>

                  <div className="font-display text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                    <AnimatedNumber
                      value={team.officialFinal ?? team.aiFinal}
                      precision={1}
                      duration={1.2}
                    />
                    <span className="text-xl sm:text-2xl font-normal text-muted-foreground ml-1.5">
                      / 100
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
                    Weighted 30/40/30 evaluation across PDF deck, GitHub codebase, and live web prototype.
                  </div>
                </div>

                {/* Sub-Scores Breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-center gap-1">
                      <FileText className="size-3 text-rose-500" /> PDF Deck
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-foreground">
                      <AnimatedNumber value={team.evals?.pdf?.final_score} precision={0} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">30% weight</div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-center gap-1">
                      <Github className="size-3 text-sky-500" /> GitHub
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-foreground">
                      <AnimatedNumber value={team.evals?.github?.final_score} precision={0} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">40% weight</div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-center gap-1">
                      <Globe className="size-3 text-emerald-500" /> Website
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-foreground">
                      <AnimatedNumber value={team.evals?.website?.final_score} precision={0} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">30% weight</div>
                  </div>
                </div>

                {/* Evaluation Summary Highlight */}
                {team.evals?.pdf?.summary && (
                  <div className="rounded-xl border border-border/60 bg-card p-3.5 text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground flex items-center gap-1 mb-1">
                      <Sparkles className="size-3.5 text-primary" /> Key Findings:
                    </span>
                    {team.evals.pdf.summary}
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. EVALUATION FAILED */}
            {isFailed && (
              <motion.div
                key="eval-failed"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-center">
                  <AlertTriangle className="mx-auto size-10 text-destructive mb-2" />
                  <h4 className="font-semibold text-destructive">Evaluation Encountered an Error</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error || "An unexpected error occurred during the multi-modal evaluation process."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
          {isCompleted && onViewBreakdown ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onViewBreakdown();
              }}
              className="text-xs"
            >
              Inspect Criteria Breakdown <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {isFailed && onRetry && (
              <Button
                variant="default"
                size="sm"
                onClick={onRetry}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                <RotateCw className="size-3.5 mr-1.5" /> Retry Evaluation
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              {isCompleted ? "Done" : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComponentStepCard({
  component,
  title,
  weight,
  icon: Icon,
  status,
  score,
  desc,
}: {
  component: Component;
  title: string;
  weight: string;
  icon: any;
  status: "pending" | "processing" | "completed" | "failed";
  score?: number | null | undefined;
  desc: string;
}) {
  const isCurrent = status === "processing";
  const isDone = status === "completed";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3 transition-all duration-300 ${
        isCurrent
          ? "border-primary/50 bg-primary/10 shadow-sm"
          : isDone
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/50 bg-card/60 opacity-75"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
              isCurrent
                ? "border-primary/40 bg-primary/20 text-primary"
                : isDone
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-500"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span className="truncate">{title}</span>
              <span className="text-[10px] font-normal text-muted-foreground">({weight})</span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {isCurrent ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary font-mono">
              <Loader2 className="size-3 animate-spin" /> Analyzing
            </span>
          ) : isDone ? (
            <div className="text-right">
              <span className="font-mono text-sm font-bold text-emerald-500">
                {score != null ? Math.round(Number(score)) : "—"}
              </span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground font-mono">Pending</span>
          )}
        </div>
      </div>
    </div>
  );
}
