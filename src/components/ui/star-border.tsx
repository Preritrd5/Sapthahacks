"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface StarBorderProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType | undefined;
  className?: string | undefined;
  color?: string | undefined;
  speed?: string | undefined;
  children?: React.ReactNode | undefined;
  disabled?: boolean | undefined;
}

export function StarBorder({
  as: Component = "button",
  className = "",
  color = "rgb(217, 90, 43)",
  speed = "6s",
  children,
  disabled,
  ...props
}: StarBorderProps) {
  return (
    <Component
      className={cn(
        "relative inline-block py-[1px] overflow-hidden rounded-xl group transition-transform active:scale-95",
        disabled && "pointer-events-none opacity-50 active:scale-100",
        className
      )}
      disabled={disabled}
      {...props}
    >
      <div
        className="absolute w-[300%] h-[50%] opacity-70 bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="absolute w-[300%] h-[50%] opacity-70 top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="relative z-1 border border-border/80 bg-background/90 text-foreground text-center text-sm font-semibold py-2 px-4 rounded-xl backdrop-blur-md transition-colors group-hover:border-primary/50">
        {children}
      </div>
    </Component>
  );
}
