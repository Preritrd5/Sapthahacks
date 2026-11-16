"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Sparkles } from "lucide-react";

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ isDark, onToggle, className = "" }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative flex h-9 w-[74px] items-center rounded-full p-1 transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner select-none ${
        isDark
          ? "bg-gradient-to-r from-[#171412] via-[#241e1a] to-[#2c2018] border border-terracotta/30 shadow-[0_0_15px_rgba(217,90,43,0.18)]"
          : "bg-gradient-to-r from-[#FDE8DF] via-[#FCE0D4] to-[#F8D2C2] border border-[#E8A588]/40 shadow-[0_2px_10px_rgba(217,90,43,0.12)]"
      } ${className}`}
      aria-label="Toggle theme mode"
      title={isDark ? "Switch to Warm Ivory Light Theme" : "Switch to Dark Theme"}
    >
      {/* Background Decor: Twinkling Stars (Dark) vs Drifting Clouds / Sunbeams (Light) */}
      <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
        <AnimatePresence mode="wait">
          {isDark ? (
            <motion.div
              key="dark-sky"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <span className="absolute top-1.5 left-3 size-1 rounded-full bg-amber-200/80 animate-ping" />
              <span className="absolute bottom-1.5 left-5 size-0.5 rounded-full bg-amber-100/90" />
              <span className="absolute top-2.5 left-7 size-0.5 rounded-full bg-orange-300/80" />
            </motion.div>
          ) : (
            <motion.div
              key="light-sky"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <span className="absolute top-1.5 right-4 h-1.5 w-3.5 rounded-full bg-white/60 blur-[0.3px]" />
              <span className="absolute bottom-1.5 right-6 h-1 w-2.5 rounded-full bg-white/40 blur-[0.3px]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3D Animated Sliding Knob */}
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 450,
          damping: 28,
        }}
        className={`relative flex size-7 items-center justify-center rounded-full shadow-md transition-colors ${
          isDark
            ? "ml-auto bg-gradient-to-tr from-amber-400 to-terracotta text-black shadow-[0_2px_12px_rgba(217,90,43,0.5)]"
            : "mr-auto bg-gradient-to-tr from-white via-[#FFF5ED] to-terracotta/20 text-terracotta shadow-[0_2px_10px_rgba(217,90,43,0.25)] border border-[#E89574]/40"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, scale: 0.2, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.2, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Moon className="size-3.5 fill-black stroke-black" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, scale: 0.2, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0.2, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Sun className="size-3.5 stroke-terracotta animate-[spin_12s_linear_infinite]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}
