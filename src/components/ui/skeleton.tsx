"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Enhanced Skeleton
 * Provides a shimmering pulse placeholder with realistic tones.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

/**
 * StatCardSkeleton
 * Premium metric card placeholder matching dashboard stat items.
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border/60 bg-card/60 p-5 shadow-xs overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <Skeleton className="h-8 w-20 rounded" />
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
      </div>
    </div>
  );
}

/**
 * TableSkeleton
 * Realistic tabular placeholder with header strip and customizable row counts.
 */
export function TableSkeleton({
  rows = 5,
  cols = 6,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("glass overflow-hidden rounded-2xl border border-border/60 shadow-xs", className)}>
      {/* Table Header Bar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
        </div>
      </div>

      {/* Table Head Columns */}
      <div className="grid grid-cols-12 gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 text-xs">
        <div className="col-span-4 flex items-center">
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <Skeleton className="h-3.5 w-14 rounded" />
        </div>
        <div className="col-span-2 flex items-center justify-end">
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
      </div>

      {/* Row Iteration */}
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center">
            <div className="col-span-4 flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 w-full max-w-[200px]">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-1/2 rounded" />
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-center">
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <div className="col-span-2 flex items-center justify-center">
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>

            <div className="col-span-2 flex items-center justify-center">
              <Skeleton className="h-6 w-12 rounded" />
            </div>

            <div className="col-span-2 flex items-center justify-end gap-1.5">
              <Skeleton className="h-7 w-16 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CardGridSkeleton
 * Multi-column card layout skeleton for problem statements, criteria, or teams.
 */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-5 w-3/4 rounded" />
            </div>
            <Skeleton className="size-8 rounded-lg shrink-0" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-5/6 rounded" />
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ChartSkeleton
 * Realistic bar/area chart skeleton with axis guides.
 */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/60 p-6 space-y-4 shadow-xs",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-2.5 w-24 rounded" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Simulated Bars */}
      <div className="h-48 flex items-end justify-between gap-3 pt-6 border-b border-border/40 pb-2">
        {[45, 75, 60, 90, 65, 80, 50, 85, 70, 95, 60, 75].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton
              className="w-full rounded-t"
              style={{ height: `${h}%` }}
            />
            <Skeleton className="h-2 w-full max-w-[20px] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton };
