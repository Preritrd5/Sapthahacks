"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingState {
  text: string;
}

export interface MultiStepLoaderProps {
  loadingStates: LoadingState[];
  loading?: boolean | undefined;
  duration?: number | undefined;
  loop?: boolean | undefined;
  currentIndex?: number | undefined;
  className?: string | undefined;
  mode?: "inline" | "modal" | undefined;
  onComplete?: (() => void) | undefined;
}

export function MultiStepLoader({
  loadingStates,
  loading = false,
  duration = 2000,
  loop = false,
  currentIndex: externalIndex,
  className,
  mode = "inline",
  onComplete,
}: MultiStepLoaderProps) {
  const [internalState, setInternalState] = useState(0);

  const currentState = externalIndex !== undefined ? externalIndex : internalState;

  useEffect(() => {
    if (!loading || externalIndex !== undefined) {
      return;
    }
    const timeout = setTimeout(() => {
      setInternalState((prevState) => {
        if (prevState === loadingStates.length - 1) {
          if (loop) return 0;
          onComplete?.();
          return prevState;
        }
        return prevState + 1;
      });
    }, duration);

    return () => clearTimeout(timeout);
  }, [currentState, loading, loop, loadingStates.length, duration, externalIndex, onComplete]);

  const content = (
    <div className={cn("flex flex-col gap-3 py-2", className)}>
      {loadingStates.map((state, index) => {
        const isCompleted = index < currentState;
        const isCurrent = index === currentState && loading;
        const isUpcoming = index > currentState || (!loading && index !== currentState);

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            className={cn(
              "flex items-center gap-3 text-sm rounded-xl px-3 py-2 transition-all duration-300",
              isCurrent && "bg-primary/10 border border-primary/30 font-semibold text-foreground shadow-sm",
              isCompleted && "text-muted-foreground bg-muted/20",
              isUpcoming && "opacity-40 text-muted-foreground"
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="size-4.5 text-emerald-500 shrink-0" />
            ) : isCurrent ? (
              <div className="relative flex items-center justify-center size-4.5 shrink-0">
                <span className="absolute size-4.5 rounded-full bg-primary/20 animate-ping" />
                <Loader2 className="size-4 text-primary animate-spin" />
              </div>
            ) : (
              <Circle className="size-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className="text-xs md:text-sm">{state.text}</span>
          </motion.div>
        );
      })}
    </div>
  );

  if (mode === "modal") {
    return (
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl"
            >
              <div className="mb-4 text-center">
                <div className="text-base font-bold text-foreground">AI Evaluation Engine</div>
                <div className="text-xs text-muted-foreground mt-0.5">Automated multi-modal verification</div>
              </div>
              {content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return content;
}
