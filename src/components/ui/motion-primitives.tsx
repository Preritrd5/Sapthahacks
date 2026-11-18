"use client";

import React, { useRef, useState } from "react";
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
  staggerDelay = 0.05,
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
    hidden: { opacity: 0, y: 8, scale: 0.99 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1] as const,
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
 * BorderBeam
 * Magic UI Inspired Animated Border Beam.
 * Uses an SVG border with hardware-accelerated animated stroke to travel around
 * any card or container perimeter without breaking layout or borders.
 */
interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  borderRadius?: number;
}

export function BorderBeam({
  className,
  duration = 10,
  borderWidth = 1.5,
  colorFrom = "#d95a2b",
  colorTo = "#f59e0b",
  borderRadius = 16,
}: BorderBeamProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return null;
  }

  const gradientId = `beam-grad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 size-full rounded-[inherit] overflow-visible z-20",
        className
      )}
      style={{
        padding: `${borderWidth / 2}px`,
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorFrom} stopOpacity="0" />
          <stop offset="50%" stopColor={colorFrom} stopOpacity="1" />
          <stop offset="100%" stopColor={colorTo} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.rect
        width="100%"
        height="100%"
        rx={borderRadius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={borderWidth}
        strokeDasharray="160 380"
        animate={{
          strokeDashoffset: [0, -540],
        }}
        transition={{
          repeat: Infinity,
          duration,
          ease: "linear",
        }}
      />
    </svg>
  );
}

/**
 * Magnetic
 * React Bits Inspired Magnetic Pull interaction.
 * Moves subtly toward the cursor when hovering to give an organic, high-end feel.
 */
interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  strength?: number; // max pixel shift (e.g., 6)
  range?: number; // activation radius
}

export function Magnetic({
  children,
  className,
  strength = 6,
}: MagneticProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const deltaX = (clientX - centerX) / (width / 2);
    const deltaY = (clientY - centerY) / (height / 2);

    setPosition({
      x: deltaX * strength,
      y: deltaY * strength,
    });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 350, damping: 20, mass: 0.5 }}
      className={cn("inline-block", className)}
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

// Re-export Ready-Made Professional Animation Components
export * from "./magic-card";
export * from "./orbiting-circles";
export * from "./number-ticker";
export * from "./shimmer-button";
export * from "./blur-fade";
export * from "./spotlight-card";
export * from "./star-border";
export * from "./moving-border";
export * from "./multi-step-loader";

