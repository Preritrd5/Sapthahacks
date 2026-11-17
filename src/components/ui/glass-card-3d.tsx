"use client";

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCard3DProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  glowColor?: string;
  intensity?: number;
  onClick?: () => void;
}

export function GlassCard3D({
  children,
  className,
  containerClassName,
  glowColor = "rgba(217, 90, 43, 0.15)",
  intensity = 12,
  onClick,
}: GlassCard3DProps) {
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [sheenX, setSheenX] = useState(50);
  const [sheenY, setSheenY] = useState(50);
  const [isHovered, setIsHovered] = useState(false);

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
    setSheenX((x / rect.width) * 100);
    setSheenY((y / rect.height) * 100);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  if (shouldReduceMotion) {
    return (
      <div className={cn("glass rounded-2xl p-4 sm:p-5", className)} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ perspective: 1000 }} className={cn("h-full", containerClassName)}>
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        animate={{
          rotateX,
          rotateY,
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 22,
        }}
        style={{
          transformStyle: "preserve-3d" as const,
        } as any}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/80",
          "bg-card/85 backdrop-blur-xl p-4 sm:p-5",
          "shadow-[0_8px_32px_0_rgba(217,90,43,0.06)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
          "transition-all duration-300",
          isHovered && "shadow-[0_16px_40px_0_rgba(217,90,43,0.18)] border-primary/40",
          className
        )}
        onClick={onClick}
      >
        {/* Dynamic Specular Sheen on Hover */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, ${glowColor} 0%, transparent 65%)`,
            }}
          />
        )}

        {/* 3D Content Container */}
        <div style={{ transform: "translateZ(12px)" }} className="relative z-20 size-full">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
