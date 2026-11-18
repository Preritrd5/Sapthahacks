"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string | undefined;
  children?: React.ReactNode | undefined;
  reverse?: boolean | undefined;
  duration?: number | undefined;
  delay?: number | undefined;
  radius?: number | undefined;
  path?: boolean | undefined;
  iconSize?: number | undefined;
  speed?: number | undefined;
}

export function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 60,
  path = true,
  iconSize = 32,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed;

  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-border/50 stroke-1 stroke-dashed"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            strokeDasharray="4 4"
          />
        </svg>
      )}

      <div
        style={
          {
            "--duration": `${calculatedDuration}s`,
            "--radius": radius,
            "--delay": `-${delay}s`,
            "--angle": "0",
          } as React.CSSProperties
        }
        className={cn(
          "absolute flex size-[var(--icon-size)] transform-gpu animate-orbit items-center justify-center rounded-full border border-border/60 bg-background/90 shadow-md backdrop-blur-md",
          { "[animation-direction:reverse]": reverse },
          className
        )}
        {...props}
      >
        <div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center">
          {children}
        </div>
      </div>
    </>
  );
}
