"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedProgressProps {
  value: number; // 0 to 100
  className?: string;
  indicatorClassName?: string;
  isProcessing?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "success" | "warning" | "destructive" | "default";
}

export function AnimatedProgress({
  value,
  className,
  indicatorClassName,
  isProcessing = false,
  showLabel = false,
  size = "md",
  variant = "primary",
}: AnimatedProgressProps) {
  const shouldReduceMotion = useReducedMotion();
  const clampedValue = Math.min(100, Math.max(0, value || 0));

  const heightClass = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  const variantGradients = {
    primary: "bg-gradient-to-r from-primary to-[oklch(0.72_0.17_60)] shadow-[0_0_12px_rgba(217,90,43,0.35)]",
    success: "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]",
    warning: "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]",
    destructive: "bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_12px_rgba(244,63,94,0.35)]",
    default: "bg-muted-foreground",
  }[variant];

  return (
    <div className="w-full space-y-1.5">
      {showLabel && (
        <div className="flex justify-between text-xs font-mono font-medium text-muted-foreground">
          <span>{isProcessing ? "Processing..." : "Progress"}</span>
          <span>{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-muted/60 border border-border/40",
          heightClass,
          className
        )}
      >
        <motion.div
          className={cn(
            "h-full rounded-full transition-colors relative",
            variantGradients,
            indicatorClassName
          )}
          initial={shouldReduceMotion ? { width: `${clampedValue}%` } : { width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 85, damping: 20 }
          }
        >
          {/* Subtle animated light shimmer across the bar while processing */}
          {isProcessing && !shouldReduceMotion && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
