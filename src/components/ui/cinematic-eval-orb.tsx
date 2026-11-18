"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Github, Globe, Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { type Component } from "@/lib/scoring";
import { cn } from "@/lib/utils";

interface CinematicEvalOrbProps {
  activeComponent?: Component | null | undefined;
  progressPct?: number | undefined;
  isCompleted?: boolean | undefined;
  isEvaluating?: boolean | undefined;
  className?: string | undefined;
}

/**
 * CinematicEvalOrb
 * Premium multi-modal AI evaluation animation inspired by Magic UI Orbiting Circles
 * and Aceternity UI Glow & Sparkle primitives.
 * Features 3 concentric orbital paths with dynamic node telemetry tied to real
 * PDF, GitHub, and Website evaluation phases.
 */
export function CinematicEvalOrb({
  activeComponent,
  progressPct = 0,
  isCompleted = false,
  isEvaluating = true,
  className,
}: CinematicEvalOrbProps) {
  const shouldReduceMotion = useReducedMotion();

  // Component active helpers
  const isPdfActive = activeComponent === "pdf" && isEvaluating;
  const isGithubActive = activeComponent === "github" && isEvaluating;
  const isWebsiteActive = activeComponent === "website" && isEvaluating;

  if (shouldReduceMotion) {
    return (
      <div className={cn("relative flex items-center justify-center p-6", className)}>
        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary text-primary">
          <Sparkles className="size-8" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex size-64 sm:size-72 mx-auto items-center justify-center select-none overflow-hidden",
        className
      )}
    >
      {/* Background Radial Ambient Energy Glow */}
      <motion.div
        animate={{
          scale: isEvaluating ? [1, 1.15, 1] : 1,
          opacity: isEvaluating ? [0.25, 0.45, 0.25] : 0.2,
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        style={{
          background: isCompleted
            ? "radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)"
            : isPdfActive
            ? "radial-gradient(circle, rgba(244,63,94,0.3) 0%, transparent 70%)"
            : isGithubActive
            ? "radial-gradient(circle, rgba(14,165,233,0.3) 0%, transparent 70%)"
            : isWebsiteActive
            ? "radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(217,90,43,0.3) 0%, transparent 70%)",
        }}
      />

      {/* SVG Canvas for Concentric Orbital Track Paths */}
      <svg
        className="absolute inset-0 size-full pointer-events-none"
        viewBox="0 0 288 288"
        fill="none"
      >
        {/* Outer Orbital Ring — Website (Radius: 114) */}
        <circle
          cx="144"
          cy="144"
          r="114"
          stroke="currentColor"
          strokeWidth="1.2"
          className={cn(
            "transition-colors duration-500",
            isWebsiteActive
              ? "text-emerald-500/80 stroke-dashed"
              : "text-border/60"
          )}
          strokeDasharray={isWebsiteActive ? "6 6" : "2 6"}
        />

        {/* Middle Orbital Ring — GitHub (Radius: 84) */}
        <circle
          cx="144"
          cy="144"
          r="84"
          stroke="currentColor"
          strokeWidth="1.2"
          className={cn(
            "transition-colors duration-500",
            isGithubActive
              ? "text-sky-500/80 stroke-dashed"
              : "text-border/60"
          )}
          strokeDasharray={isGithubActive ? "6 6" : "2 6"}
        />

        {/* Inner Orbital Ring — PDF (Radius: 54) */}
        <circle
          cx="144"
          cy="144"
          r="54"
          stroke="currentColor"
          strokeWidth="1.2"
          className={cn(
            "transition-colors duration-500",
            isPdfActive
              ? "text-rose-500/80 stroke-dashed"
              : "text-border/60"
          )}
          strokeDasharray={isPdfActive ? "6 6" : "2 6"}
        />
      </svg>

      {/* --- REVOLVING ORBITAL NODES (MAGIC UI ORBITING NODES) --- */}

      {/* 1. Inner Node: PDF Deck Intelligence (Radius 54px, 5s cycle) */}
      <motion.div
        animate={isEvaluating ? { rotate: 360 } : { rotate: 0 }}
        transition={{
          repeat: Infinity,
          duration: isPdfActive ? 3.5 : 9,
          ease: "linear",
        }}
        className="absolute size-full pointer-events-none"
      >
        <div
          style={{
            transform: "translate(-50%, -50%)",
            top: "calc(50% - 54px)",
            left: "50%",
          }}
          className="absolute"
        >
          <motion.div
            animate={{
              scale: isPdfActive ? [1, 1.25, 1] : 1,
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border shadow-sm transition-all duration-300",
              isPdfActive
                ? "bg-rose-500 text-white border-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                : "bg-background/90 text-rose-500 border-rose-500/40"
            )}
            title="PDF Presentation Deck Rubric"
          >
            <FileText className="size-3.5" />
          </motion.div>
        </div>
      </motion.div>

      {/* 2. Middle Node: GitHub Code Intelligence (Radius 84px, Counter-clockwise 7s cycle) */}
      <motion.div
        animate={isEvaluating ? { rotate: -360 } : { rotate: 0 }}
        transition={{
          repeat: Infinity,
          duration: isGithubActive ? 4.5 : 12,
          ease: "linear",
        }}
        className="absolute size-full pointer-events-none"
      >
        <div
          style={{
            transform: "translate(-50%, -50%)",
            top: "calc(50% + 84px)",
            left: "50%",
          }}
          className="absolute"
        >
          <motion.div
            animate={{
              scale: isGithubActive ? [1, 1.25, 1] : 1,
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border shadow-sm transition-all duration-300",
              isGithubActive
                ? "bg-sky-500 text-white border-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.6)]"
                : "bg-background/90 text-sky-500 border-sky-500/40"
            )}
            title="GitHub Repository Code Rubric"
          >
            <Github className="size-3.5" />
          </motion.div>
        </div>
      </motion.div>

      {/* 3. Outer Node: Web Live Prototype (Radius 114px, Clockwise 10s cycle) */}
      <motion.div
        animate={isEvaluating ? { rotate: 360 } : { rotate: 0 }}
        transition={{
          repeat: Infinity,
          duration: isWebsiteActive ? 5 : 15,
          ease: "linear",
        }}
        className="absolute size-full pointer-events-none"
      >
        <div
          style={{
            transform: "translate(-50%, -50%)",
            top: "50%",
            left: "calc(50% + 114px)",
          }}
          className="absolute"
        >
          <motion.div
            animate={{
              scale: isWebsiteActive ? [1, 1.25, 1] : 1,
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border shadow-sm transition-all duration-300",
              isWebsiteActive
                ? "bg-emerald-500 text-white border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                : "bg-background/90 text-emerald-500 border-emerald-500/40"
            )}
            title="Deployed Web Prototype Rubric"
          >
            <Globe className="size-3.5" />
          </motion.div>
        </div>
      </motion.div>

      {/* --- CENTRAL HOLOGRAPHIC AI NUCLEUS --- */}
      <div className="relative z-20 flex size-20 items-center justify-center rounded-full bg-card/90 border border-primary/40 shadow-xl backdrop-blur-md">
        {/* Core animated glow ring */}
        <motion.div
          animate={
            isCompleted
              ? { scale: [1, 1.2, 1], rotate: 360 }
              : {
                  scale: [1, 1.08, 1],
                  rotate: [0, 180, 360],
                }
          }
          transition={{
            scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 16, repeat: Infinity, ease: "linear" },
          }}
          className="absolute inset-1 rounded-full border border-dashed border-primary/50"
        />

        {/* Central Brand Emblem / State Icon */}
        <motion.div
          animate={
            isCompleted
              ? { scale: [0.9, 1.05, 1] }
              : { rotate: isEvaluating ? [0, 5, -5, 0] : 0 }
          }
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center justify-center text-center"
        >
          {isCompleted ? (
            <CheckCircle2 className="size-8 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          ) : (
            <>
              <Sparkles className="size-6 text-primary drop-shadow-[0_0_8px_var(--primary)]" />
              <span className="font-mono text-[9px] font-bold text-muted-foreground mt-0.5">
                {Math.round(progressPct)}%
              </span>
            </>
          )}
        </motion.div>
      </div>

      {/* Completed State: Expansive Shockwave Beacon Ring */}
      {isCompleted && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          className="absolute size-24 rounded-full border-2 border-emerald-500 pointer-events-none"
        />
      )}
    </div>
  );
}
