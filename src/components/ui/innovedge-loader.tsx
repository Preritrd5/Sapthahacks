"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion, motion } from "framer-motion";

export type LoaderSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface InnovedgeLoaderProps {
  size?: LoaderSize;
  className?: string;
  label?: string;
  sublabel?: string;
  inline?: boolean;
}

const SIZE_MAP: Record<LoaderSize, { dimension: number; stroke: number; textClass: string }> = {
  xs: { dimension: 16, stroke: 2, textClass: "text-[11px]" },
  sm: { dimension: 20, stroke: 2.2, textClass: "text-xs" },
  md: { dimension: 36, stroke: 2.8, textClass: "text-xs" },
  lg: { dimension: 52, stroke: 3.2, textClass: "text-sm" },
  xl: { dimension: 72, stroke: 3.6, textClass: "text-base" },
};

/**
 * InnovedgeLoader
 * Sophisticated orbital loading animation engineered for the INNOVEDGE Assessor Platform.
 * Features dual counter-rotating orbital rings with institutional brand styling.
 */
export function InnovedgeLoader({
  size = "md",
  className,
  label,
  sublabel,
  inline = false,
}: InnovedgeLoaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const config = SIZE_MAP[size];
  const radius = (config.dimension - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  const loaderVisual = (
    <div
      className={cn("relative flex items-center justify-center shrink-0", className)}
      style={{ width: config.dimension, height: config.dimension }}
      role="status"
      aria-label={label || "Loading"}
    >
      <svg
        className={cn("w-full h-full", !shouldReduceMotion && "animate-spin")}
        style={{ animationDuration: "1.4s" }}
        viewBox={`0 0 ${config.dimension} ${config.dimension}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle background track */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={config.stroke}
          className="text-primary/15"
        />

        {/* Primary gradient orbital head */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.72}
          className="text-primary drop-shadow-[0_0_6px_var(--primary)]"
        />
      </svg>

      {/* Counter-rotating secondary ring for md, lg, xl sizes */}
      {(size === "md" || size === "lg" || size === "xl") && (
        <svg
          className={cn("absolute inset-0 w-full h-full", !shouldReduceMotion && "animate-spin")}
          style={{ animationDuration: "2.4s", animationDirection: "reverse" }}
          viewBox={`0 0 ${config.dimension} ${config.dimension}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius * 0.65}
            stroke="currentColor"
            strokeWidth={config.stroke * 0.85}
            strokeLinecap="round"
            strokeDasharray={circumference * 0.65}
            strokeDashoffset={circumference * 0.65 * 0.6}
            className="text-primary/60"
          />
        </svg>
      )}

      {/* Central pulsing core node */}
      <span
        className={cn(
          "absolute rounded-full bg-primary",
          size === "xs" && "size-1",
          size === "sm" && "size-1.5",
          size === "md" && "size-2 shadow-[0_0_8px_var(--primary)]",
          size === "lg" && "size-2.5 shadow-[0_0_12px_var(--primary)]",
          size === "xl" && "size-3 shadow-[0_0_16px_var(--primary)]",
          !shouldReduceMotion && "animate-pulse"
        )}
      />
    </div>
  );

  if (!label && !sublabel) {
    return loaderVisual;
  }

  if (inline) {
    return (
      <div className="inline-flex items-center gap-2.5 text-muted-foreground">
        {loaderVisual}
        <span className={cn("font-medium text-foreground", config.textClass)}>{label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
      {loaderVisual}
      {(label || sublabel) && (
        <div className="space-y-1">
          {label && (
            <div className={cn("font-display font-semibold tracking-tight text-foreground", config.textClass)}>
              {label}
            </div>
          )}
          {sublabel && (
            <div className="text-xs text-muted-foreground font-mono leading-relaxed max-w-sm">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * AppSplashLoader
 * Fullscreen branded loading presentation used during initial application boot,
 * auth session resolution, and workspace priming.
 */
export function AppSplashLoader({
  message = "Initializing INNOVEDGE Workspace...",
  submessage = "Verifying authenticated credentials & synchronizing system state",
}: {
  message?: string;
  submessage?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-4 select-none">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center max-w-md text-center"
      >
        {/* Brand Icon Badge with Orbit Ring */}
        <div className="relative mb-6">
          <div className="relative size-16 rounded-2xl bg-card border border-border/80 shadow-2xl flex items-center justify-center overflow-hidden p-2">
            <img
              src="/innovedge-logo.png"
              alt="INNOVEDGE"
              className="size-full object-contain filter drop-shadow-sm"
            />
          </div>
          {/* Subtle Outer Glow Accent */}
          <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-xl -z-10 animate-pulse" />
        </div>

        {/* Central Orbital Spinner */}
        <InnovedgeLoader size="lg" className="mb-4" />

        {/* Status Typography */}
        <div className="space-y-1.5 mt-2">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {message}
          </h2>
          <p className="text-xs text-muted-foreground font-mono leading-relaxed max-w-xs mx-auto">
            {submessage}
          </p>
        </div>

        {/* Platform Verification Tag */}
        <div className="mt-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border/60 text-[11px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>INNOVEDGE 2026 Core Gateway</span>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * RouteLoadingView
 * Inline page-level loading state used when switching routes or executing heavy views.
 */
export function RouteLoadingView({
  label = "Loading page data...",
  sublabel = "Retrieving verified records from database",
  className,
}: {
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-h-[50vh] flex items-center justify-center p-8", className)}>
      <InnovedgeLoader size="lg" label={label} sublabel={sublabel} />
    </div>
  );
}
