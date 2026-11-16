"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}

/**
 * FadeIn
 * Smooth entrance animation with optional direction slide
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.35,
  direction = "up",
}: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  const getOffset = () => {
    if (direction === "up") return { y: 12 };
    if (direction === "down") return { y: -12 };
    if (direction === "left") return { x: 12 };
    if (direction === "right") return { x: -12 };
    return {};
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...getOffset() }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...getOffset() }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  delayChildren?: number;
}

/**
 * StaggerContainer
 * Parent container that staggers the animations of its StaggerItem children
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.06,
  delayChildren = 0,
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * StaggerItem
 * Child item inside a StaggerContainer
 */
export function StaggerItem({
  children,
  className,
}: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

interface ScaleOnHoverProps {
  children: React.ReactNode;
  className?: string;
  scale?: number;
  tapScale?: number;
}

/**
 * ScaleOnHover
 * Subtle interactive elevation & press state for buttons and cards
 */
export function ScaleOnHover({
  children,
  className,
  scale = 1.02,
  tapScale = 0.98,
}: ScaleOnHoverProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * PulsingScanner
 * Polished visual scanner effect used during live evaluation of artifacts
 */
export function PulsingScanner({
  className,
  label = "AI Evaluation Engine Active",
}: {
  className?: string;
  label?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-4 backdrop-blur-md",
        className
      )}
    >
      {/* Animated laser beam scanning vertically */}
      {!shouldReduceMotion && (
        <motion.div
          className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80 shadow-[0_0_15px_var(--primary)]"
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="flex items-center justify-between text-xs font-semibold text-primary">
        <span className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground animate-pulse">
          Analyzing Multi-Modal Evidence
        </span>
      </div>
    </div>
  );
}
