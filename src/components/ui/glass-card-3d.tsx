"use client";

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BorderBeam } from "./motion-primitives";

interface GlassCard3DProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  glowColor?: string;
  intensity?: number;
  onClick?: () => void;
  showBorderSpotlight?: boolean;
  showGlare?: boolean;
  showBorderBeam?: boolean;
}

const DEFAULT_GLOW = {
  radial: "rgba(217, 90, 43, 0.22)",
  border: "rgba(217, 90, 43, 0.55)",
};

const COLOR_MAP: Record<string, { radial: string; border: string }> = {
  primary: DEFAULT_GLOW,
  terracotta: {
    radial: "rgba(217, 90, 43, 0.25)",
    border: "rgba(217, 90, 43, 0.6)",
  },
  amber: {
    radial: "rgba(245, 158, 11, 0.22)",
    border: "rgba(245, 158, 11, 0.55)",
  },
  emerald: {
    radial: "rgba(16, 185, 129, 0.22)",
    border: "rgba(16, 185, 129, 0.55)",
  },
  rose: {
    radial: "rgba(244, 63, 94, 0.22)",
    border: "rgba(244, 63, 94, 0.55)",
  },
  sky: {
    radial: "rgba(14, 165, 233, 0.22)",
    border: "rgba(14, 165, 233, 0.55)",
  },
  purple: {
    radial: "rgba(168, 85, 247, 0.22)",
    border: "rgba(168, 85, 247, 0.55)",
  },
};

function resolveGlow(tokenOrColor?: string): { radial: string; border: string } {
  if (!tokenOrColor) {
    return DEFAULT_GLOW;
  }
  const key = tokenOrColor.toLowerCase();
  const matched = COLOR_MAP[key];
  if (matched) {
    return matched;
  }
  // If it's already a CSS color string (e.g. rgba, hex, hsl)
  return {
    radial: tokenOrColor,
    border: tokenOrColor,
  };
}

/**
 * GlassCard3D
 * Professional-grade Magic Card + 3D Tilt hybrid (Aceternity UI + Magic UI).
 * Features:
 * - Dynamic cursor spotlight following pointer coordinates
 * - Precision border-illumination beam on cursor proximity
 * - Spring-based 3D perspective tilt
 * - Strictly preserves card dimensions, spacing, typography, and layout at rest
 */
export function GlassCard3D({
  children,
  className,
  containerClassName,
  glowColor = "primary",
  intensity = 10,
  onClick,
  showBorderSpotlight = true,
  showGlare = true,
  showBorderBeam = false,
}: GlassCard3DProps) {
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const colors = resolveGlow(glowColor);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -intensity;
    const rotY = ((x - centerX) / centerX) * intensity;

    setRotateX(rotX);
    setRotateY(rotY);
    setCoords({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    setIsHovered(true);
  };

  if (shouldReduceMotion) {
    return (
      <div
        className={cn(
          "glass rounded-2xl p-5 sm:p-6 border border-border/80 bg-card/85",
          className
        )}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }

  return (
    <div style={{ perspective: 1200 }} className={cn("h-full", containerClassName)}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{
          rotateX,
          rotateY,
          scale: isHovered ? 1.015 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 24,
          mass: 0.8,
        }}
        style={
          {
            transformStyle: "preserve-3d",
          } as any
        }
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/70",
          "bg-card/90 backdrop-blur-xl h-full",
          "shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]",
          "transition-[box-shadow,border-color] duration-300",
          isHovered && "shadow-[0_12px_36px_0_rgba(217,90,43,0.14)] dark:shadow-[0_16px_44px_0_rgba(0,0,0,0.55)] border-primary/50"
        )}
        onClick={onClick}
      >
        {/* Magic Card: Pointer-responsive radial spotlight layer */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: `radial-gradient(400px circle at ${coords.x}px ${coords.y}px, ${colors.radial} 0%, transparent 75%)`,
          }}
        />

        {/* Aceternity UI 3D Glare: Dynamic glass reflection that moves with perspective tilt */}
        {showGlare && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-15 transition-opacity duration-300 mix-blend-overlay",
              isHovered ? "opacity-35 dark:opacity-20" : "opacity-0"
            )}
            style={{
              background: `linear-gradient(${125 + rotateY * 2.5}deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.04) 35%, transparent 70%)`,
            }}
          />
        )}

        {/* Magic UI Border Spotlight: Precision glowing border highlight at cursor */}
        {showBorderSpotlight && (
          <div
            className={cn(
              "pointer-events-none absolute -inset-[1px] rounded-[inherit] z-20 transition-opacity duration-300",
              isHovered ? "opacity-100" : "opacity-0"
            )}
            style={{
              padding: "1px",
              background: `radial-gradient(240px circle at ${coords.x}px ${coords.y}px, ${colors.border} 0%, transparent 70%)`,
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
        )}

        {/* Magic UI Border Beam (Optional animated traveling beam) */}
        {showBorderBeam && (
          <BorderBeam
            colorFrom={colors.border}
            colorTo={colors.radial}
            duration={8}
            borderWidth={1.5}
            borderRadius={16}
          />
        )}

        {/* 3D Content Container: elevated on z-axis without altering standard box model */}
        <div
          style={{ transform: "translateZ(10px)" }}
          className={cn(
            "relative z-30 w-full h-full p-5 sm:p-6 flex flex-col justify-between",
            className
          )}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
