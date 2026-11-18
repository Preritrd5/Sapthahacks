"use client";

import React, { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

export function MovingBorder({
  children,
  duration = 3000,
  rx = "16",
  ry = "16",
  ...otherProps
}: {
  children?: React.ReactNode | undefined;
  duration?: number | undefined;
  rx?: string | undefined;
  ry?: string | undefined;
  [key: string]: any;
}) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);
    }
  });

  const x = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).x ?? 0
  );
  const y = useTransform(
    progress,
    (val) => pathRef.current?.getPointAtLength(val).y ?? 0
  );

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect
          fill="none"
          width="100%"
          height="100%"
          rx={rx}
          ry={ry}
          ref={pathRef}
        />
      </svg>
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "inline-block",
          transform,
        }}
      >
        {children}
      </motion.div>
    </>
  );
}

export interface MovingBorderButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  borderRadius?: string | undefined;
  children: React.ReactNode;
  as?: any | undefined;
  containerClassName?: string | undefined;
  borderClassName?: string | undefined;
  duration?: number | undefined;
  className?: string | undefined;
}

export function MovingBorderButton({
  borderRadius = "1rem",
  children,
  as: Component = "button",
  containerClassName,
  borderClassName,
  duration = 3000,
  className,
  ...otherProps
}: MovingBorderButtonProps) {
  return (
    <Component
      className={cn(
        "bg-transparent relative text-sm p-[1px] overflow-hidden rounded-2xl active:scale-95 transition-transform",
        containerClassName
      )}
      style={{
        borderRadius: borderRadius,
      }}
      {...otherProps}
    >
      <div
        className="absolute inset-0"
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        <MovingBorder duration={duration} rx="16" ry="16">
          <div
            className={cn(
              "h-16 w-16 opacity-[0.8] bg-[radial-gradient(var(--terracotta,#d95a2b)_40%,transparent_65%)]",
              borderClassName
            )}
          />
        </MovingBorder>
      </div>

      <div
        className={cn(
          "relative bg-card/95 border border-border/70 backdrop-blur-xl text-foreground flex items-center justify-center w-full h-full text-sm antialiased font-semibold px-4 py-2",
          className
        )}
        style={{
          borderRadius: `calc(${borderRadius} * 0.96)`,
        }}
      >
        {children}
      </div>
    </Component>
  );
}
