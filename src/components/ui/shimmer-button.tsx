"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string | undefined;
  shimmerSize?: string | undefined;
  borderRadius?: string | undefined;
  shimmerDuration?: string | undefined;
  background?: string | undefined;
  className?: string | undefined;
  children?: React.ReactNode | undefined;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "rgba(255, 255, 255, 0.4)",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "12px",
      background = "rgba(217, 90, 43, 1)",
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
          } as React.CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap px-4 py-2 text-white [background:var(--bg)] [border-radius:var(--radius)] active:scale-95 transition-transform duration-200 shadow-md",
          "transform-gpu transition-all ease-in-out",
          disabled && "cursor-not-allowed opacity-50 active:scale-100",
          className
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {/* Spark container */}
        <div
          className={cn(
            "-z-30 blur-[2px]",
            "absolute inset-0 overflow-visible [container-type:size]"
          )}
        >
          {/* Spark */}
          <div className="absolute inset-0 h-[100cqh] animate-spin-around [aspect-ratio:1]">
            <div className="size-full [background:conic-gradient(from_0deg,transparent_0_340deg,var(--shimmer-color)_360deg)]" />
          </div>
        </div>
        {children}

        {/* Highlight overlay */}
        <div
          className={cn(
            "insert-0 absolute size-full",
            "rounded-2xl px-4 py-1.5 text-sm font-medium",
            "transform-gpu transition-all duration-300 ease-in-out",
            "group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]",
            "group-active:shadow-[inset_0_-10px_10px_#ffffff3f]"
          )}
        />

        {/* Backdrop */}
        <div
          className={cn(
            "absolute -z-20 [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]"
          )}
        />
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
